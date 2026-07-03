import type { Question } from '../../core/types';

// 题目行：完全由 Question 驱动，不含出题逻辑。
// 计算题 a op b = [?]（chain3 为 a op b op c = [?]）；缺数题把 missingIndex 处换成虚线框，结果以数字显示。

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string } | { t: 'box' };

const opChar = (op: string): string => (op === '-' ? '−' : '+'); // 减号用 U+2212

function buildTokens(q: Question): Tok[] {
  const toks: Tok[] = [];
  if (q.missingIndex === undefined) {
    // a op b (op c) = [?]
    toks.push({ t: 'num', v: q.operands[0] });
    q.ops.forEach((op, k) => {
      toks.push({ t: 'op', v: opChar(op) });
      toks.push({ t: 'num', v: q.operands[k + 1] });
    });
    toks.push({ t: 'op', v: '=' });
    toks.push({ t: 'box' });
    return toks;
  }
  // 缺数题：两操作数一运算符，结果 = a op b
  const result = q.ops[0] === '+' ? q.operands[0] + q.operands[1] : q.operands[0] - q.operands[1];
  toks.push(q.missingIndex === 0 ? { t: 'box' } : { t: 'num', v: q.operands[0] });
  toks.push({ t: 'op', v: opChar(q.ops[0]) });
  toks.push(q.missingIndex === 1 ? { t: 'box' } : { t: 'num', v: q.operands[1] });
  toks.push({ t: 'op', v: '=' });
  toks.push({ t: 'num', v: result });
  return toks;
}

// 字号自适应：chain3 或题面出现两位数（含缺数题的结果）时降到 76px（题库难度设计 §6）。
function isNarrow(q: Question): boolean {
  if (q.kind === 'chain3') return true;
  if (q.missingIndex === undefined) return q.operands.some((n) => n >= 10);
  const result = q.ops[0] === '+' ? q.operands[0] + q.operands[1] : q.operands[0] - q.operands[1];
  const shown = q.operands[1 - q.missingIndex];
  return shown >= 10 || result >= 10;
}

export function QuestionRow({ q }: { q: Question }) {
  const toks = buildTokens(q);
  return (
    <div class={isNarrow(q) ? 'mn-qrow mn-qrow--narrow' : 'mn-qrow'}>
      {toks.map((tk, i) => {
        if (tk.t === 'box') return <span key={i} class="mn-qrow-box">?</span>;
        if (tk.t === 'op') return <span key={i} class="mn-qrow-op">{tk.v}</span>;
        return <span key={i}>{tk.v}</span>;
      })}
    </div>
  );
}
