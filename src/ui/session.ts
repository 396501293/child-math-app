import type { Question } from '../core/types';

// 三屏状态机与关内/轮内会话状态（App 持有，Quiz/Result 消费）。
// 独立成模块以避免 App ↔ Quiz 的运行时循环导入。

export type Screen = 'map' | 'quiz' | 'result' | 'starchart';
export type Mode = 'campaign' | 'endless' | 'timed' | 'timestable';

// 九九星图答错揭示阶段的最小数据（口诀 + 阵列由 fact 推得），点击继续后清空。
export interface TtReveal { a: number; b: number; koujue: string }

export interface Session {
  mode: Mode;
  level?: number;                     // campaign
  questions?: Question[];             // campaign 预生成；模式流式
  qIndex: number;
  wrongTotal: number;
  excluded: number[];                 // 本题已排除的错误选项
  lastWrong?: number;                 // 最近一次点错的选项值（仅该项在 wrong 反馈期抖动）
  feedback: 'right' | 'wrong' | null;
  correctCount: number;
  streak: number;
  runBestStreak: number;
  recentKeys: string[];               // 模式滚动去重（最近 5 题）
  current?: Question;                 // endless/timed/timestable 当前题
  resultStars?: 1 | 2 | 3;            // campaign 结算星级（进结算前算定并落盘，供结算屏读取）
  resultBroke?: boolean;              // endless/timed 是否破纪录（进结算瞬间算定，供结算屏庆祝）
  // 九九星图（timestable）：会话对象存于 App 的 ref，此处仅镜像顶栏/揭示/结算所需最小字段。
  ttTotal?: number;                   // 当前 queue 长度（再见面会实时增长）
  ttLit?: number;                     // 当前已点亮 X/36
  ttReveal?: TtReveal | null;         // 答错揭示阶段（口诀 + 阵列），点击继续后清空
  resultTimes?: { correct: number; newLit: number; lit: number }; // timestable 结算数据
}

// 当前题选择器：campaign 读预生成数组，endless/timed/timestable 读流式 current。
export function currentQuestion(s: Session): Question {
  return s.mode === 'campaign' ? s.questions![s.qIndex] : s.current!;
}
