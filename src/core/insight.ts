import type { Question } from './types';

// 题面文本（审查 D2 错题缓冲用）：与 QuestionRow 渲染同一套符号约定
// （减号 U+2212、乘号 U+00D7），家长在面板里看到的就是孩子屏幕上的那道题。

const opChar = (op: string): string => (op === '-' ? '−' : op === '×' ? '×' : '+');

const evalOp = (a: number, b: number, op: string): number =>
  op === '-' ? a - b : op === '×' ? a * b : a + b;

export function eqText(q: Question): string {
  if (q.missingIndex === undefined) {
    const parts = [String(q.operands[0])];
    q.ops.forEach((op, k) => parts.push(opChar(op), String(q.operands[k + 1])));
    return `${parts.join(' ')} = ?`;
  }
  const result = evalOp(q.operands[0], q.operands[1], q.ops[0]);
  const left = q.missingIndex === 0 ? '?' : String(q.operands[0]);
  const right = q.missingIndex === 1 ? '?' : String(q.operands[1]);
  return `${left} ${opChar(q.ops[0])} ${right} = ${result}`;
}
