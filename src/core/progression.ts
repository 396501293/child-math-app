import type { Progress } from './types';

export const starsFor = (wrong: number): 1 | 2 | 3 => (wrong === 0 ? 3 : wrong <= 2 ? 2 : 1);
export const chapterOf = (level: number): 1 | 2 | 3 | 4 | 5 => Math.ceil(level / 15) as 1 | 2 | 3 | 4 | 5;
export const chapterStart = (ch: number): number => (ch - 1) * 15 + 1;

// 无尽起始档（§六-1 修订，2026-08-01 用户批准）：max(章首, 有效档−3)。
// 章前段取章首（行为与修订前逐位一致）；章后段热身收敛为 3 档 × 4 题——
// 修订前档 58 的孩子每轮要连对 48 题才爬回自己的水平，无尽永远够不到 ZPD。
export const endlessBand = (correct: number, effLevel: number): number => {
  const start = Math.max(chapterStart(chapterOf(effLevel)), effLevel - 3);
  return Math.min(start + Math.floor(correct / 4), effLevel);
};

const starredCount = (p: Progress): number =>
  Object.values(p.stars).filter((s) => (s ?? 0) >= 1).length;

// 练习模式解锁（§六-2 修订，2026-08-01 用户批准）：得星关数 ≥3 / ≥9（任意关）。
// 线性推进完成第 3/9 关时恰好等价旧条文；跳级孩子玩满 3/9 关新内容即解锁，
// 不再被「回刷低于 ZPD 的第 3/9 关」这条唯一路径锁死。
export const endlessUnlocked = (p: Progress): boolean => starredCount(p) >= 3;
export const timedUnlocked = (p: Progress): boolean => starredCount(p) >= 9;
// 九九星图：完成第 46 关（首次遇 ×，L={2,5}）后解锁（spec §7）。
export const timesTableUnlocked = (p: Progress): boolean => (p.stars[46] ?? 0) >= 1;

// 练习模式（无尽/限时）的难度锚点：已解锁 与 「最高得星关+1」中取更小者。
// 正常推进时 unlocked === maxStarred+1，锚点与旧行为完全一致；
// 家长「解锁全部关卡」把 unlocked 拉满到 60 时，锚点仍跟随真实掌握度，不被污染。
export function effectiveLevel(p: Progress): number {
  let maxStarred = 0;
  for (const key of Object.keys(p.stars)) {
    const level = Number(key);
    if ((p.stars[level] ?? 0) >= 1 && level > maxStarred) maxStarred = level;
  }
  return Math.min(Math.max(Math.min(p.unlocked, maxStarred + 1), 1), 75);
}

// 地图节点状态（审查 A1）：可点性由 unlocked 决定，「当前关」脉冲锚 effectiveLevel——
// unlock-all 把 unlocked 拉满后，前沿标记仍落在孩子真实掌握度 +1 处，不消失。
export function mapNodeState(p: Progress, n: number): 'done' | 'current' | 'locked' {
  if (n > p.unlocked) return 'locked';
  if (n === effectiveLevel(p) && (p.stars[n] ?? 0) === 0) return 'current';
  return 'done';
}

export function timedPool(p: Progress): number[] {
  const cur = chapterOf(effectiveLevel(p));
  const out: number[] = [];
  for (let b = 1; b <= 75; b++)
    if ((p.stars[b] ?? 0) >= 1 && (chapterOf(b) === cur || chapterOf(b) === cur - 1)) out.push(b);
  return out;
}

export function unlockAfterWin(p: Progress, level: number, stars: 1 | 2 | 3): Progress {
  return {
    ...p,
    stars: { ...p.stars, [level]: Math.max(p.stars[level] ?? 0, stars) as 0 | 1 | 2 | 3 },
    unlocked: Math.max(p.unlocked, Math.min(level + 1, 75)),
  };
}
