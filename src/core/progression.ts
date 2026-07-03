import type { Progress } from './types';

export const starsFor = (wrong: number): 1 | 2 | 3 => (wrong === 0 ? 3 : wrong <= 2 ? 2 : 1);
export const chapterOf = (level: number): 1 | 2 | 3 => Math.ceil(level / 15) as 1 | 2 | 3;
export const chapterStart = (ch: number): number => (ch - 1) * 15 + 1;

export const endlessBand = (correct: number, maxUnlocked: number): number =>
  Math.min(chapterStart(chapterOf(maxUnlocked)) + Math.floor(correct / 4), maxUnlocked);

export const endlessUnlocked = (p: Progress): boolean => (p.stars[3] ?? 0) >= 1;
export const timedUnlocked = (p: Progress): boolean => (p.stars[9] ?? 0) >= 1;

export function timedPool(p: Progress): number[] {
  const cur = chapterOf(p.unlocked);
  const out: number[] = [];
  for (let b = 1; b <= 45; b++)
    if ((p.stars[b] ?? 0) >= 1 && (chapterOf(b) === cur || chapterOf(b) === cur - 1)) out.push(b);
  return out;
}

export function unlockAfterWin(p: Progress, level: number, stars: 1 | 2 | 3): Progress {
  return {
    ...p,
    stars: { ...p.stars, [level]: Math.max(p.stars[level] ?? 0, stars) as 0 | 1 | 2 | 3 },
    unlocked: Math.max(p.unlocked, Math.min(level + 1, 45)),
  };
}
