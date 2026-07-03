import type { Item, Rng } from './types';
import { shuffle } from './rand';

/**
 * 3 options = answer + 2 distractors, deduped & shuffled. Candidate priority: at most ONE
 * special distractor (flipped-op a∓b for add/sub kinds at band≥7, else chapter-3 tens-shift
 * ±10, each at 50%), then distance candidates answer±d, then fallback widening d until 2 found.
 * All distractors clamped to [1, 20] (bands ≤30) / [1, 100] (bands ≥31), never == answer.
 */
export function makeOptions(item: Item, answer: number, band: number, rng: Rng): number[] {
  const maxV = band <= 30 ? 20 : 100;
  const isTens = band >= 31 && item.operands.every(n => n % 10 === 0);
  const dists = isTens ? [10, 20] : band <= 6 ? [2, 3] : [1, 2];
  const ok = (v: number) => v >= 1 && v <= maxV && v !== answer;
  const cands: number[] = [];

  // 特殊干扰（优先，但最多占一个名额）
  if (band >= 7 && (item.kind === 'add' || item.kind === 'sub') && rng() < 0.5) {
    const [a, b] = item.operands;
    const flipped = item.kind === 'add' ? a - b : a + b;
    if (ok(flipped)) cands.push(flipped);
  }
  if (band >= 31 && !isTens && cands.length === 0 && rng() < 0.5) {
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
