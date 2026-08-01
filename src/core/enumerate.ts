import type { Item, Op, PoolSpec, QuestionKind } from './types';

export const itemKey = (i: Item) => `${i.kind}|${i.ops.join('')}|${i.operands.join(',')}`;

// 二元题的运算符由题型推导：减法系 '−'，乘法系 '×'，除法系 '÷'，其余 '+'（chain3 用 pool.ops）
const opOf = (kind: QuestionKind): Op =>
  kind === 'sub' || kind === 'missing-sub' ? '-'
    : kind === 'mul' || kind === 'missing-mul-a' || kind === 'missing-mul-b' ? '×'
    : kind === 'div' || kind === 'missing-div-a' || kind === 'missing-div-b' ? '÷'
    : '+';

const isDivKind = (kind: QuestionKind): boolean =>
  kind === 'div' || kind === 'missing-div-a' || kind === 'missing-div-b';

export function enumeratePool(pool: PoolSpec): Item[] {
  const out: Item[] = [];
  // 除法域按 (商 a, 除数 b) 迭代，题面存 [a×b, b]——被除数恒在表内（规范 §0-1）
  for (let a = pool.aRange[0]; a <= pool.aRange[1]; a++)
    for (let b = pool.bRange[0]; b <= pool.bRange[1]; b++) {
      if (pool.kind === 'chain3') {
        for (let c = pool.cRange![0]; c <= pool.cRange![1]; c++)
          if (!pool.filter || pool.filter(a, b, c))
            out.push({
              kind: pool.kind,
              operands: pool.ops![0] === '÷' ? [a * b, b, c] : [a, b, c],
              ops: [...pool.ops!],
            });
      } else if (!pool.filter || pool.filter(a, b)) {
        out.push({
          kind: pool.kind,
          operands: isDivKind(pool.kind) ? [a * b, b] : [a, b],
          ops: [opOf(pool.kind)],
        });
      }
    }
  return out;
}
