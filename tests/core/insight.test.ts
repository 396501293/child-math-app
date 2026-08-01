import { expect, test } from 'vitest';
import { defaultProgress, loadProgress, type StorageLike } from '../../src/core/storage';
import { eqText } from '../../src/core/insight';
import { recordAnswer } from '../../src/core/rewards';
import type { Question } from '../../src/core/types';

// 家长会话小结完整版（审查 D2）：近 7 天按章聚合首答正确率 + 最近 20 道
// 首答错题（题面+错选）。本地只读、无任何面向孩子的呈现，无惩罚原则不受影响。

const DAY = 24 * 3600 * 1000;

function q(over: Partial<Question> = {}): Question {
  return {
    kind: 'add',
    operands: [3, 4],
    ops: ['+'],
    answer: 7,
    options: [7, 6, 8],
    ttsText: '3加4等于几？',
    ...over,
  } as Question;
}

test('eqText：计算题 / 缺数题 / chain3 / 乘法（与题面渲染同符号 − ×）', () => {
  expect(eqText(q())).toBe('3 + 4 = ?');
  expect(eqText(q({ kind: 'missing-a', missingIndex: 1, answer: 4 }))).toBe('3 + ? = 7');
  expect(eqText(q({ operands: [9, 2], ops: ['-'], answer: 7 }))).toBe('9 − 2 = ?');
  expect(eqText(q({ operands: [3, 4], ops: ['×'], answer: 12 }))).toBe('3 × 4 = ?');
  expect(eqText(q({ kind: 'chain3', operands: [2, 3, 4], ops: ['+', '+'], answer: 9 }))).toBe('2 + 3 + 4 = ?');
});

test('insight：首答按章入桶；重试不计；答错进错题缓冲', () => {
  let p = defaultProgress();
  const now = 100 * DAY;
  p = recordAnswer(p, { practice: false, firstTry: true, correct: true, chapter: '1', qText: '3 + 4 = ?', picked: 7 }, now);
  p = recordAnswer(p, { practice: false, firstTry: true, correct: false, chapter: '1', qText: '9 − 2 = ?', picked: 6 }, now);
  p = recordAnswer(p, { practice: false, firstTry: false, correct: true, chapter: '1', qText: '9 − 2 = ?', picked: 7 }, now); // 重试
  expect(p.insight.days.length).toBe(1);
  expect(p.insight.days[0].ch['1']).toEqual({ n: 2, ok: 1 });
  expect(p.insight.errors).toEqual([{ text: '9 − 2 = ?', picked: 6, at: now }]);
});

test('insight：错题环形缓冲上限 20，保留最新', () => {
  let p = defaultProgress();
  for (let i = 0; i < 25; i++)
    p = recordAnswer(p, { practice: true, firstTry: true, correct: false, chapter: '2', qText: `q${i}`, picked: i }, 100 * DAY);
  expect(p.insight.errors.length).toBe(20);
  expect(p.insight.errors[0].text).toBe('q5');
  expect(p.insight.errors[19].text).toBe('q24');
});

test('insight：超 7 天的日桶滚动剔除', () => {
  let p = defaultProgress();
  p = recordAnswer(p, { practice: true, firstTry: true, correct: true, chapter: '1' }, 100 * DAY);
  p = recordAnswer(p, { practice: true, firstTry: true, correct: true, chapter: '2' }, 108 * DAY);
  expect(p.insight.days.length).toBe(1);
  expect(p.insight.days[0].ch['2']).toEqual({ n: 1, ok: 1 });
});

test('迁移：旧档无 insight → 空切片，不炸', () => {
  const blob = JSON.stringify({ version: 2, stars: { 1: 3 }, unlocked: 2 });
  const store: StorageLike = {
    getItem: (k) => (k === 'math_nightsail_v2' ? blob : null),
    setItem: () => {},
    removeItem: () => {},
  };
  const p = loadProgress(store);
  expect(p.insight).toEqual({ days: [], errors: [] });
});
