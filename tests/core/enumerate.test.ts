import { expect, test } from 'vitest';
import { enumeratePool, itemKey } from '../../src/core/enumerate';

test('add pool: a+b<=5, operands>=1 has 10 items', () => {
  const items = enumeratePool({ kind: 'add', weight: 1, aRange: [1, 4], bRange: [1, 4],
    filter: (a, b) => a + b >= 2 && a + b <= 5 });
  expect(items).toHaveLength(10);
  for (const i of items) expect(i.operands[0] + i.operands[1]).toBeLessThanOrEqual(5);
});

test('chain3 pool respects stepwise bounds', () => {
  const items = enumeratePool({ kind: 'chain3', weight: 1, ops: ['+', '+'],
    aRange: [1, 10], bRange: [1, 10], cRange: [1, 10],
    filter: (a, b, c) => a + b <= 10 && a + b + c! <= 10 });
  expect(items).toHaveLength(120);
});

test('itemKey unique per item', () => {
  expect(itemKey({ kind: 'add', operands: [2, 3], ops: ['+'] }))
    .not.toBe(itemKey({ kind: 'missing-b', operands: [2, 3], ops: ['+'] }));
});
