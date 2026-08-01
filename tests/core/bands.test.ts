import { expect, test } from 'vitest';
import { BANDS, bandOf } from '../../src/core/bands';
import { enumeratePool } from '../../src/core/enumerate';

const domainSize = (band: number) =>
  bandOf(band).pools.reduce((n, p) => n + enumeratePool(p).length, 0);

// 题库规范附录：精确值（band → 组合数）
const EXACT: Record<number, number> = {
  1: 10, 2: 10, 3: 20, 4: 28, 5: 35, 6: 17, 7: 28, 8: 35, 9: 90,
  10: 45, 11: 45, 12: 90, 13: 36, 14: 45, 15: 181,
  16: 26, 17: 36, 18: 72, 19: 45, 20: 145, 21: 380, 22: 45, 23: 145,
  24: 570, 25: 120, 26: 2280, 27: 4940,
  31: 45, 32: 36, 33: 81, 34: 405, 35: 405, 36: 810, 37: 360, 38: 441,
  39: 801, 40: 360, 41: 396, 42: 756, 43: 4365, 44: 2880,
  45: 9693,   // 12 个子池合计（含跨池重复题面），见题库规范附录
  // 第四章「银河」档 46–60（脚本验算，见附录）
  // 档 46 +8（附录 A 乘法桥连加子池）；52/53/54/58/60 剔平方 −8/−8/−16/−16/−16（附录 B）
  46: 40, 47: 32, 48: 56, 49: 32, 50: 32, 51: 64, 52: 56, 53: 56, 54: 112,
  55: 2880, 56: 4464, 57: 1872, 58: 176, 59: 6336, 60: 9392,
  // 第五章「下界」档 61–75（规范 §2/§7 EXACT 表）
  61: 23, 62: 23, 63: 16, 64: 16, 65: 32, 66: 64, 67: 56, 68: 64, 69: 120,
  70: 128, 71: 232, 72: 360, 73: 6336, 74: 12672, 75: 13032,
};

test('bandOf throws RangeError outside 1..75', () => {
  expect(() => bandOf(0)).toThrow();
  expect(() => bandOf(76)).toThrow();
});

test('all 75 bands exist with correct chapter', () => {
  expect(BANDS).toHaveLength(75);
  BANDS.forEach((b, i) => {
    expect(b.band).toBe(i + 1);
    expect(b.chapter).toBe(Math.ceil(b.band / 15));
  });
});

test('domain sizes match spec appendix exactly', () => {
  for (const [band, size] of Object.entries(EXACT)) expect(domainSize(+band), `band ${band}`).toBe(size);
});

test('challenge-mix bands 28-30 are at least as large as components', () => {
  expect(domainSize(28)).toBeGreaterThanOrEqual(36 + 36 + 1140 + 1140 + 4940 / 2);
  expect(domainSize(29)).toBe(570);
  expect(domainSize(30)).toBeGreaterThanOrEqual(570);
});

test('every item in every pool satisfies global constraints', () => {
  for (const cfg of BANDS) {
    const maxV = cfg.band <= 30 ? 20 : 100; // 章一二 20；章三四五 100
    for (const pool of cfg.pools)
      for (const it of enumeratePool(pool)) {
        for (const n of it.operands) expect(n).toBeGreaterThanOrEqual(1);
        // 逐步结果 ∈ [1, maxV]（含乘除折叠）
        let acc = it.operands[0];
        it.ops.forEach((op, k) => {
          const operand = it.operands[k + 1];
          acc = op === '+' ? acc + operand : op === '-' ? acc - operand
            : op === '÷' ? acc / operand : acc * operand;
          expect(acc).toBeGreaterThanOrEqual(1);
          expect(acc).toBeLessThanOrEqual(maxV);
        });
      }
  }
});


// ── 第五章性质断言（规范 §7）──

test('除法域：被除数恒 = 商×除数且在表内；商/除数 ∈ [2,9]', () => {
  for (const band of [63, 64, 65, 66, 67, 68]) {
    for (const pool of bandOf(band).pools)
      for (const it of enumeratePool(pool)) {
        const [c, b] = it.operands;
        expect(c % b, `${band}: ${c}÷${b}`).toBe(0);
        const q = c / b;
        expect(q).toBeGreaterThanOrEqual(2); expect(q).toBeLessThanOrEqual(9);
        expect(b).toBeGreaterThanOrEqual(2); expect(b).toBeLessThanOrEqual(9);
      }
  }
});

test('档 67/71：c÷?=a 与乘法缺数域内无平方组合（泄底剔除）', () => {
  for (const band of [67, 71]) {
    for (const pool of bandOf(band).pools)
      for (const it of enumeratePool(pool)) {
        if (it.kind === 'missing-div-b') expect(it.operands[0] / it.operands[1]).not.toBe(it.operands[1]);
        if (it.kind === 'missing-mul-b' || it.kind === 'missing-mul-a')
          expect(it.operands[0]).not.toBe(it.operands[1]);
      }
  }
});

test('档 73/74：两步题中间与最终结果 ∈ [1,100]', () => {
  for (const band of [73, 74]) {
    for (const pool of bandOf(band).pools)
      for (const it of enumeratePool(pool)) {
        const s1 = it.ops[0] === '÷' ? it.operands[0] / it.operands[1] : it.operands[0] * it.operands[1];
        const s2 = it.ops[1] === '+' ? s1 + it.operands[2] : s1 - it.operands[2];
        expect(s1).toBeGreaterThanOrEqual(1); expect(s1).toBeLessThanOrEqual(100);
        expect(s2).toBeGreaterThanOrEqual(1); expect(s2).toBeLessThanOrEqual(100);
      }
  }
});

test('档 46 乘法桥：连加子池 8 题面全为 n+n+n', () => {
  const chain = bandOf(46).pools.find((p) => p.kind === 'chain3')!;
  const items = enumeratePool(chain);
  expect(items).toHaveLength(8);
  for (const it of items) {
    expect(it.operands[0]).toBe(it.operands[1]);
    expect(it.operands[1]).toBe(it.operands[2]);
  }
});
