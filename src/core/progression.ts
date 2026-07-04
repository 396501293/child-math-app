import type { Progress } from './types';

export const starsFor = (wrong: number): 1 | 2 | 3 => (wrong === 0 ? 3 : wrong <= 2 ? 2 : 1);
export const chapterOf = (level: number): 1 | 2 | 3 | 4 => Math.ceil(level / 15) as 1 | 2 | 3 | 4;
export const chapterStart = (ch: number): number => (ch - 1) * 15 + 1;

export const endlessBand = (correct: number, maxUnlocked: number): number =>
  Math.min(chapterStart(chapterOf(maxUnlocked)) + Math.floor(correct / 4), maxUnlocked);

export const endlessUnlocked = (p: Progress): boolean => (p.stars[3] ?? 0) >= 1;
export const timedUnlocked = (p: Progress): boolean => (p.stars[9] ?? 0) >= 1;

// 练习模式（无尽/限时）的难度锚点：已解锁 与 「最高得星关+1」中取更小者。
// 正常推进时 unlocked === maxStarred+1，锚点与旧行为完全一致；
// 家长「解锁全部关卡」把 unlocked 拉满到 60 时，锚点仍跟随真实掌握度，不被污染。
export function effectiveLevel(p: Progress): number {
  let maxStarred = 0;
  for (const key of Object.keys(p.stars)) {
    const level = Number(key);
    if ((p.stars[level] ?? 0) >= 1 && level > maxStarred) maxStarred = level;
  }
  return Math.min(Math.max(Math.min(p.unlocked, maxStarred + 1), 1), 60);
}

export function timedPool(p: Progress): number[] {
  const cur = chapterOf(effectiveLevel(p));
  const out: number[] = [];
  for (let b = 1; b <= 60; b++)
    if ((p.stars[b] ?? 0) >= 1 && (chapterOf(b) === cur || chapterOf(b) === cur - 1)) out.push(b);
  return out;
}

export function unlockAfterWin(p: Progress, level: number, stars: 1 | 2 | 3): Progress {
  return {
    ...p,
    stars: { ...p.stars, [level]: Math.max(p.stars[level] ?? 0, stars) as 0 | 1 | 2 | 3 },
    unlocked: Math.max(p.unlocked, Math.min(level + 1, 60)),
  };
}
