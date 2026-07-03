import { expect, test } from 'vitest';
import type { Progress } from '../../src/core/types';
import {
  chapterOf,
  endlessBand,
  endlessUnlocked,
  starsFor,
  timedPool,
  timedUnlocked,
  unlockAfterWin,
} from '../../src/core/progression';

// NOTE: storage.ts (Task 7) is not yet written. Per task instructions this is a local
// helper standing in for the future `defaultProgress` export from '../../src/core/storage'.
// Task 7 implementer should switch this test to import the real one once it exists.
const defaultProgress = (): Progress => ({
  version: 2,
  stars: {},
  unlocked: 1,
  endless: { bestStreak: 0, totalAnswered: 0 },
  timed: { bestCount: 0 },
  settings: { questionCount: 5, hardMode: false, showBlocks: true, showBlocksTimed: false },
});

test('starsFor', () => {
  expect(starsFor(0)).toBe(3);
  expect(starsFor(1)).toBe(2);
  expect(starsFor(2)).toBe(2);
  expect(starsFor(3)).toBe(1);
});

test('chapterOf boundaries', () => {
  expect(chapterOf(1)).toBe(1);
  expect(chapterOf(15)).toBe(1);
  expect(chapterOf(16)).toBe(2);
  expect(chapterOf(30)).toBe(2);
  expect(chapterOf(31)).toBe(3);
});

test('endlessBand: starts at current chapter first band, +1 per 4 correct, capped', () => {
  expect(endlessBand(0, 4)).toBe(1);
  expect(endlessBand(3, 4)).toBe(1);
  expect(endlessBand(4, 4)).toBe(2);
  expect(endlessBand(99, 4)).toBe(4); // 封顶 maxUnlocked
  expect(endlessBand(0, 17)).toBe(16); // 第二章起步档 16
  expect(endlessBand(4, 17)).toBe(17);
});

test('mode unlock gates: stars on level 3 / level 9', () => {
  const p = defaultProgress();
  expect(endlessUnlocked(p)).toBe(false);
  expect(timedUnlocked(p)).toBe(false);
  p.stars[3] = 1;
  expect(endlessUnlocked(p)).toBe(true);
  p.stars[9] = 2;
  expect(timedUnlocked(p)).toBe(true);
});

test('timedPool: completed bands within current + previous chapter only', () => {
  const p = defaultProgress();
  for (let l = 1; l <= 16; l++) p.stars[l] = 3;
  p.unlocked = 17; // 当前章 = 2
  expect(timedPool(p)).toEqual([...Array(16)].map((_, i) => i + 1)); // 章1+2 已完成档
  const p3 = defaultProgress();
  for (let l = 1; l <= 31; l++) p3.stars[l] = 1;
  p3.unlocked = 32; // 当前章 = 3 → 只含章 2、3
  expect(timedPool(p3)).toEqual([...Array(16)].map((_, i) => i + 16));
});

test('unlockAfterWin: extends unlocked, keeps best stars', () => {
  const p = defaultProgress();
  const p2 = unlockAfterWin(p, 1, 2);
  expect(p2.unlocked).toBe(2);
  expect(p2.stars[1]).toBe(2);
  const p3 = unlockAfterWin(p2, 1, 1);
  expect(p3.stars[1]).toBe(2); // 取历史最高
  const p4 = unlockAfterWin(p3, 45, 3);
  expect(p4.unlocked).toBe(45); // 上限 45
});
