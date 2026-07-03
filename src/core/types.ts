export type Op = '+' | '-';
export type QuestionKind = 'add' | 'sub' | 'missing-a' | 'missing-b' | 'missing-sub' | 'chain3';
export type Rng = () => number; // [0,1)

export type BlocksPlan =
  | { type: 'divide-out'; total: number; crossOut: number }
  | { type: 'two-group'; a: number; b: number }
  | { type: 'fill-slot'; filled: number; empty: number; filledFirst: boolean }
  | { type: 'keep-mark'; total: number; keep: number }
  | { type: 'three-group'; groups: [number, number, number]; ops: [Op, Op] };

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

export interface BandConfig { band: number; chapter: 1 | 2 | 3; label: string; pools: PoolSpec[] }

export interface Item { kind: QuestionKind; operands: number[]; ops: Op[] }

export interface Progress {
  version: 2;
  stars: Record<number, 0 | 1 | 2 | 3>;
  unlocked: number;                                   // 1..45
  endless: { bestStreak: number; totalAnswered: number };
  timed: { bestCount: number };
  settings: { questionCount: number; hardMode: boolean; showBlocks: boolean; showBlocksTimed: boolean };
}
