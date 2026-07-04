import { expect, test } from 'vitest';
import {
  MAX_NEW_PER_SESSION,
  SESSION_SIZE,
  TimesTableSession,
  activeFacts,
  allFacts,
  arrayHint,
  buildQuestion,
  factKey,
  factOf,
  koujue,
  learnedTables,
  masteryWeight,
  missingQuestionText,
  onFirstCorrect,
  onRetryCorrect,
  onWrong,
  planSession,
  questionText,
} from '../../src/core/timesTable';
import type { FactState } from '../../src/core/timesTable';
import { defaultProgress } from '../../src/core/storage';
import type { Progress } from '../../src/core/types';
import { seeded } from './helpers';

// ── helpers ──
const learned = (...bands: number[]): Progress => {
  const p = defaultProgress();
  for (const b of bands) p.stars[b] = 1;
  return p;
};
const withStates = (p: Progress, s: FactState): Progress => {
  const q = defaultProgress();
  q.stars = { ...p.stars };
  for (const f of activeFacts(p)) q.timesTable.facts[f.key] = { ...s };
  return q;
};

// ── 1. Fact model ──

test('allFacts: exactly 36 canonical small-first facts, 2≤a≤b≤9, no ×1', () => {
  const facts = allFacts();
  expect(facts).toHaveLength(36);
  expect(new Set(facts.map((f) => f.key)).size).toBe(36);
  for (const f of facts) {
    expect(f.a).toBeGreaterThanOrEqual(2);
    expect(f.b).toBeLessThanOrEqual(9);
    expect(f.a).toBeLessThanOrEqual(f.b); // small-first
    expect(f.key).toBe(`${f.a}×${f.b}`);
  }
});

test('factKey is canonical (order-independent) and factOf inverts it', () => {
  expect(factKey(3, 2)).toBe('2×3');
  expect(factKey(2, 3)).toBe('2×3');
  expect(factKey(9, 9)).toBe('9×9');
  expect(factOf('7×8')).toEqual({ a: 7, b: 8, key: '7×8' });
  for (const f of allFacts()) expect(factOf(f.key)).toEqual(f);
});

// ── 2. Mastery state machine ──

test('onFirstCorrect: s+1 capped at 3, cd = new s (rest longer when stronger)', () => {
  expect(onFirstCorrect({ s: 0, cd: 0 })).toEqual({ s: 1, cd: 1 });
  expect(onFirstCorrect({ s: 1, cd: 0 })).toEqual({ s: 2, cd: 2 });
  expect(onFirstCorrect({ s: 2, cd: 0 })).toEqual({ s: 3, cd: 3 });
  expect(onFirstCorrect({ s: 3, cd: 3 })).toEqual({ s: 3, cd: 3 }); // ceiling
});

test('onRetryCorrect: s unchanged (no full reward for a retry), cd = 1', () => {
  expect(onRetryCorrect({ s: 0, cd: 5 })).toEqual({ s: 0, cd: 1 });
  expect(onRetryCorrect({ s: 2, cd: 2 })).toEqual({ s: 2, cd: 1 });
  expect(onRetryCorrect({ s: 3, cd: 3 })).toEqual({ s: 3, cd: 1 });
});

test('onWrong: s-1 floored at 0, cd=0 so it is due again soon (no lockout, no visible penalty)', () => {
  expect(onWrong({ s: 3, cd: 3 })).toEqual({ s: 2, cd: 0 });
  expect(onWrong({ s: 1, cd: 0 })).toEqual({ s: 0, cd: 0 });
  expect(onWrong({ s: 0, cd: 0 })).toEqual({ s: 0, cd: 0 }); // floor
});

test('masteryWeight: weak-first ordering with due/not-due split', () => {
  expect(masteryWeight({ s: 0, cd: 0 })).toBe(5);
  expect(masteryWeight({ s: 1, cd: 0 })).toBe(4);
  expect(masteryWeight({ s: 2, cd: 0 })).toBe(2.5); // due
  expect(masteryWeight({ s: 2, cd: 2 })).toBe(0.8); // not due
  expect(masteryWeight({ s: 3, cd: 0 })).toBe(1); // lit + due
  expect(masteryWeight({ s: 3, cd: 2 })).toBe(0.3); // lit + resting
});

// ── 3. Gating (main-line progress → learnable facts) ──

test('learnedTables grows with mul-band stars; band 51 unlocks all', () => {
  expect(learnedTables(defaultProgress())).toEqual(new Set());
  expect(learnedTables(learned(46))).toEqual(new Set([2, 5]));
  expect(learnedTables(learned(46, 47))).toEqual(new Set([2, 3, 4, 5]));
  expect(learnedTables(learned(46, 47, 49))).toEqual(new Set([2, 3, 4, 5, 6, 7]));
  expect(learnedTables(learned(46, 47, 49, 50))).toEqual(new Set([2, 3, 4, 5, 6, 7, 8, 9]));
  expect(learnedTables(learned(51))).toEqual(new Set([2, 3, 4, 5, 6, 7, 8, 9]));
});

test('activeFacts gated: only facts whose a or b is a learned table', () => {
  expect(activeFacts(defaultProgress())).toHaveLength(0);
  const a46 = activeFacts(learned(46)).map((f) => f.key);
  expect(a46).toContain('2×9'); // ×2 table
  expect(a46).toContain('5×9'); // ×5 table (五九四十五)
  expect(a46).toContain('2×5');
  expect(a46).not.toContain('6×7'); // neither 6 nor 7 learned
  expect(a46).not.toContain('3×4'); // neither 3 nor 4 learned
  expect(a46).toHaveLength(15); // 8 with a 2  +  7 more with a 5
  expect(activeFacts(learned(51))).toHaveLength(36); // full table
});

// ── 4. Session picker ──

test('planSession: always 12 questions', () => {
  for (let s = 1; s <= 40; s++)
    expect(planSession(learned(51), seeded(s))).toHaveLength(SESSION_SIZE);
});

test('planSession: at most 4 distinct NEW facts per session (慢慢引入)', () => {
  for (let s = 1; s <= 40; s++) {
    const p = learned(51); // fresh → all 36 facts are new (s0)
    const plan = planSession(p, seeded(s));
    expect(new Set(plan.map((f) => f.key)).size).toBeLessThanOrEqual(MAX_NEW_PER_SESSION);
  }
  expect(MAX_NEW_PER_SESSION).toBe(4);
});

test('planSession: no fact repeats within the last 3 questions (dedup)', () => {
  const p = withStates(learned(51), { s: 1, cd: 0 }); // 36 non-new facts → variety
  for (let s = 1; s <= 40; s++) {
    const plan = planSession(p, seeded(s)).map((f) => f.key);
    for (let i = 1; i < plan.length; i++)
      expect(plan.slice(Math.max(0, i - 3), i)).not.toContain(plan[i]);
  }
});

test('planSession: deterministic for a given seed', () => {
  const p = withStates(learned(51), { s: 1, cd: 0 });
  const a = planSession(p, seeded(123)).map((f) => f.key);
  const b = planSession(p, seeded(123)).map((f) => f.key);
  expect(a).toEqual(b);
});

test('planSession: gating respected — only active facts appear', () => {
  const p = learned(46); // L = {2,5}
  const active = new Set(activeFacts(p).map((f) => f.key));
  for (let s = 1; s <= 40; s++)
    for (const f of planSession(p, seeded(s))) expect(active.has(f.key)).toBe(true);
});

test('planSession: mixed state — distinct NEW facts ≤4 while non-new facts widen the session', () => {
  const p = learned(51);
  const facts = allFacts();
  for (let i = 0; i < 20; i++) p.timesTable.facts[facts[i].key] = { s: 1, cd: 0 }; // 20 known, 16 new
  const isNewKey = new Set(facts.slice(20).map((f) => f.key));
  let sawWiderThan4 = false;
  for (let s = 1; s <= 40; s++) {
    const plan = planSession(p, seeded(s));
    const distinct = new Set(plan.map((f) => f.key));
    const distinctNew = [...distinct].filter((k) => isNewKey.has(k));
    expect(distinctNew.length).toBeLessThanOrEqual(MAX_NEW_PER_SESSION); // cap on NEW only
    if (distinct.size > MAX_NEW_PER_SESSION) sawWiderThan4 = true;       // non-new repeats allowed
  }
  expect(sawWiderThan4).toBe(true);
});

test('planSession: band-46 first session (15 all-new facts) → at most 4 distinct facts', () => {
  for (let s = 1; s <= 40; s++) {
    const plan = planSession(learned(46), seeded(s));
    expect(plan).toHaveLength(SESSION_SIZE);
    expect(new Set(plan.map((f) => f.key)).size).toBeLessThanOrEqual(MAX_NEW_PER_SESSION);
  }
});

test('planSession: weak-first — a lonely s1 fact is drawn far more than a resting s3 fact', () => {
  const p = withStates(learned(51), { s: 3, cd: 3 }); // all resting/lit
  const weakKey = '2×3';
  const strongKey = '8×9';
  p.timesTable.facts[weakKey] = { s: 1, cd: 0 }; // the one weak fact
  let weak = 0;
  let strong = 0;
  for (let s = 1; s <= 120; s++) {
    for (const f of planSession(p, seeded(s))) {
      if (f.key === weakKey) weak++;
      if (f.key === strongKey) strong++;
    }
  }
  expect(weak).toBeGreaterThan(strong * 3);
});

// ── 5. Question building (reuses makeOptions + array-grid pipeline) ──

test('buildQuestion (mul): 3 unique options containing the answer, array-grid present, no leak', () => {
  for (const f of allFacts()) {
    for (let s = 1; s <= 20; s++) {
      const q = buildQuestion(f, { s: 0, cd: 0 }, seeded(s)); // s0 → always product-recall
      expect(q.kind).toBe('mul');
      expect(new Set(q.options).size).toBe(3);
      expect(q.options).toContain(q.answer);
      for (const o of q.options) {
        expect(o).toBeGreaterThanOrEqual(1);
        expect(o).toBeLessThanOrEqual(100);
      }
      expect(q.answer).toBe(q.operands[0] * q.operands[1]);
      expect(q.blocksPlan).toEqual({ type: 'array-grid', rows: q.operands[0], cols: q.operands[1] });
      expect(q.blocksHint).toBeDefined();
      expect(q.ttsText).toMatch(/^\d+ 乘 \d+ 等于几？$/); // no answer leak
      expect(q.ttsText).not.toContain(String(q.answer));
    }
  }
});

test('buildQuestion: both orientations occur (fact drawn as a×b and b×a)', () => {
  const f = factOf('3×4');
  const seen = new Set<string>();
  const rng = seeded(1); // one continuous stream → swap flag varies
  for (let i = 0; i < 200; i++) {
    const q = buildQuestion(f, { s: 0, cd: 0 }, rng);
    seen.add(`${q.operands[0]}x${q.operands[1]}`);
  }
  expect(seen.has('3x4')).toBe(true);
  expect(seen.has('4x3')).toBe(true);
});

test('buildQuestion: s≥2 sometimes flips to missing-mul-b (a×?=c), which carries no grid (no leak)', () => {
  const f = factOf('3×4');
  let sawMissing = false;
  for (let s = 1; s <= 200; s++) {
    const q = buildQuestion(f, { s: 3, cd: 0 }, seeded(s));
    if (q.kind === 'missing-mul-b') {
      sawMissing = true;
      expect(q.missingIndex).toBe(1);
      expect(q.answer).toBe(q.operands[1]);
      expect(q.blocksPlan).toBeUndefined(); // grid would reveal the hidden factor
      expect(new Set(q.options).size).toBe(3);
      expect(q.options).toContain(q.answer);
      expect(q.operands[0]).not.toBe(q.answer); // visible multiplicand never equals the answer
    }
  }
  expect(sawMissing).toBe(true);
});

test('buildQuestion: square facts (a==b) NEVER use the missing variant — the shown factor IS the answer', () => {
  for (const key of ['2×2', '5×5', '9×9']) {
    const f = factOf(key);
    for (let s = 1; s <= 200; s++) {
      expect(buildQuestion(f, { s: 2, cd: 0 }, seeded(s)).kind).toBe('mul');
      expect(buildQuestion(f, { s: 3, cd: 0 }, seeded(s)).kind).toBe('mul');
    }
  }
});

test('buildQuestion: s<2 never flips to the missing variant', () => {
  const f = factOf('6×7');
  for (let s = 1; s <= 200; s++) {
    expect(buildQuestion(f, { s: 0, cd: 0 }, seeded(s)).kind).toBe('mul');
    expect(buildQuestion(f, { s: 1, cd: 0 }, seeded(s)).kind).toBe('mul');
  }
});

// ── 6. 口诀 / question text ──

test('koujue: traditional phrasing, 汉字, small-first, 得-rule for products <10', () => {
  expect(koujue(2, 3)).toBe('二三得六'); // <10 → 得
  expect(koujue(2, 4)).toBe('二四得八');
  expect(koujue(3, 3)).toBe('三三得九');
  expect(koujue(3, 4)).toBe('三四十二'); // ≥10 → no 得
  expect(koujue(7, 8)).toBe('七八五十六');
  expect(koujue(9, 9)).toBe('九九八十一');
  expect(koujue(2, 5)).toBe('二五一十'); // classic 一十 for exactly 10
  expect(koujue(4, 5)).toBe('四五二十');
  expect(koujue(5, 6)).toBe('五六三十');
});

test('koujue is small-first (order-independent)', () => {
  expect(koujue(4, 3)).toBe(koujue(3, 4));
  expect(koujue(9, 2)).toBe(koujue(2, 9));
});

test('question text: product-recall form leaks no answer; missing form hides a factor', () => {
  expect(questionText(3, 4)).toBe('3 乘 4 等于几？');
  expect(questionText(4, 3)).toBe('4 乘 3 等于几？');
  expect(missingQuestionText(3, 4)).toBe('3 乘几等于 12？');
  expect(arrayHint(3, 4)).toBe('3 排，每排 4 个，一共几个？');
});

// ── 7. Session runner (re-meet + commit) ──

test('session: length 12, exposes a current question, walks to done', () => {
  const p = withStates(learned(51), { s: 1, cd: 0 });
  const sess = new TimesTableSession(p, seeded(7));
  expect(sess.length).toBe(SESSION_SIZE);
  expect(sess.isDone()).toBe(false);
  const q = sess.currentQuestion();
  expect(new Set(q.options).size).toBe(3);
  let steps = 0;
  while (!sess.isDone()) {
    sess.answer(true);
    steps++;
    expect(steps).toBeLessThan(50);
  }
  expect(sess.isDone()).toBe(true);
});

test('session: a first wrong forces one re-meet of the same fact (再见面, not penalty)', () => {
  const p = withStates(learned(51), { s: 1, cd: 0 });
  const sess = new TimesTableSession(p, seeded(9));
  const firstKey = sess.currentFact().key;
  const before = sess.length;
  sess.answer(false); // wrong → schedule re-meet
  expect(sess.length).toBe(before + 1); // one extra question inserted
  const rest: string[] = [];
  while (!sess.isDone()) {
    rest.push(sess.currentFact().key);
    sess.answer(true);
  }
  expect(rest).toContain(firstKey); // the fact comes back
});

test('session: wrong drops s once; the subsequent retry-correct keeps it (no double reward)', () => {
  const p = withStates(learned(51), { s: 2, cd: 0 }); // every active fact at s2
  const sess = new TimesTableSession(p, seeded(5));
  const k = sess.currentFact().key;
  sess.answer(false); // s2 → s1 (wrong), re-meet scheduled
  while (!sess.isDone()) sess.answer(true); // all later answers correct
  const p2 = sess.commit();
  expect(p2.timesTable.facts[k].s).toBe(1); // dropped to 1 and stayed (retry kept it)
});

test('session commit: sessions++, cd decays for all persisted facts, litBest tracked', () => {
  const p = learned(46); // L = {2,5}; 6×7 is NOT active
  p.timesTable.facts['6×7'] = { s: 3, cd: 3 }; // persisted but out of the active pool
  const sess = new TimesTableSession(p, seeded(1));
  while (!sess.isDone()) sess.answer(true);
  const p2 = sess.commit();
  expect(p2.timesTable.sessions).toBe(1);
  expect(p2.timesTable.facts['6×7']).toEqual({ s: 3, cd: 2 }); // untouched: s kept, cd-1
  expect(p2.timesTable.litBest).toBe(1); // only the s3 fact is "lit" (answers only reach s1)
});

test('session commit: never mutates the source Progress', () => {
  const p = learned(51);
  const snapshot = JSON.stringify(p);
  const sess = new TimesTableSession(p, seeded(3));
  while (!sess.isDone()) sess.answer(false);
  sess.commit();
  expect(JSON.stringify(p)).toBe(snapshot);
});

test('session commit: idempotent — calling twice yields identical results (call once, persist once)', () => {
  const p = learned(46);
  p.timesTable.sessions = 7;
  const sess = new TimesTableSession(p, seeded(11));
  while (!sess.isDone()) sess.answer(true);
  const first = sess.commit();
  const second = sess.commit();
  expect(first.timesTable.sessions).toBe(8); // original + 1, NOT cumulative
  expect(second).toEqual(first);             // pure w.r.t. session state: no double-decay, no double-count
});

test('session accessors throw a clean error once the session is done', () => {
  const p = withStates(learned(51), { s: 1, cd: 0 });
  const sess = new TimesTableSession(p, seeded(2));
  while (!sess.isDone()) sess.answer(true);
  expect(() => sess.currentQuestion()).toThrow('session is done');
  expect(() => sess.currentFact()).toThrow('session is done');
  expect(() => sess.currentState()).toThrow('session is done');
});
