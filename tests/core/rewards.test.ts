import { expect, test } from 'vitest';
import { defaultProgress } from '../../src/core/storage';
import type { Progress } from '../../src/core/types';
import {
  balance,
  craft,
  income,
  lightStar,
  tierUnlocked,
  trade,
} from '../../src/core/rewards';

// 收入公式（评审 §问3，原样照抄）：
//   煤 = #{star≥1} + floor(P/8)      铁 = Σ(star−1)      金 = floor(P/25)
//   钻 = floor(N★/10) + floor(P/200)  绿 = floor(litBest/3) + floor(bestStreak/10)
// P = rewards.practiceFirstTry（三练习模式累计首答即对）

function base(): Progress {
  return defaultProgress();
}

function withStars(p: Progress, stars: (1 | 2 | 3)[]): Progress {
  const s: Record<number, 0 | 1 | 2 | 3> = {};
  stars.forEach((v, i) => (s[i + 1] = v));
  return { ...p, stars: s };
}

test('默认进度收入全零', () => {
  expect(income(base())).toEqual({ coal: 0, iron: 0, gold: 0, diamond: 0, emerald: 0 });
});

test('手算样例：10 关（5×3★+3×2★+2×1★）→ 煤10 铁13', () => {
  const inc = income(withStars(base(), [3, 3, 3, 3, 3, 2, 2, 2, 1, 1]));
  expect(inc.coal).toBe(10);
  expect(inc.iron).toBe(5 * 2 + 3 * 1 + 2 * 0);
});

test('手算样例：P=207 → 煤+25 金8 钻+1', () => {
  const p = base();
  p.rewards.practiceFirstTry = 207;
  const inc = income(p);
  expect(inc.coal).toBe(25);
  expect(inc.gold).toBe(8);
  expect(inc.diamond).toBe(1);
});

test('手算样例：23 关得星 → 钻2；litBest=11 + bestStreak=27 → 绿5', () => {
  let p = withStars(base(), Array.from({ length: 23 }, () => 1 as const));
  expect(income(p).diamond).toBe(2);
  p = base();
  p.timesTable.litBest = 11;
  p.endless.bestStreak = 27;
  expect(income(p).emerald).toBe(3 + 2);
});

test('farm-proof：进度增长下收入逐项单调不减；重玩星级不变则收入不变', () => {
  const p = withStars(base(), [3, 2, 1]);
  p.rewards.practiceFirstTry = 40;
  const before = income(p);

  // 各类增长
  const grows: ((q: Progress) => Progress)[] = [
    (q) => ({ ...q, stars: { ...q.stars, 4: 1 } }),                    // 新关得星
    (q) => ({ ...q, stars: { ...q.stars, 3: 3 } }),                    // 星级提升
    (q) => ({ ...q, rewards: { ...q.rewards, practiceFirstTry: q.rewards.practiceFirstTry + 1 } }),
    (q) => ({ ...q, timesTable: { ...q.timesTable, litBest: 9 } }),
    (q) => ({ ...q, endless: { ...q.endless, bestStreak: 30 } }),
  ];
  for (const g of grows) {
    const after = income(g(structuredClone(p)));
    for (const k of ['coal', 'iron', 'gold', 'diamond', 'emerald'] as const)
      expect(after[k], k).toBeGreaterThanOrEqual(before[k]);
  }
  // 重玩同关同星：Progress 不变 → 收入不变（纯函数自证）
  expect(income(structuredClone(p))).toEqual(before);
});

// ── 消耗 / 余额 / 制作 ──

function richProgress(): Progress {
  // 足以买穿皮革阶的进度：30+ 煤
  const p = withStars(base(), Array.from({ length: 20 }, () => 3 as const));
  p.rewards.practiceFirstTry = 160; // 煤 +20 金 6
  return p;
}

test('craft 扣费入账：皮革靴 3 煤', () => {
  const p = richProgress();
  const b0 = balance(p);
  const p2 = craft(p, 'eq-leather-boots');
  expect(p2.rewards.owned).toContain('eq-leather-boots');
  expect(balance(p2).coal).toBe(b0.coal - 3);
  expect(p2.rewards.equipped.boots).toBe('eq-leather-boots'); // 制作即穿上
});

test('craft 幂等：重复制作原样返回', () => {
  const p2 = craft(richProgress(), 'eq-leather-boots');
  expect(craft(p2, 'eq-leather-boots')).toBe(p2);
});

test('craft 余额不足拒绝', () => {
  const p = base(); // 零收入
  expect(craft(p, 'eq-leather-boots')).toBe(p);
});

test('阶间顺序解锁：有 2 钻但皮革未齐时钻靴不可做', () => {
  const p = withStars(base(), Array.from({ length: 20 }, () => 1 as const)); // 钻2 煤20
  expect(balance(p).diamond).toBe(2);
  expect(tierUnlocked(p.rewards, 'leather')).toBe(true);
  expect(tierUnlocked(p.rewards, 'diamond')).toBe(false);
  expect(craft(p, 'eq-diamond-boots')).toBe(p); // 拒绝
});

test('皮革 4 件齐 → 铁阶解锁', () => {
  let p = richProgress();
  for (const s of ['boots', 'helm', 'legs', 'chest']) p = craft(p, `eq-leather-${s}`);
  expect(tierUnlocked(p.rewards, 'iron')).toBe(true);
  expect(tierUnlocked(p.rewards, 'gold')).toBe(false);
});

test('配件不受阶限制，只看余额；锚点自动摆放', () => {
  const p = craft(richProgress(), 'ac-torch'); // 5 煤 手持
  expect(p.rewards.owned).toContain('ac-torch');
  expect(p.rewards.equipped.accessories).toContain('ac-torch');
});

test('trade：4 煤→1 铁，余额守恒；不足拒绝；余额恒非负', () => {
  const p = richProgress();
  const b0 = balance(p);
  const p2 = trade(p, 'coalToIron');
  const b2 = balance(p2);
  expect(b2.coal).toBe(b0.coal - 4);
  expect(b2.iron).toBe(b0.iron + 1);
  expect(trade(base(), 'coalToIron')).toEqual(base()); // 不足
  for (const k of ['coal', 'iron', 'gold', 'diamond', 'emerald'] as const)
    expect(b2[k]).toBeGreaterThanOrEqual(0);
});

test('lightStar：10 煤一颗，不足拒绝', () => {
  const p = richProgress();
  const b0 = balance(p);
  const p2 = lightStar(p);
  expect(p2.rewards.skyStars).toBe(1);
  expect(balance(p2).coal).toBe(b0.coal - 10);
  expect(lightStar(base())).toEqual(base());
});
