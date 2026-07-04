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
