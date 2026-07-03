import { expect, test } from 'vitest';
import { applyHardMode, generateLevel, generateQuestion } from '../../src/core/generator';
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
