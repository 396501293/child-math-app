import { expect, test } from 'vitest';
import {
  ACCESSORIES,
  EQUIPMENT,
  SKY_PATTERNS,
  STAR_PRICE_COAL,
  TIER_ORDER,
  TRADE_CHAIN,
} from '../../src/core/rewardsCatalog';

// 目录数值的权威来源是 docs/edu-pm-reviews/2026-07-30-steve-raise-review.md
// §数值规范表。此处逐项断言，防止实现时抄错数——经济数值错一个，
// 三画像时间线全盘失效。

test('28 个 id 唯一', () => {
  const ids = [...EQUIPMENT.map((e) => e.id), ...ACCESSORIES.map((a) => a.id)];
  expect(ids.length).toBe(28);
  expect(new Set(ids).size).toBe(28);
});

test('装备件价与评审表 A 逐项相等（件序恒为 靴/盔/腿/胸）', () => {
  const priceOf = (tier: string) =>
    ['boots', 'helm', 'legs', 'chest'].map(
      (slot) => EQUIPMENT.find((e) => e.tier === tier && e.slot === slot)!.cost,
    );
  expect(priceOf('leather')).toEqual([3, 6, 9, 12]);
  expect(priceOf('iron')).toEqual([5, 8, 12, 15]);
  expect(priceOf('gold')).toEqual([3, 5, 7, 9]);
  expect(priceOf('diamond')).toEqual([2, 2, 3, 5]);
});

test('装备材料 = 品阶直映射（皮革=煤 铁=铁 金=金 钻=钻）', () => {
  const mat: Record<string, string> = { leather: 'coal', iron: 'iron', gold: 'gold', diamond: 'diamond' };
  for (const e of EQUIPMENT) expect(e.material, e.id).toBe(mat[e.tier]);
});

test('配件目录 12 件，总价 煤76/铁10/绿5，锚点合法', () => {
  expect(ACCESSORIES.length).toBe(12);
  const sum = (m: string) => ACCESSORIES.filter((a) => a.material === m).reduce((s, a) => s + a.cost, 0);
  expect(sum('coal')).toBe(76);
  expect(sum('iron')).toBe(10);
  expect(sum('emerald')).toBe(5);
  const anchors = new Set(['hand', 'feet', 'shoulder', 'side']);
  for (const a of ACCESSORIES) expect(anchors.has(a.anchor), a.id).toBe(true);
});

test('星空：5 个图样共 45 星，星价 10 煤', () => {
  expect(SKY_PATTERNS.length).toBe(5);
  expect(SKY_PATTERNS.reduce((s, p) => s + p.stars, 0)).toBe(45);
  expect(STAR_PRICE_COAL).toBe(10);
});

test('兑换链 4:1 四段只向上', () => {
  expect(TRADE_CHAIN).toEqual([
    { kind: 'coalToIron', from: 'coal', to: 'iron', rate: 4 },
    { kind: 'ironToGold', from: 'iron', to: 'gold', rate: 4 },
    { kind: 'goldToDiamond', from: 'gold', to: 'diamond', rate: 4 },
    { kind: 'diamondToEmerald', from: 'diamond', to: 'emerald', rate: 4 },
  ]);
});

test('阶顺序：皮革→铁→金→钻', () => {
  expect(TIER_ORDER).toEqual(['leather', 'iron', 'gold', 'diamond']);
});
