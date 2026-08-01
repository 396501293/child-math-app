import type { Item, Rng } from './types';
import { shuffle } from './rand';

/**
 * 3 options = answer + 2 distractors, deduped & shuffled. Candidate priority: for 纯乘法题
 * (kind 'mul') up to TWO 口诀邻位 candidates (a±1)×b / a×(b±1); else at most ONE special
 * distractor (flipped-op a∓b for add/sub kinds at band≥7, else tens-shift ±10 — 加减/连算题在
 * 档 31+ 适用，mul/missing-mul 一律不出 — each at 50%); then distance candidates answer±d,
 * then fallback widening d until 2 found. All distractors clamped to [1, 20] (bands ≤30) /
 * [1, 100] (bands ≥31), never == answer.
 */
export function makeOptions(item: Item, answer: number, band: number, rng: Rng): number[] {
  const maxV = band <= 30 ? 20 : 100;
  const isTens = band >= 31 && item.operands.every(n => n % 10 === 0);
  const dists = isTens ? [10, 20] : band <= 6 ? [2, 3] : [1, 2];
  const ok = (v: number) => v >= 1 && v <= maxV && v !== answer;
  const cands: number[] = [];

  // 乘法「口诀邻位」干扰（仅纯乘法题，优先，最多占两个名额）
  if (item.kind === 'mul') {
    const [a, b] = item.operands;
    for (const v of shuffle([(a - 1) * b, (a + 1) * b, a * (b - 1), a * (b + 1)], rng)) {
      if (cands.length >= 2) break;
      if (ok(v) && !cands.includes(v)) cands.push(v);
    }
  }

  // ── 除法错误模型（第五章规范 §4；operands 恒为 [c, b]，商 = c/b）──
  if (item.kind === 'div') {
    const [c, b] = item.operands;
    const quot = c / b;
    // ① 商邻位 q±1（口诀串行在商侧的镜像）
    for (const v of shuffle([quot - 1, quot + 1], rng))
      if (cands.length < 2 && ok(v) && !cands.includes(v)) cands.push(v);
    // ② 减法混淆 c−b（「把 ÷ 看成 −」），50% 概率替换一枚商邻位
    const subConf = c - b;
    if (rng() < 0.5 && ok(subConf) && !cands.includes(subConf)) {
      if (cands.length >= 2) cands[1] = subConf;
      else cands.push(subConf);
    }
  }
  if (item.kind === 'missing-div-b') {
    const [c, b] = item.operands;
    // ③ 同积异对：c 的另一组表内分解的除数 d（「拿错口诀家族」；允许 d = 可见商）
    const alts: number[] = [];
    for (let d = 2; d <= 9; d++)
      if (d !== b && c % d === 0 && c / d >= 2 && c / d <= 9) alts.push(d);
    for (const v of shuffle(alts, rng))
      if (cands.length < 2 && ok(v) && !cands.includes(v)) cands.push(v);
    // 无异对回落除数邻位 b±1
    for (const v of shuffle([b - 1, b + 1], rng))
      if (cands.length < 2 && ok(v) && !cands.includes(v)) cands.push(v);
  }
  if (item.kind === 'missing-div-a') {
    const [c, b] = item.operands;
    const quot = c / b;
    // ④ 口诀邻位积（继承第四章）：(q±1)×b、q×(b±1)
    for (const v of shuffle([(quot - 1) * b, (quot + 1) * b, quot * (b - 1), quot * (b + 1)], rng)) {
      if (cands.length >= 2) break;
      if (ok(v) && !cands.includes(v)) cands.push(v);
    }
  }
  // ⑤ 半途干扰（两步题首选，档 73/74/75）：第一步中间结果——「只做了一步」
  if (item.kind === 'chain3' && band >= 61 && (item.ops[0] === '÷' || item.ops[0] === '×')) {
    const s1 = item.ops[0] === '÷' ? item.operands[0] / item.operands[1] : item.operands[0] * item.operands[1];
    if (ok(s1) && !cands.includes(s1)) cands.unshift(s1);
  }

  // 特殊干扰（优先，但最多占一个名额）
  if (band >= 7 && (item.kind === 'add' || item.kind === 'sub') && rng() < 0.5) {
    const [a, b] = item.operands;
    const flipped = item.kind === 'add' ? a - b : a + b;
    if (ok(flipped)) cands.push(flipped);
  }
  const additive = item.kind === 'add' || item.kind === 'sub' || item.kind === 'chain3';
  if (band >= 31 && additive && !isTens && cands.length === 0 && rng() < 0.5) {
    const shifted = answer + (rng() < 0.5 ? 10 : -10);
    if (ok(shifted)) cands.push(shifted);
  }

  // 距离干扰
  const near = shuffle(dists.flatMap(d => [answer + d, answer - d]), rng).filter(ok);
  for (const v of near) if (!cands.includes(v)) cands.push(v);

  // 兜底扩距
  for (let d = Math.max(...dists) + 1; cands.length < 2 && d <= maxV; d++)
    for (const v of [answer + d, answer - d])
      if (ok(v) && !cands.includes(v)) cands.push(v);

  return shuffle([answer, ...cands.slice(0, 2)], rng);
}
