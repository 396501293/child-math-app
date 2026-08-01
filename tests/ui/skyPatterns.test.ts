import { expect, test } from 'vitest';
import {
  PATTERN_STAR_TOTAL,
  SKY_LAYOUT,
  freeStarPositions,
  skyState,
} from '../../src/ui/components/skyPatterns';

// 自由点星（审查 D1）：第 46 颗起花 10 煤必须两处夜空可见。
// 坐标由星序号确定性派生，散布在图样间的空隙带；仍是同一 skyStars 计数。

test('图样星总数恒 45（评审表 C），skyState 溢出不炸', () => {
  expect(PATTERN_STAR_TOTAL).toBe(45);
  expect(SKY_LAYOUT.reduce((s, p) => s + p.stars.length, 0)).toBe(45);
  const st = skyState(50);
  expect(st.every((x) => x.complete)).toBe(true);
});

test('≤45 颗无自由星；第 46 颗起逐颗出现', () => {
  expect(freeStarPositions(0)).toEqual([]);
  expect(freeStarPositions(45)).toEqual([]);
  expect(freeStarPositions(46).length).toBe(1);
  expect(freeStarPositions(57).length).toBe(12);
});

test('确定性：同一计数两次调用坐标逐位相等；前缀稳定（加星不挪旧星）', () => {
  expect(freeStarPositions(60)).toEqual(freeStarPositions(60));
  const a = freeStarPositions(50);
  const b = freeStarPositions(51);
  expect(b.slice(0, a.length)).toEqual(a);
});

test('自由星落在天空带内，且与任何图样星不重叠（≥8px）', () => {
  const patternStars = SKY_LAYOUT.flatMap((p) => p.stars);
  for (const f of freeStarPositions(45 + 60)) {
    expect(f.y).toBeGreaterThanOrEqual(40);
    expect(f.y).toBeLessThanOrEqual(130);
    expect(f.x).toBeGreaterThanOrEqual(80);
    expect(f.x).toBeLessThanOrEqual(962);
    for (const s of patternStars) {
      const d = Math.max(Math.abs(f.x - s.x), Math.abs(f.y - s.y));
      expect(d, `自由星(${f.x},${f.y}) 撞图样星(${s.x},${s.y})`).toBeGreaterThanOrEqual(8);
    }
  }
});
