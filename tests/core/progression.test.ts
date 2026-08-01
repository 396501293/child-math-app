import { expect, test } from 'vitest';
import {
  chapterOf,
  effectiveLevel,
  endlessBand,
  endlessUnlocked,
  mapNodeState,
  starsFor,
  timedPool,
  timedUnlocked,
  unlockAfterWin,
} from '../../src/core/progression';
import { defaultProgress } from '../../src/core/storage';

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
  expect(chapterOf(45)).toBe(3);
  expect(chapterOf(46)).toBe(4);
  expect(chapterOf(60)).toBe(4);
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
  const p4 = unlockAfterWin(p3, 59, 3);
  expect(p4.unlocked).toBe(60); // 完成 59 → 解锁 60
  const p5 = unlockAfterWin(p4, 60, 3);
  expect(p5.unlocked).toBe(60); // 上限 60（第 60 关无下一关）
});

test('timedPool spans chapter 3 & 4', () => {
  const p = defaultProgress();
  for (let l = 31; l <= 46; l++) p.stars[l] = 1;
  p.unlocked = 46; // 当前章 = 4 → 只含章 3、4 已完成档
  expect(timedPool(p)).toEqual([...Array(16)].map((_, i) => i + 31));
});

test('timedPool: timed first-use path (chapter 1 fully starred)', () => {
  const p = defaultProgress();
  for (let l = 1; l <= 9; l++) p.stars[l] = 1;
  p.unlocked = 10;
  expect(timedPool(p)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test('effectiveLevel: default progress has no stars → 1', () => {
  const p = defaultProgress();
  expect(effectiveLevel(p)).toBe(1);
});

test('effectiveLevel: normal play tracks unlocked (unlocked === maxStarred+1)', () => {
  const p = defaultProgress();
  for (let l = 1; l <= 12; l++) p.stars[l] = 1;
  p.unlocked = 13;
  expect(effectiveLevel(p)).toBe(13);
});

test('effectiveLevel: unlock-all does not pollute anchor beyond real mastery', () => {
  const p = defaultProgress();
  for (let l = 1; l <= 12; l++) p.stars[l] = 1;
  p.unlocked = 60; // 家长「解锁全部关卡」
  expect(effectiveLevel(p)).toBe(13);
});

test('effectiveLevel: unlock-all with zero stars falls back to 1', () => {
  const p = defaultProgress();
  p.unlocked = 60;
  expect(effectiveLevel(p)).toBe(1);
});

test('effectiveLevel: full mastery clamps at 60', () => {
  const p = defaultProgress();
  for (let l = 1; l <= 60; l++) p.stars[l] = 3;
  p.unlocked = 60;
  expect(effectiveLevel(p)).toBe(60);
});

test('timedPool: unlock-all does not empty the pool — anchors on real mastery', () => {
  const p = defaultProgress();
  for (let l = 1; l <= 16; l++) p.stars[l] = 1;
  p.unlocked = 60; // 家长「解锁全部关卡」：不应把限时锚定到章 4
  expect(timedPool(p)).toEqual([...Array(16)].map((_, i) => i + 1));
});

// ── 地图节点状态（全面审查 A1）：可点性看 unlocked，「当前关」脉冲锚 effectiveLevel ──

test('mapNodeState: 正常推进——unlocked 关为 current，其余不变', () => {
  const p = defaultProgress();
  p.stars = { 1: 3, 2: 2 };
  p.unlocked = 3;
  expect(mapNodeState(p, 2)).toBe('done');
  expect(mapNodeState(p, 3)).toBe('current');
  expect(mapNodeState(p, 4)).toBe('locked');
});

test('mapNodeState: unlock-all 后前沿标记仍落在真实掌握度+1，不再消失', () => {
  const p = defaultProgress();
  for (let i = 1; i <= 49; i++) p.stars[i] = 1;
  p.unlocked = 60; // 家长「解锁全部关卡」
  expect(mapNodeState(p, 50)).toBe('current'); // 真实前沿
  expect(mapNodeState(p, 60)).toBe('done');    // 可点但非前沿
  expect(mapNodeState(p, 49)).toBe('done');
});

test('mapNodeState: 前沿关已得星（全通关）→ 无 current 节点', () => {
  const p = defaultProgress();
  for (let i = 1; i <= 60; i++) p.stars[i] = 1;
  p.unlocked = 60;
  for (let n = 1; n <= 60; n++) expect(mapNodeState(p, n)).toBe('done');
});
