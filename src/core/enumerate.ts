import type { Item, Op, PoolSpec, QuestionKind } from './types';

export const itemKey = (i: Item) => `${i.kind}|${i.ops.join('')}|${i.operands.join(',')}`;

// 二元题的运算符由题型推导：减法系 '−'，乘法系 '×'，其余 '+'（chain3 用 pool.ops）
const opOf = (kind: QuestionKind): Op =>
  kind === 'sub' || kind === 'missing-sub' ? '-'
    : kind === 'mul' || kind === 'missing-mul-a' || kind === 'missing-mul-b' ? '×'
    : '+';

export function enumeratePool(pool: PoolSpec): Item[] {
  const out: Item[] = [];
  for (let a = pool.aRange[0]; a <= pool.aRange[1]; a++)
    for (let b = pool.bRange[0]; b <= pool.bRange[1]; b++) {
      if (pool.kind === 'chain3') {
        for (let c = pool.cRange![0]; c <= pool.cRange![1]; c++)
          if (!pool.filter || pool.filter(a, b, c)) out.push({ kind: pool.kind, operands: [a, b, c], ops: [...pool.ops!] });
      } else if (!pool.filter || pool.filter(a, b)) {
        out.push({ kind: pool.kind, operands: [a, b], ops: [opOf(pool.kind)] });
      }
    }
  return out;
}
