import { expect, test } from 'vitest';
import { makeOptions } from '../../src/core/options';
import { seeded } from './helpers';

const addItem = (a: number, b: number) => ({ kind: 'add' as const, operands: [a, b], ops: ['+' as const] });
const subItem = (a: number, b: number) => ({ kind: 'sub' as const, operands: [a, b], ops: ['-' as const] });

test('always 3 unique options containing the answer, in range', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const opts = makeOptions(subItem(3, 2), 1, 3, seeded(seed));   // correct=1, 档3
    expect(new Set(opts).size).toBe(3);
    expect(opts).toContain(1);
    for (const o of opts) { expect(o).toBeGreaterThanOrEqual(1); expect(o).toBeLessThanOrEqual(20); }
  }
});

test('correct=1 at band<=6 yields distractors {3,4}', () => {
  const opts = makeOptions(subItem(3, 2), 1, 3, seeded(7));
  expect([...opts].sort((x, y) => x - y)).toEqual([1, 3, 4]);
});

test('correct=19 at band 10: 21 clamped out', () => {
  for (let s = 1; s <= 100; s++)
    for (const o of makeOptions(addItem(12, 7), 19, 10, seeded(s))) expect(o).toBeLessThanOrEqual(20);
});

test('flipped distractor never out of range or equal to answer (17-4 → 21 discarded)', () => {
  for (let s = 1; s <= 200; s++) {
    const opts = makeOptions(subItem(17, 4), 13, 11, seeded(s));
    expect(opts).not.toContain(21);
  }
});

test('tens bands use d in {10,20}', () => {
  for (let s = 1; s <= 50; s++) {
    const opts = makeOptions(addItem(30, 20), 50, 31, seeded(s));
    expect(new Set(opts).size).toBe(3);
    for (const o of opts) expect(o % 10).toBe(0);
  }
});

test('chapter-3 options clamped to [1,100]', () => {
  for (let s = 1; s <= 100; s++) {
    const opts = makeOptions(addItem(50, 50), 100, 31, seeded(s));
    expect(new Set(opts).size).toBe(3);
    for (const o of opts) {
      expect(o).toBeGreaterThanOrEqual(1); expect(o).toBeLessThanOrEqual(100);
    }
  }
});

test('flipped distractor is produced for sub at band>=7 (8-3 → 11 appears)', () => {
  let flippedSeen = false;
  for (let s = 1; s <= 200; s++) {
    const opts = makeOptions(subItem(8, 3), 5, 8, seeded(s));
    expect(new Set(opts).size).toBe(3);
    expect(opts).toContain(5);
    for (const o of opts) { expect(o).toBeGreaterThanOrEqual(1); expect(o).toBeLessThanOrEqual(20); }
    if (opts.includes(11)) flippedSeen = true;   // 11 = 8+3，距离干扰只会给 3,4,6,7
  }
  expect(flippedSeen).toBe(true);
});

test('chapter-3 tens-shift distractor is produced (23+5 → 18 or 38 appears)', () => {
  let shiftSeen = false;
  for (let s = 1; s <= 200; s++) {
    const opts = makeOptions(addItem(23, 5), 28, 34, seeded(s));
    if (opts.includes(18) || opts.includes(38)) shiftSeen = true;  // 距离干扰只会给 26,27,29,30
  }
  expect(shiftSeen).toBe(true);
});

test('missing-* kinds never get a flipped distractor', () => {
  const item = { kind: 'missing-b' as const, operands: [9, 6], ops: ['+' as const] };
  for (let s = 1; s <= 200; s++) {
    const opts = makeOptions(item, 6, 15, seeded(s));
    expect(opts).not.toContain(15);   // 15 = 9+6；d∈{1,2} 距离干扰只会给 4,5,7,8
  }
});
