import { expect, test } from 'vitest';
import { allocate, applyHardMode, generateLevel, generateQuestion } from '../../src/core/generator';
import { bandOf } from '../../src/core/bands';
import { itemKey } from '../../src/core/enumerate';
import { seeded } from './helpers';

test('every band: 500 sampled questions satisfy invariants', () => {
  for (let band = 1; band <= 45; band++) {
    const cfg = bandOf(band);
    const rng = seeded(band * 97);
    for (let n = 0; n < 500; n++) {
      const q = generateQuestion(cfg, rng, []);
      expect(new Set(q.options).size).toBe(3);
      expect(q.options).toContain(q.answer);
      if (q.missingIndex !== undefined) expect(q.answer).toBe(q.operands[q.missingIndex]);
      expect(q.ttsText.length).toBeGreaterThan(0);
      if (cfg.chapter === 3) expect(q.blocksPlan).toBeUndefined();
      else { expect(q.blocksPlan).toBeDefined(); expect(q.blocksHint).toBeDefined(); }
    }
  }
});

test('band 15 level of 5 = exactly 3 missing + 2 carry', () => {
  for (let s = 1; s <= 30; s++) {
    const qs = generateLevel(bandOf(15), 5, seeded(s));
    expect(qs.filter(q => q.kind === 'missing-b')).toHaveLength(3);
    expect(qs.filter(q => q.kind === 'add')).toHaveLength(2);
  }
});

test('level questions unique and sorted by answer', () => {
  for (let band = 1; band <= 45; band++) {
    const qs = generateLevel(bandOf(band), 10, seeded(band));
    expect(new Set(qs.map(q => itemKey(q))).size).toBe(10);
    for (let i = 1; i < qs.length; i++) expect(qs[i].answer).toBeGreaterThanOrEqual(qs[i - 1].answer);
  }
});

test('recentKeys are avoided when possible', () => {
  const cfg = bandOf(1); // 域只有 10
  const rng = seeded(42);
  const recent: string[] = [];
  for (let n = 0; n < 8; n++) {
    const q = generateQuestion(cfg, rng, recent);
    expect(recent).not.toContain(itemKey(q));
    recent.push(itemKey(q));
    if (recent.length > 5) recent.shift();
  }
});

test('applyHardMode converts addition pools to missing-b in same domain', () => {
  const hard = applyHardMode(bandOf(13));
  expect(hard.pools[0].kind).toBe('missing-b');
  const q = generateQuestion(hard, seeded(1), []);
  expect(q.kind).toBe('missing-b');
  expect(q.operands[0] + q.operands[1]).toBeGreaterThanOrEqual(11); // 数域不变
  const hardSub = applyHardMode(bandOf(17));
  expect(hardSub.pools[0].kind).toBe('sub'); // 减法不变
});

test('generateQuestion on band 15: missing-b share ~60% (two-stage weighted, not merged-domain)', () => {
  const rng = seeded(15);
  const N = 2000;
  let missing = 0;
  for (let n = 0; n < N; n++) if (generateQuestion(bandOf(15), rng, []).kind === 'missing-b') missing++;
  const share = missing / N;
  expect(share).toBeGreaterThan(0.5);   // 合并域均匀抽样会得 ~0.8（145/181）
  expect(share).toBeLessThan(0.7);
});

test('allocate remainder: band 3 equal weights, count 5 → only 3+2 or 2+3', () => {
  for (let s = 1; s <= 50; s++) {
    const alloc = allocate(bandOf(3), 5, seeded(s));
    expect(alloc.reduce((a, b) => a + b, 0)).toBe(5);
    for (const n of alloc) expect(n).toBeGreaterThanOrEqual(2);   // floor(0.5×5)=2 保底
  }
});

test('content pins per kind: tts wording and blocksPlan shape', () => {
  const q1 = generateQuestion(bandOf(1), seeded(11), []);
  expect(q1.kind).toBe('add');
  expect(q1.ttsText).toMatch(/^\d+ 加 \d+ 等于几？$/);
  expect(q1.blocksPlan).toEqual({ type: 'two-group', a: q1.operands[0], b: q1.operands[1] });

  const q2 = generateQuestion(bandOf(2), seeded(22), []);
  expect(q2.kind).toBe('sub');
  expect(q2.ttsText).toMatch(/减.*等于几/);
  expect(q2.blocksPlan).toEqual({ type: 'divide-out', total: q2.operands[0], crossOut: q2.operands[1] });

  const q14 = generateQuestion(bandOf(14), seeded(14), []);
  expect(q14.kind).toBe('missing-b');
  expect(q14.ttsText).toContain('加上几，等于');
  expect(q14.blocksPlan).toEqual({ type: 'fill-slot', filled: q14.operands[0], empty: q14.answer, filledFirst: true });

  const q19 = generateQuestion(bandOf(19), seeded(19), []);
  expect(q19.kind).toBe('missing-a');
  expect(q19.ttsText).toContain('几加上');
  expect(q19.blocksPlan).toEqual({ type: 'fill-slot', filled: q19.operands[1], empty: q19.operands[0], filledFirst: false });

  const q22 = generateQuestion(bandOf(22), seeded(2), []);
  expect(q22.kind).toBe('missing-sub');
  expect(q22.ttsText).toContain('减去几，等于');
  expect(q22.blocksPlan).toEqual({ type: 'keep-mark', total: q22.operands[0], keep: q22.operands[0] - q22.operands[1] });

  const q25 = generateQuestion(bandOf(25), seeded(25), []);
  expect(q25.kind).toBe('chain3');
  expect(q25.ttsText).toContain('再');
  expect(q25.blocksPlan).toEqual({ type: 'three-group',
    groups: [q25.operands[0], q25.operands[1], q25.operands[2]], ops: ['+', '+'] });
});

test('applyHardMode does not mutate the source config', () => {
  applyHardMode(bandOf(13));
  expect(bandOf(13).pools[0].kind).toBe('add');
});
