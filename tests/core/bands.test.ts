import { expect, test } from 'vitest';
import { BANDS, bandOf } from '../../src/core/bands';
import { enumeratePool } from '../../src/core/enumerate';

const domainSize = (band: number) =>
  bandOf(band).pools.reduce((n, p) => n + enumeratePool(p).length, 0);

// 题库规范附录：42 个精确值（band → 组合数）
const EXACT: Record<number, number> = {
  1: 10, 2: 10, 3: 20, 4: 28, 5: 35, 6: 17, 7: 28, 8: 35, 9: 90,
  10: 45, 11: 45, 12: 90, 13: 36, 14: 45, 15: 181,
  16: 26, 17: 36, 18: 72, 19: 45, 20: 145, 21: 380, 22: 45, 23: 145,
  24: 570, 25: 120, 26: 2280, 27: 4940,
  31: 45, 32: 36, 33: 81, 34: 405, 35: 405, 36: 810, 37: 360, 38: 441,
  39: 801, 40: 360, 41: 396, 42: 756, 43: 4365, 44: 2880,
  45: 9693,   // 12 个子池合计（含跨池重复题面），见题库规范附录
};

test('all 45 bands exist with correct chapter', () => {
  expect(BANDS).toHaveLength(45);
  BANDS.forEach((b, i) => {
    expect(b.band).toBe(i + 1);
    expect(b.chapter).toBe(Math.ceil(b.band / 15));
  });
});

test('domain sizes match spec appendix exactly (42 bands)', () => {
  for (const [band, size] of Object.entries(EXACT)) expect(domainSize(+band), `band ${band}`).toBe(size);
});

test('challenge-mix bands 28-30 are at least as large as components', () => {
  expect(domainSize(28)).toBeGreaterThanOrEqual(36 + 36 + 1140 + 1140 + 4940 / 2);
  expect(domainSize(29)).toBe(570);
  expect(domainSize(30)).toBeGreaterThanOrEqual(570);
});

test('every item in every pool satisfies global constraints', () => {
  for (const cfg of BANDS) {
    const maxV = cfg.chapter === 3 ? 100 : 20;
    for (const pool of cfg.pools)
      for (const it of enumeratePool(pool)) {
        for (const n of it.operands) expect(n).toBeGreaterThanOrEqual(1);
        // 逐步结果 ∈ [1, maxV]
        let acc = it.operands[0];
        it.ops.forEach((op, k) => {
          acc = op === '+' ? acc + it.operands[k + 1] : acc - it.operands[k + 1];
          expect(acc).toBeGreaterThanOrEqual(1);
          expect(acc).toBeLessThanOrEqual(cfg.band <= 30 ? 20 : maxV);
        });
      }
  }
});
