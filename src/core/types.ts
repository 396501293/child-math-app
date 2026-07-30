export type Op = '+' | '-' | '×';
export type QuestionKind =
  | 'add' | 'sub' | 'missing-a' | 'missing-b' | 'missing-sub' | 'chain3'
  | 'mul' | 'missing-mul-a' | 'missing-mul-b';
export type Rng = () => number; // [0,1)

export type BlocksPlan =
  | { type: 'divide-out'; total: number; crossOut: number }
  | { type: 'two-group'; a: number; b: number }
  | { type: 'fill-slot'; filled: number; empty: number; filledFirst: boolean }
  | { type: 'keep-mark'; total: number; keep: number }
  | { type: 'three-group'; groups: [number, number, number]; ops: [Op, Op] }
  | { type: 'array-grid'; rows: number; cols: number };

export interface Question {
  kind: QuestionKind;
  operands: number[];        // 等式全部真实值；缺数题也存完整值
  ops: Op[];
  missingIndex?: number;     // 缺数题：被隐藏项下标；answer === operands[missingIndex]
  answer: number;
  options: number[];         // 3 个，含 answer，已乱序
  ttsText: string;
  blocksHint?: string;       // 计数块提示行文案（🔊 行），第三章无
  blocksPlan?: BlocksPlan;   // 第三章为 undefined
}

export interface PoolSpec {
  kind: QuestionKind;
  weight: number;
  aRange: [number, number];
  bRange: [number, number];
  cRange?: [number, number];                          // 仅 chain3
  ops?: [Op, Op];                                     // 仅 chain3
  filter?: (a: number, b: number, c?: number) => boolean;
}

export interface BandConfig { band: number; chapter: 1 | 2 | 3 | 4; label: string; pools: PoolSpec[] }

export interface Item { kind: QuestionKind; operands: number[]; ops: Op[] }

// ── 史蒂夫养成（spec 2026-07-30）。矿石无独立存量：余额 = income(Progress) − spent。
export type OreKind = 'coal' | 'iron' | 'gold' | 'diamond' | 'emerald';
export type Ores = Record<OreKind, number>;
export type EquipSlot = 'boots' | 'helm' | 'legs' | 'chest';
export type EquipTier = 'leather' | 'iron' | 'gold' | 'diamond';
export type TradeKind = 'coalToIron' | 'ironToGold' | 'goldToDiamond' | 'diamondToEmerald';

export interface RewardsSlice {
  practiceFirstTry: number;                    // 三练习模式累计首答即对（唯一新埋点）
  owned: string[];                             // 已拥有装备/配件 id
  equipped: {
    boots: string | null; helm: string | null;
    legs: string | null; chest: string | null;
    accessories: string[];                     // 每锚点同时 ≤1，由 craft/穿脱维护
  };
  skyStars: number;                            // 已点亮星数（按图样顺序）
  traded: Record<TradeKind, number>;
}

export interface Progress {
  version: 2;
  stars: Record<number, 0 | 1 | 2 | 3>;
  unlocked: number;                                   // 1..60
  // streak = 跨会话延续的当前连对（无尽模式）。只被答错清零，不被退出清零
  //（无惩罚原则：退出常是家长的决定，为它罚连对等于罚孩子控制不了的事）。
  endless: { bestStreak: number; totalAnswered: number; streak: number };
  timed: { bestCount: number };
  // 九九星图：跨会话持久的 per-口诀 掌握度切片（key = `${min}×${max}`，稀疏存）
  timesTable: {
    facts: Record<string, { s: 0 | 1 | 2 | 3; cd: number }>;
    sessions: number;                                 // 已完成会话数（间隔重复时钟）
    litBest?: number;                                 // 历史最多点亮数（结算展示，可选）
  };
  settings: { questionCount: number; hardMode: boolean; showBlocks: boolean; showBlocksTimed: boolean; steveRaise: boolean };
  rewards: RewardsSlice;
  // 每周小结（P0-2-lite）：仅保留当周，翻周即重置
  weekly: { weekStart: number; answered: number; firstTry: number };
}
