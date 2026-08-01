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

test('endlessBand: 起始 max(章首, 有效档−3)，+1/4 连对，封顶（§六-1 修订 2026-08-01 批准）', () => {
  // 章前段：effectiveLevel−3 < 章首 → 取章首，行为与修订前逐位一致
  expect(endlessBand(0, 4)).toBe(1);
  expect(endlessBand(3, 4)).toBe(1);
  expect(endlessBand(4, 4)).toBe(2);
  expect(endlessBand(99, 4)).toBe(4); // 封顶
  expect(endlessBand(0, 17)).toBe(16); // 第二章起步档 16
  expect(endlessBand(4, 17)).toBe(17);
  // 章后段：热身收敛为 3 档 × 4 题，不再重走全章
  expect(endlessBand(0, 58)).toBe(55);  // max(46, 55)
  expect(endlessBand(12, 58)).toBe(58); // 55+3 封顶 58
  expect(endlessBand(0, 75)).toBe(72);  // 第五章尾部同理
});

test('mode unlock gates: 得星关数 ≥3 / ≥9（§六-2 修订 2026-08-01 批准）', () => {
  const p = defaultProgress();
  expect(endlessUnlocked(p)).toBe(false);
  expect(timedUnlocked(p)).toBe(false);
  // 线性推进：完成第 3 关时恰好得星关数 = 3，行为与旧条文逐位一致
  p.stars = { 1: 1, 2: 3, 3: 1 };
  expect(endlessUnlocked(p)).toBe(true);
  expect(timedUnlocked(p)).toBe(false);
  for (let i = 4; i <= 9; i++) p.stars[i] = 2;
  expect(timedUnlocked(p)).toBe(true);
});

test('mode unlock gates: 跳级孩子玩满 3/9 关新内容即解锁，不必回刷第 3/9 关', () => {
  const p = defaultProgress();
  p.unlocked = 75; // unlock-all 跳级画像，从第 46 关起步
  p.stars = { 46: 1, 47: 2, 48: 1 };
  expect(endlessUnlocked(p)).toBe(true);  // 旧条文下永远 false（第 3 关无星）
  expect(timedUnlocked(p)).toBe(false);
  for (let i = 49; i <= 54; i++) p.stars[i] = 1;
  expect(timedUnlocked(p)).toBe(true);    // 旧条文下永远 false（第 9 关无星）
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
  expect(p5.unlocked).toBe(61); // 完成 60 → 解锁第五章
  const p6 = unlockAfterWin(p5, 75, 3);
  expect(p6.unlocked).toBe(75); // 上限 75（第 75 关无下一关）
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
