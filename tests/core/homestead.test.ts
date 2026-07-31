import { expect, test } from 'vitest';
import { defaultProgress } from '../../src/core/storage';
import type { Progress } from '../../src/core/types';
import { balance, placeBlock, removeBlock } from '../../src/core/rewards';
import { BLOCKS, BLOCK_PRICE_COAL, HOME_SIZE } from '../../src/core/rewardsCatalog';

// 建造层账目（评审 2026-07-31 §B）：homeGrid 非空格数计入 spent.coal，
// 收回无退款操作——余额是派生值，格子清空即回落。净零消耗是设计核心性质。

function rich(): Progress {
  const p = defaultProgress();
  const stars: Record<number, 0 | 1 | 2 | 3> = {};
  for (let i = 1; i <= 20; i++) stars[i] = 1;
  return { ...p, stars }; // 煤 20
}

test('方块目录：11 种 id 唯一，统一价 1 煤，地皮 144 格', () => {
  expect(BLOCKS.length).toBe(11);
  expect(new Set(BLOCKS.map((b) => b.id)).size).toBe(11);
  expect(BLOCKS.every((b) => b.id.startsWith('blk-'))).toBe(true);
  expect(BLOCK_PRICE_COAL).toBe(1); // 铁则：永久统一价，价格是常量不是字段
  expect(HOME_SIZE).toBe(144);
});

test('放置：扣 1 煤；收回：即时回落（无退款操作，派生自愈）', () => {
  const p = rich();
  const b0 = balance(p).coal;
  const p1 = placeBlock(p, 10, 'blk-wood');
  expect(p1.rewards.homeGrid[10]).toBe('blk-wood');
  expect(balance(p1).coal).toBe(b0 - 1);
  const p2 = removeBlock(p1, 10);
  expect(p2.rewards.homeGrid[10]).toBeNull();
  expect(balance(p2).coal).toBe(b0);
});

test('拒绝：格占用 / 煤不足 / 越界 / 未知方块——一律原样返回', () => {
  const p = placeBlock(rich(), 5, 'blk-stone');
  expect(placeBlock(p, 5, 'blk-wood')).toBe(p);       // 占用
  expect(placeBlock(p, -1, 'blk-wood')).toBe(p);      // 越界
  expect(placeBlock(p, 144, 'blk-wood')).toBe(p);     // 越界
  expect(placeBlock(p, 6, 'blk-nope')).toBe(p);       // 未知
  expect(removeBlock(p, 6)).toBe(p);                  // 空格收回
  const broke = defaultProgress();                    // 零煤
  expect(placeBlock(broke, 0, 'blk-wood')).toBe(broke);
});

test('净零性质：放 N 块再全收回 → 余额与初始逐项相等', () => {
  let p = rich();
  const b0 = balance(p);
  const spots = [0, 7, 33, 90, 143];
  for (const i of spots) p = placeBlock(p, i, BLOCKS[i % BLOCKS.length].id);
  expect(balance(p).coal).toBe(b0.coal - spots.length);
  for (const i of spots) p = removeBlock(p, i);
  expect(balance(p)).toEqual(b0);
});

test('迁移：旧档无 homeGrid → 144 全 null', () => {
  const p = defaultProgress();
  expect(p.rewards.homeGrid.length).toBe(144);
  expect(p.rewards.homeGrid.every((x) => x === null)).toBe(true);
});
