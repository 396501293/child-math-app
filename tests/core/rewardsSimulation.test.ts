import { expect, test } from 'vitest';
import { defaultProgress } from '../../src/core/storage';
import type { Progress } from '../../src/core/types';
import { balance, craft, craftable, lightStar, nextEquipTargets, trade } from '../../src/core/rewards';
import { ACCESSORIES, CATALOG_BY_ID, SLOT_ORDER, TIER_ORDER } from '../../src/core/rewardsCatalog';

// 三画像经济仿真：把评审 §F 的时间线固化为回归测试。
// 收入假设照评审：常规 = 16 关/周 + P100/周；跳级 = 只打 46–60、P150/周；
// 弱 = 6 关/周（均星 1.3）+ P35/周。
// 花费策略 = 孩子的贪心近似：优先装备 → 卡料时兑换 → 空窗周做配件/点星。

interface Profile {
  levels: { count: number; stars: (1 | 2 | 3)[] }; // 每周新关与星级分布（循环取用）
  maxLevel: number;                                 // 关卡耗尽后只剩练习与重玩提星
  practicePerWeek: number;
  startLevel: number;
  upgradesPerWeek?: number;                         // 关卡耗尽后每周重玩提星数（1★→2★）
}

const NORMAL: Profile = {
  levels: { count: 16, stars: [3, 3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1] },
  maxLevel: 60, practicePerWeek: 100, startLevel: 1,
};
const SKIPPER: Profile = {
  levels: { count: 8, stars: [3, 3, 3, 3, 3, 3, 2, 2] },
  maxLevel: 60, practicePerWeek: 150, startLevel: 46, // 只有第四章：低章永远无星
};
const WEAK: Profile = {
  levels: { count: 6, stars: [2, 2, 1, 1, 1, 1] },
  maxLevel: 60, practicePerWeek: 35, startLevel: 1,
  // 关卡打完后每周定向重玩 2 关把 1★ 提到 2★——公式设计内的好行为
  // （评审：「重玩只在星级提升时产出增量 = 定向重练你没掌握的关」）
  upgradesPerWeek: 2,
};

function advanceWeek(p: Progress, prof: Profile, cursor: { level: number }): Progress {
  const stars = { ...p.stars };
  let advanced = false;
  for (let i = 0; i < prof.levels.count && cursor.level <= prof.maxLevel; i++, cursor.level++) {
    stars[cursor.level] = prof.levels.stars[i % prof.levels.stars.length];
    advanced = true;
  }
  if (!advanced && prof.upgradesPerWeek) {
    let n = prof.upgradesPerWeek;
    for (const k of Object.keys(stars)) {
      if (n <= 0) break;
      if (stars[Number(k)] === 1) { stars[Number(k)] = 2; n--; }
    }
  }
  return {
    ...p,
    stars,
    rewards: { ...p.rewards, practiceFirstTry: p.rewards.practiceFirstTry + prof.practicePerWeek },
  };
}

// 贪心花费：装备优先，卡料就兑换；本周无事件则做配件/点星（空窗填充）
function spendWeek(p0: Progress): { p: Progress; events: number } {
  let p = p0;
  let events = 0;
  for (let guard = 0; guard < 50; guard++) {
    const targets = nextEquipTargets(p.rewards);
    const hit = targets.find((id) => craftable(p, id));
    if (hit) { p = craft(p, hit); events++; continue; }
    const t = targets[0];
    if (t) {
      const mat = (CATALOG_BY_ID[t] as { material: string }).material;
      const chain = { iron: 'coalToIron', gold: 'ironToGold', diamond: 'goldToDiamond' }[mat] as
        | 'coalToIron' | 'ironToGold' | 'goldToDiamond' | undefined;
      if (chain) {
        const p2 = trade(p, chain);
        if (p2 !== p) { p = p2; continue; }
      }
    }
    break;
  }
  // 空窗填充不偷装备材料：目标件卡料时留足煤做兑换（≥20 才动配件/星）
  if (events === 0 && balance(p).coal >= 20) {
    const acc = ACCESSORIES.find((a) => craftable(p, a.id));
    if (acc) { p = craft(p, acc.id); events++; }
    else {
      const p2 = lightStar(p);
      if (p2 !== p) { p = p2; events++; }
    }
  }
  return { p, events };
}

function diamondSetDone(p: Progress): boolean {
  return SLOT_ORDER.every((s) => p.rewards.owned.includes(`eq-diamond-${s}`));
}

function simulate(prof: Profile, weeks: number) {
  let p = defaultProgress();
  const cursor = { level: prof.startLevel };
  let doneWeek: number | null = null;
  let maxGap = 0;
  let gap = 0;
  for (let w = 1; w <= weeks; w++) {
    p = advanceWeek(p, prof, cursor);
    const r = spendWeek(p);
    p = r.p;
    gap = r.events > 0 ? 0 : gap + 1;
    maxGap = Math.max(maxGap, gap);
    if (doneWeek === null && diamondSetDone(p)) doneWeek = w;
  }
  return { p, doneWeek, maxGap };
}

test('红线价：弱画像首次会话（2 关 1★ + P8）就够皮革靴', () => {
  let p = defaultProgress();
  p = { ...p, stars: { 1: 1, 2: 1 }, rewards: { ...p.rewards, practiceFirstTry: 8 } };
  expect(balance(p).coal).toBe(3);
  expect(craftable(p, 'eq-leather-boots')).toBe(true);
});

test('常规画像：钻套 ≤10 周，任意空窗 ≤2 周', () => {
  const { doneWeek, maxGap } = simulate(NORMAL, 12);
  expect(doneWeek).not.toBeNull();
  expect(doneWeek!).toBeLessThanOrEqual(10);
  expect(maxGap).toBeLessThanOrEqual(2);
});

test('跳级画像：只有第四章的星也能在 ≤9 周穿齐钻套（路径无关复验）', () => {
  const { p, doneWeek } = simulate(SKIPPER, 10);
  // 全程未使用任何低章星：星表里没有 <46 的关
  expect(Object.keys(p.stars).every((k) => Number(k) >= 46)).toBe(true);
  expect(doneWeek).not.toBeNull();
  expect(doneWeek!).toBeLessThanOrEqual(9);
});

test('弱画像：无死锁，钻套 ≤24 周，铁阶靠 4:1 兑换渡过', () => {
  // 实测 23 周，比评审 §F 估的 19–20 慢：关卡耗尽后钻收入只剩
  // P/200（0.175/周）+ 金→钻兑换，评审的 0.8 钻/周 偏乐观。
  // 无死锁成立即达标——弱孩子「只是慢」本就是评审的结论；
  // 若上线实测认为过慢，走 §G 判据调参（铁套 40→32 或 4:1→3:1），不改断言。
  const { p, doneWeek } = simulate(WEAK, 26);
  expect(doneWeek).not.toBeNull();
  expect(doneWeek!).toBeLessThanOrEqual(24);
  expect(p.rewards.traded.coalToIron).toBeGreaterThan(0); // 兑换阀确实被用到
});

test('顺序解锁全程成立：任何时刻 owned 不含未解锁阶的件', () => {
  // 用常规画像逐周检查（仿真过程中的每个中间态都合法）
  let p = defaultProgress();
  const cursor = { level: 1 };
  for (let w = 1; w <= 12; w++) {
    p = advanceWeek(p, NORMAL, cursor);
    p = spendWeek(p).p;
    for (let i = 1; i < TIER_ORDER.length; i++) {
      const tier = TIER_ORDER[i];
      const hasPiece = SLOT_ORDER.some((s) => p.rewards.owned.includes(`eq-${tier}-${s}`));
      if (hasPiece) {
        const prev = TIER_ORDER[i - 1];
        expect(SLOT_ORDER.every((s) => p.rewards.owned.includes(`eq-${prev}-${s}`))).toBe(true);
      }
    }
  }
});
