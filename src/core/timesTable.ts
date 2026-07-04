// 九九星图（乘法表记忆模式）核心逻辑 —— 见 docs/edu-pm-reviews/2026-07-04-times-table-mode-spec.md
//
// 单位是「口诀」：2×3 与 3×2 同一 fact「二三得六」，掌握度按 canonical key `${min}×${max}` 存，
// 出题时两向都可出。核心 36 条口诀（2≤a≤b≤9）；×1 平凡，不入池。
import type { Item, Progress, Question, Rng } from './types';
import { makeOptions } from './options';

// ── Fact model ───────────────────────────────────────────────────────────────

export type Mastery = 0 | 1 | 2 | 3;
export interface Fact { a: number; b: number; key: string } // a ≤ b（小在前）
export interface FactState { s: Mastery; cd: number }        // s=掌握度, cd=间隔冷却（单位「会话」）

export const SESSION_SIZE = 12;         // 一次会话 = 12 题
export const MAX_NEW_PER_SESSION = 4;   // 每会话最多引入 4 条新 fact（「慢慢」）
export const S0: FactState = { s: 0, cd: 0 }; // 未触碰的缺省态

export const factKey = (a: number, b: number): string => `${Math.min(a, b)}×${Math.max(a, b)}`;

export function factOf(key: string): Fact {
  const [a, b] = key.split('×').map(Number);
  return { a, b, key };
}

export function allFacts(): Fact[] {
  const out: Fact[] = [];
  for (let a = 2; a <= 9; a++) for (let b = a; b <= 9; b++) out.push({ a, b, key: `${a}×${b}` });
  return out; // 36 条
}

// ── 掌握度状态机 ──────────────────────────────────────────────────────────────

// 首次即答对：越熟休越久（cd = 新 s，s3 歇 3 个会话）。
export const onFirstCorrect = (st: FactState): FactState => {
  const s = Math.min(st.s + 1, 3) as Mastery;
  return { s, cd: s };
};
// 答错后本轮再见面答对：不因重试给满奖励（s 不变），但短期内再复习一次（cd=1）。
export const onRetryCorrect = (st: FactState): FactState => ({ s: st.s, cd: 1 });
// 答错：微回落强化记忆（floor 0），孩子侧无可见惩罚；cd=0 使其很快再到期（不锁死）。
export const onWrong = (st: FactState): FactState => ({ s: Math.max(st.s - 1, 0) as Mastery, cd: 0 });

// 抽样权重（§1）：新 > 弱 > 到期熟 > 到期已点亮 > 未到期熟 > 未到期已点亮。
export function masteryWeight(st: FactState): number {
  const due = st.cd <= 0;
  switch (st.s) {
    case 0: return 5;   // 新/未见（受「每会话≤4 条新」约束）
    case 1: return 4;   // 弱项优先
    case 2: return due ? 2.5 : 0.8;
    default: return due ? 1 : 0.3; // s3：集齐后偶尔保温
  }
}

// ── 门控：主线已学口诀表 → 可练 fact ─────────────────────────────────────────

const TABLE_UNLOCKS: Array<[number, number[]]> = [
  [46, [2, 5]], [47, [3, 4]], [49, [6, 7]], [50, [8, 9]],
]; // 档 48 是 2–5 巩固，不新增表；档 51 全解锁（下方特判）

export function learnedTables(p: Progress): Set<number> {
  const L = new Set<number>();
  if ((p.stars[51] ?? 0) >= 1) { for (let t = 2; t <= 9; t++) L.add(t); return L; }
  for (const [band, tables] of TABLE_UNLOCKS)
    if ((p.stars[band] ?? 0) >= 1) for (const t of tables) L.add(t);
  return L;
}

// 活跃池：a 或 b 属于已学口诀表（学会 ×2 表 = 会 2×2..2×9，故含 2 的口诀全部激活）。
export function activeFacts(p: Progress): Fact[] {
  const L = learnedTables(p);
  return allFacts().filter((f) => L.has(f.a) || L.has(f.b));
}

// ── 选题算法 ──────────────────────────────────────────────────────────────────

const stateOf = (p: Progress, key: string): FactState => p.timesTable.facts[key] ?? S0;

function weightedPick(pool: Fact[], w: (f: Fact) => number, rng: Rng): Fact {
  const total = pool.reduce((s, f) => s + w(f), 0);
  let roll = rng() * total;
  for (const f of pool) { roll -= w(f); if (roll < 0) return f; }
  return pool[pool.length - 1];
}

// 生成一次会话的基础题面（12 条 fact，含重复；再见面/兜底由 session 运行时插入）。
export function planSession(p: Progress, rng: Rng): Fact[] {
  const active = activeFacts(p);
  if (active.length === 0) return [];
  const isNew = (f: Fact) => stateOf(p, f.key).s === 0;

  const plan: Fact[] = [];
  const newChosen = new Set<string>(); // 本会话已引入的「新 fact」（去重后计数）
  const capBlocks = (f: Fact) => isNew(f) && !newChosen.has(f.key) && newChosen.size >= MAX_NEW_PER_SESSION;

  for (let n = 0; n < SESSION_SIZE; n++) {
    const recent = plan.slice(-3).map((f) => f.key); // 去重：不与最近 3 题同 fact
    let pool = active.filter((f) => !recent.includes(f.key) && !capBlocks(f));
    if (pool.length === 0) pool = active.filter((f) => !capBlocks(f)); // 池太小 → 放宽去重
    if (pool.length === 0) pool = active;                              // 兜底（极端退化）
    const pick = weightedPick(pool, (f) => masteryWeight(stateOf(p, f.key)), rng);
    if (isNew(pick)) newChosen.add(pick.key);
    plan.push(pick);
  }
  return plan;
}

// ── 语音/口诀文案（§6）─────────────────────────────────────────────────────────

const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];

// 0–99 → 汉字（十二/二十/八十一…）。
function hanzi(n: number): string {
  if (n < 10) return DIGITS[n];
  if (n < 20) return '十' + (n % 10 === 0 ? '' : DIGITS[n % 10]);
  return DIGITS[Math.floor(n / 10)] + '十' + (n % 10 === 0 ? '' : DIGITS[n % 10]);
}

// 传统口诀：小在前、汉字数；product<10 → 「{a}{b}得{积}」，≥10 → 「{a}{b}{积}」；
// 积恰为 10 用经典「一十」（二五一十）。
export function koujue(a: number, b: number): string {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const p = lo * hi;
  const body = DIGITS[lo] + DIGITS[hi];
  const prod = p === 10 ? '一十' : hanzi(p);
  return p < 10 ? `${body}得${prod}` : `${body}${prod}`;
}

// 提问（算式式，不泄答案）。
export const questionText = (a: number, b: number): string => `${a} 乘 ${b} 等于几？`;
// 缺数变体：隐藏一个因子，露出积（露的是积、不是答案，故不泄答案）。
export const missingQuestionText = (a: number, b: number): string => `${a} 乘几等于 ${a * b}？`;
// 阵列提示。
export const arrayHint = (a: number, b: number): string => `${a} 排，每排 ${b} 个，一共几个？`;

// ── 题目构建（复用 makeOptions + array-grid 教具管线）──────────────────────────

const MUL_BAND = 51; // 九九全口诀：干扰项用「口诀邻位」、clamp [1,100]

// 由 fact + 当前掌握度出一道题。s≥2 有 30% 出翻面缺数 a×?=c（区分真会背 vs 顺口溜蒙）；
// 翻面变体不带阵列教具（否则数格子即泄漏被隐藏的因子，破坏反向验证）。
export function buildQuestion(fact: Fact, st: FactState, rng: Rng): Question {
  const useMissing = st.s >= 2 && rng() < 0.3;
  const swap = rng() < 0.5; // 两向都可出
  const a = swap ? fact.b : fact.a;
  const b = swap ? fact.a : fact.b;

  if (useMissing) {
    const item: Item = { kind: 'missing-mul-b', operands: [a, b], ops: ['×'] };
    return {
      kind: 'missing-mul-b', operands: [a, b], ops: ['×'], missingIndex: 1,
      answer: b, options: makeOptions(item, b, MUL_BAND, rng), ttsText: missingQuestionText(a, b),
    };
  }
  const item: Item = { kind: 'mul', operands: [a, b], ops: ['×'] };
  const answer = a * b;
  return {
    kind: 'mul', operands: [a, b], ops: ['×'], answer,
    options: makeOptions(item, answer, MUL_BAND, rng), ttsText: questionText(a, b),
    blocksPlan: { type: 'array-grid', rows: a, cols: b }, blocksHint: arrayHint(a, b),
  };
}

// ── 会话运行时（再见面 + 结算落盘）────────────────────────────────────────────

export class TimesTableSession {
  private readonly p: Progress;
  private readonly rng: Rng;
  private readonly queue: Fact[];
  private readonly states: Record<string, FactState>; // 工作副本（含全部已落盘 fact）
  private readonly wrongOnce = new Set<string>();      // 本会话已答错过的 fact
  private readonly resolved = new Set<string>();       // 本会话 s 已定档的 fact（每会话至多变 1 级）
  private idx = 0;
  private q: Question | null = null;

  constructor(progress: Progress, rng: Rng) {
    this.p = progress;
    this.rng = rng;
    this.states = {};
    for (const [k, v] of Object.entries(progress.timesTable.facts)) this.states[k] = { ...v };
    this.queue = planSession(progress, rng);
    this.rebuild();
  }

  get length(): number { return this.queue.length; }
  get index(): number { return this.idx; }
  isDone(): boolean { return this.idx >= this.queue.length; }
  currentFact(): Fact { return this.queue[this.idx]; }
  currentState(): FactState { return this.states[this.currentFact().key] ?? S0; }
  currentQuestion(): Question {
    if (!this.q) throw new Error('session is done');
    return this.q;
  }

  private rebuild(): void {
    this.q = this.isDone() ? null : buildQuestion(this.currentFact(), this.currentState(), this.rng);
  }

  // 首次答错 → 强制在 本题序号 + rand(3,5) 处再出一次（越界则会话末尾追加兜底）。
  private scheduleRemeet(fact: Fact): void {
    const offset = 3 + Math.floor(this.rng() * 3); // 3..5
    const pos = this.idx + offset;
    if (pos >= this.queue.length) this.queue.push(fact);
    else this.queue.splice(pos, 0, fact);
  }

  // s 每会话至多变 1 级（cd 单位是「会话」，间隔重复的分级只在跨会话推进）：
  // 本会话第一次「定档」决定 s（首答对 +1 / 首答错 −1，均 floor/ceil）；此后同一 fact 的重复
  // 只作保温——答对不再加分（无速成），答错不再扣分（无惩罚），仅答错触发一次「再见面」。
  answer(correct: boolean): void {
    if (this.isDone()) return;
    const fact = this.currentFact();
    const key = fact.key;
    const st = this.states[key] ?? S0;
    if (correct) {
      if (!this.resolved.has(key)) { this.states[key] = onFirstCorrect(st); this.resolved.add(key); }
      else if (this.wrongOnce.has(key)) this.states[key] = onRetryCorrect(st); // 收尾于「这次对了」
      // 否则：纯保温重复，s/cd 不变
    } else {
      if (!this.resolved.has(key)) { this.states[key] = onWrong(st); this.resolved.add(key); }
      if (!this.wrongOnce.has(key)) { this.scheduleRemeet(fact); this.wrongOnce.add(key); } // 只强制一次再见面
    }
    this.idx++;
    this.rebuild();
  }

  // 结算落盘：合并掌握度、会话钟 +1、所有已落盘 fact cd−1（floor 0）、更新 litBest。
  commit(): Progress {
    const facts: Record<string, FactState> = {};
    for (const [k, st] of Object.entries(this.states))
      facts[k] = { s: st.s, cd: Math.max(st.cd - 1, 0) };
    const lit = Object.values(facts).filter((f) => f.s === 3).length;
    return {
      ...this.p,
      timesTable: {
        facts,
        sessions: this.p.timesTable.sessions + 1,
        litBest: Math.max(this.p.timesTable.litBest ?? 0, lit),
      },
    };
  }
}
