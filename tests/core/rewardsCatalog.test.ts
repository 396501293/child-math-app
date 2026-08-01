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

test('37 个 id 唯一（20 装备 + 17 配件，含第五章）', () => {
  const ids = [...EQUIPMENT.map((e) => e.id), ...ACCESSORIES.map((a) => a.id)];
  expect(ids.length).toBe(37);
  expect(new Set(ids).size).toBe(37);
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
  // 第五章 §8.1：下界合金 12 钻 + 2 绿（腿/胸各 +1 绿，首个双材料定价）
  expect(priceOf('netherite')).toEqual([2, 3, 3, 4]);
  const nc2 = ['boots', 'helm', 'legs', 'chest'].map(
    (slot) => EQUIPMENT.find((e) => e.tier === 'netherite' && e.slot === slot)!.cost2,
  );
  expect(nc2).toEqual([undefined, undefined,
    { material: 'emerald', cost: 1 }, { material: 'emerald', cost: 1 }]);
});

test('装备材料 = 品阶直映射（皮革=煤 铁=铁 金=金 钻=钻 下界合金=钻主）', () => {
  const mat: Record<string, string> = { leather: 'coal', iron: 'iron', gold: 'gold', diamond: 'diamond', netherite: 'diamond' };
  for (const e of EQUIPMENT) expect(e.material, e.id).toBe(mat[e.tier]);
});

test('配件目录 17 件，总价 煤116/铁16/绿5（+第五章 §8.2 煤40/铁6），锚点合法', () => {
  expect(ACCESSORIES.length).toBe(17);
  const sum = (m: string) => ACCESSORIES.filter((a) => a.material === m).reduce((s, a) => s + a.cost, 0);
  expect(sum('coal')).toBe(116);
  expect(sum('iron')).toBe(16);
  expect(sum('emerald')).toBe(5);
  const anchors = new Set(['hand', 'feet', 'shoulder', 'side']);
  for (const a of ACCESSORIES) expect(anchors.has(a.anchor), a.id).toBe(true);
});

test('星空：7 个图样共 64 星（+第五章烈焰8/堡垒11），星价 10 煤', () => {
  expect(SKY_PATTERNS.length).toBe(7);
  expect(SKY_PATTERNS.reduce((s, p) => s + p.stars, 0)).toBe(64);
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

test('阶顺序：皮革→铁→金→钻→下界合金', () => {
  expect(TIER_ORDER).toEqual(['leather', 'iron', 'gold', 'diamond', 'netherite']);
});
