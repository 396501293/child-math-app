import type { EquipTier, Ores, Progress, RewardsSlice, TradeKind } from './types';
import {
  ACCESSORIES,
  CATALOG_BY_ID,
  EQUIPMENT,
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
    if (item) out[item.material] += item.cost;
  }
  out.coal += r.skyStars * STAR_PRICE_COAL;
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
  return balance(p)[item.material] >= item.cost;
}

// 制作即穿上/摆出（穿脱是另外的可逆操作，见 setEquipped）。不可制作时原样返回。
export function craft(p: Progress, id: string): Progress {
  if (!craftable(p, id)) return p;
  const item = CATALOG_BY_ID[id]!;
  const r = p.rewards;
  const equipped = { ...r.equipped, accessories: [...r.equipped.accessories] };
  if ('tier' in item) {
    equipped[item.slot] = id;
  } else {
    // 同锚点只摆一个：换下旧的（仍拥有，可在工作台重新摆出）
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
