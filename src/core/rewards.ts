import type { EquipTier, Ores, Progress, RewardsSlice, TradeKind } from './types';
import {
  ACCESSORIES,
  BLOCKS,
  BLOCK_PRICE_COAL,
  PET_IDS,
  CATALOG_BY_ID,
  EQUIPMENT,
  HOME_SIZE,
  SLOT_ORDER,
  STAR_PRICE_COAL,
  TIER_ORDER,
  TRADE_CHAIN,
} from './rewardsCatalog';

// 史蒂夫养成的经济核心（spec §3）。全部纯函数；矿石**没有独立存量**——
// 余额 = income(Progress) − spent(rewards)，任何时刻可重算，重复发放/丢矿
// 在结构上不可能发生。公式权威：评审 2026-07-30 §问3（原样照抄，勿改）。

const ZERO: Ores = { coal: 0, iron: 0, gold: 0, diamond: 0, emerald: 0 };

// ── 收入：五矿全部从 Progress 派生，单调、路径无关、farm-proof ──
export function income(p: Progress): Ores {
  let starred = 0;
  let ironSum = 0;
  for (const v of Object.values(p.stars)) {
    if (v >= 1) starred++;
    if (v >= 2) ironSum += v - 1;
  }
  const P = p.rewards.practiceFirstTry;
  return {
    coal: starred + Math.floor(P / 8),
    iron: ironSum,
    gold: Math.floor(P / 25),
    diamond: Math.floor(starred / 10) + Math.floor(P / 200),
    emerald: Math.floor((p.timesTable.litBest ?? 0) / 3) + Math.floor(p.endless.bestStreak / 10),
  };
}

// ── 消耗：owned 单价 + 星 + 兑换净额（兑换在 from 侧计支出、to 侧计进账）──
export function spent(r: RewardsSlice): Ores {
  const out = { ...ZERO };
  for (const id of r.owned) {
    const item = CATALOG_BY_ID[id];
    if (item) {
      out[item.material] += item.cost;
      // 双材料定价（下界合金腿/胸 +1 绿）
      if ('cost2' in item && item.cost2) out[item.cost2.material] += item.cost2.cost;
    }
  }
  out.coal += r.skyStars * STAR_PRICE_COAL;
  // 家园：非空格数 ×1（收回即回落——净零消耗，无退款操作）
  out.coal += r.homeGrid.reduce((n, b) => n + (b ? BLOCK_PRICE_COAL : 0), 0);
  for (const t of TRADE_CHAIN) {
    out[t.from] += t.rate * r.traded[t.kind];
    out[t.to] -= r.traded[t.kind]; // 兑换所得记为负消耗
  }
  return out;
}

export function balance(p: Progress): Ores {
  const inc = income(p);
  const sp = spent(p.rewards);
  const out = { ...ZERO };
  for (const k of Object.keys(ZERO) as (keyof Ores)[]) out[k] = inc[k] - sp[k];
  return out;
}

// ── 阶间顺序解锁：上一阶 4 件集齐才开下一阶；皮革恒开（评审：否则钻靴第 1 周即可达）──
export function tierUnlocked(r: RewardsSlice, tier: EquipTier): boolean {
  const idx = TIER_ORDER.indexOf(tier);
  if (idx <= 0) return true;
  const prev = TIER_ORDER[idx - 1];
  return SLOT_ORDER.every((slot) => r.owned.includes(`eq-${prev}-${slot}`));
}

export function craftable(p: Progress, id: string): boolean {
  const item = CATALOG_BY_ID[id];
  if (!item || p.rewards.owned.includes(id)) return false;
  if ('tier' in item && !tierUnlocked(p.rewards, item.tier)) return false;
  const bal = balance(p);
  if (bal[item.material] < item.cost) return false;
  return !('cost2' in item) || !item.cost2 || bal[item.cost2.material] >= item.cost2.cost;
}

// 制作即穿上/摆出（穿脱是另外的可逆操作，见 setEquipped）。不可制作时原样返回。
export function craft(p: Progress, id: string): Progress {
  if (!craftable(p, id)) return p;
  const item = CATALOG_BY_ID[id]!;
  const r = p.rewards;
  const equipped = { ...r.equipped, accessories: [...r.equipped.accessories] };
  if ('tier' in item) {
    equipped[item.slot] = id;
  } else if (!PET_IDS.includes(id)) {
    // 同锚点只摆一个：换下旧的（仍拥有，可在衣柜重新摆出）。
    // 宠物例外：住家园自由走动，不进 equipped。
    equipped.accessories = equipped.accessories.filter(
      (a) => (CATALOG_BY_ID[a] as { anchor?: string })?.anchor !== item.anchor,
    );
    equipped.accessories.push(id);
  }
  return { ...p, rewards: { ...r, owned: [...r.owned, id], equipped } };
}

// 穿脱（免费、可逆、无确认——评审问 5）。只能穿已拥有的。
export function setEquipped(p: Progress, patch: Partial<RewardsSlice['equipped']>): Progress {
  const r = p.rewards;
  const next = { ...r.equipped, ...patch };
  const ownedOk = (id: string | null) => id === null || r.owned.includes(id);
  if (![next.boots, next.helm, next.legs, next.chest].every(ownedOk)) return p;
  if (!next.accessories.every((id) => r.owned.includes(id))) return p;
  return { ...p, rewards: { ...r, equipped: next } };
}

export function trade(p: Progress, kind: TradeKind): Progress {
  const t = TRADE_CHAIN.find((x) => x.kind === kind)!;
  if (balance(p)[t.from] < t.rate) return p;
  return {
    ...p,
    rewards: { ...p.rewards, traded: { ...p.rewards.traded, [kind]: p.rewards.traded[kind] + 1 } },
  };
}

export function lightStar(p: Progress): Progress {
  if (balance(p).coal < STAR_PRICE_COAL) return p;
  return { ...p, rewards: { ...p.rewards, skyStars: p.rewards.skyStars + 1 } };
}

// ── 建造层（评审 2026-07-31）：放置扣煤、收回即回落，全部派生自愈 ──
export function placeBlock(p: Progress, index: number, blockId: string): Progress {
  const r = p.rewards;
  if (index < 0 || index >= HOME_SIZE) return p;
  if (r.homeGrid[index] !== null) return p;
  if (!BLOCKS.some((b) => b.id === blockId)) return p;
  if (balance(p).coal < BLOCK_PRICE_COAL) return p;
  const homeGrid = [...r.homeGrid];
  homeGrid[index] = blockId;
  return { ...p, rewards: { ...r, homeGrid } };
}

export function removeBlock(p: Progress, index: number): Progress {
  const r = p.rewards;
  if (index < 0 || index >= HOME_SIZE || r.homeGrid[index] === null) return p;
  const homeGrid = [...r.homeGrid];
  homeGrid[index] = null;
  return { ...p, rewards: { ...r, homeGrid } };
}

// ── 埋点（App.answer 每次首答/重试调用，纯函数）──
// practice = 三练习模式（非 campaign）；firstTry = 本题首次作答（excluded 为空）。
// weekly 只在首答时计题量（重试不重复计入答题量）；翻周即重置（P0-2-lite）。
const WEEK_MS = 7 * 24 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
export function recordAnswer(
  p: Progress,
  a: {
    practice: boolean;
    firstTry: boolean;
    correct: boolean;
    chapter?: string; // '1'–'4' 章 / 'tt' 九九——家长小结分章聚合（审查 D2）
    qText?: string;   // 题面（eqText）——仅首答错误时进错题缓冲
    picked?: number;  // 孩子的错选项
  },
  now: number,
): Progress {
  const fresh = now - p.weekly.weekStart >= WEEK_MS;
  const w = fresh ? { weekStart: now, answered: 0, firstTry: 0 } : { ...p.weekly };
  let insight = p.insight;
  if (a.firstTry) {
    w.answered += 1;
    if (a.correct) w.firstTry += 1;
    // 家长小结：近 7 天日桶滚动（只在首答时记，重试不重复计）
    const d = Math.floor(now / DAY_MS);
    const days = insight.days
      .filter((b) => d - b.d < 7)
      .map((b) => (b.d === d ? { d: b.d, ch: { ...b.ch } } : b));
    let today = days.find((b) => b.d === d);
    if (!today) {
      today = { d, ch: {} };
      days.push(today);
    }
    if (a.chapter) {
      const cur = today.ch[a.chapter] ?? { n: 0, ok: 0 };
      today.ch[a.chapter] = { n: cur.n + 1, ok: cur.ok + (a.correct ? 1 : 0) };
    }
    const errors =
      !a.correct && a.qText !== undefined
        ? [...insight.errors, { text: a.qText, picked: a.picked ?? 0, at: now }].slice(-20)
        : insight.errors;
    insight = { days, errors };
  }
  const firstTryCorrect = a.practice && a.firstTry && a.correct;
  return {
    ...p,
    weekly: w,
    insight,
    rewards: firstTryCorrect
      ? { ...p.rewards, practiceFirstTry: p.rewards.practiceFirstTry + 1 }
      : p.rewards,
  };
}

// 渐次显形辅助（spec §5）：下一件可见目标
export function nextEquipTargets(r: RewardsSlice): string[] {
  const out: string[] = [];
  for (const tier of TIER_ORDER) {
    if (!tierUnlocked(r, tier)) break;
    for (const slot of SLOT_ORDER) {
      const id = `eq-${tier}-${slot}`;
      if (!r.owned.includes(id)) out.push(id);
    }
    if (out.length) break; // 只展开当前未完成的阶
  }
  return out;
}

export function visibleAccessories(r: RewardsSlice): string[] {
  const owned = ACCESSORIES.filter((a) => r.owned.includes(a.id)).map((a) => a.id);
  const next = ACCESSORIES.filter((a) => !r.owned.includes(a.id)).slice(0, 3).map((a) => a.id);
  return [...owned, ...next];
}

export { EQUIPMENT, ACCESSORIES };
