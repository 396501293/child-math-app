import { expect, test } from 'vitest';
import {
  PATTERN_STAR_TOTAL,
  SKY_LAYOUT,
  freeStarPositions,
  skyState,
} from '../../src/ui/components/skyPatterns';

// 自由点星（审查 D1）：第 46 颗起花 10 煤必须两处夜空可见。
// 坐标由星序号确定性派生，散布在图样间的空隙带；仍是同一 skyStars 计数。

test('图样星总数恒 64（表 C 45 + 第五章 19），skyState 溢出不炸', () => {
  expect(PATTERN_STAR_TOTAL).toBe(64);
  expect(SKY_LAYOUT.reduce((s, p) => s + p.stars.length, 0)).toBe(64);
  const st = skyState(70);
  expect(st.every((x) => x.complete)).toBe(true);
});

test('≤64 颗无自由星；第 65 颗起逐颗出现', () => {
  expect(freeStarPositions(0)).toEqual([]);
  expect(freeStarPositions(64)).toEqual([]);
  expect(freeStarPositions(65).length).toBe(1);
  expect(freeStarPositions(76).length).toBe(12);
});

test('确定性：同一计数两次调用坐标逐位相等；前缀稳定（加星不挪旧星）', () => {
  expect(freeStarPositions(80)).toEqual(freeStarPositions(80));
  const a = freeStarPositions(69);
  const b = freeStarPositions(70);
  expect(b.slice(0, a.length)).toEqual(a);
});

test('自由星落在天空带内，且与任何图样星不重叠（≥8px）', () => {
  const patternStars = SKY_LAYOUT.flatMap((p) => p.stars);
  for (const f of freeStarPositions(64 + 60)) {
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
