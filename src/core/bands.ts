import type { BandConfig, Op, PoolSpec } from './types';

const ones = (n: number) => n % 10;
type R = [number, number];

const add = (sum: R, w = 1): PoolSpec => ({ kind: 'add', weight: w,
  aRange: [1, sum[1] - 1], bRange: [1, sum[1] - 1],
  filter: (a, b) => a + b >= sum[0] && a + b <= sum[1] });
const sub = (aR: R, w = 1): PoolSpec => ({ kind: 'sub', weight: w,
  aRange: aR, bRange: [1, aR[1] - 1], filter: (a, b) => b < a });
const missB = (sum: R, w = 1): PoolSpec => ({ ...add(sum, w), kind: 'missing-b' });
const missA = (sum: R, w = 1): PoolSpec => ({ ...add(sum, w), kind: 'missing-a' });
const missSub = (aR: R, w = 1): PoolSpec => ({ ...sub(aR, w), kind: 'missing-sub' });
const addNoCarry10 = (w = 1): PoolSpec => ({ kind: 'add', weight: w, aRange: [10, 18], bRange: [1, 9],
  filter: (a, b) => ones(a) + b <= 9 });
const subNoBorrow10 = (w = 1): PoolSpec => ({ kind: 'sub', weight: w, aRange: [11, 19], bRange: [1, 9],
  filter: (a, b) => b <= ones(a) });
const addCarry20 = (w = 1): PoolSpec => ({ kind: 'add', weight: w, aRange: [2, 9], bRange: [2, 9],
  filter: (a, b) => a + b >= 11 });
const subBorrow = (aR: R, w = 1): PoolSpec => ({ kind: 'sub', weight: w, aRange: aR, bRange: [1, 9],
  filter: (a, b) => b > ones(a) });
const chain = (ops: [Op, Op], max: number, w = 1): PoolSpec => ({ kind: 'chain3', weight: w, ops,
  aRange: [1, max], bRange: [1, max], cRange: [1, max],
  filter: (a, b, c) => {
    const s1 = ops[0] === '+' ? a + b : a - b;
    if (s1 < 1 || s1 > max) return false;
    const s2 = ops[1] === '+' ? s1 + c! : s1 - c!;
    return s2 >= 1 && s2 <= max;
  } });
const tensAdd = (w = 1): PoolSpec => ({ kind: 'add', weight: w, aRange: [10, 90], bRange: [10, 90],
  filter: (a, b) => a % 10 === 0 && b % 10 === 0 && a + b <= 100 });
const tensSub = (w = 1): PoolSpec => ({ kind: 'sub', weight: w, aRange: [20, 90], bRange: [10, 80],
  filter: (a, b) => a % 10 === 0 && b % 10 === 0 && a - b >= 10 });
const add2d1dNC = (w = 1): PoolSpec => ({ kind: 'add', weight: w, aRange: [10, 98], bRange: [1, 9],
  filter: (a, b) => ones(a) + b <= 9 });
const sub2d1dNB = (w = 1): PoolSpec => ({ kind: 'sub', weight: w, aRange: [11, 99], bRange: [1, 9],
  filter: (a, b) => b <= ones(a) });
const add2dTens = (w = 1): PoolSpec => ({ kind: 'add', weight: w, aRange: [10, 99], bRange: [10, 80],
  filter: (a, b) => b % 10 === 0 && a + b <= 99 });
const sub2dTens = (w = 1): PoolSpec => ({ kind: 'sub', weight: w, aRange: [10, 99], bRange: [10, 90],
  filter: (a, b) => b % 10 === 0 && a - b >= 1 });
const add2d1dC = (w = 1): PoolSpec => ({ kind: 'add', weight: w, aRange: [10, 99], bRange: [1, 9],
  filter: (a, b) => ones(a) + b >= 10 && a + b <= 99 });
const sub2d1dB = (w = 1): PoolSpec => ({ kind: 'sub', weight: w, aRange: [11, 99], bRange: [1, 9],
  filter: (a, b) => b > ones(a) && a - b >= 1 });
const add2d2dNC = (w = 1): PoolSpec => ({ kind: 'add', weight: w, aRange: [10, 99], bRange: [10, 99],
  filter: (a, b) => ones(a) + ones(b) <= 9 && a + b <= 99 });
const sub2d2dNB = (w = 1): PoolSpec => ({ kind: 'sub', weight: w, aRange: [10, 99], bRange: [10, 99],
  filter: (a, b) => ones(b) <= ones(a) && a - b >= 1 });
const add2d2dC = (w = 1): PoolSpec => ({ kind: 'add', weight: w, aRange: [10, 99], bRange: [10, 99],
  filter: (a, b) => ones(a) + ones(b) >= 10 && a + b <= 99 });
const sub2d2dB = (w = 1): PoolSpec => ({ kind: 'sub', weight: w, aRange: [10, 99], bRange: [10, 99],
  filter: (a, b) => ones(b) > ones(a) && a - b >= 1 });

// ── 第四章「银河」乘法与进阶 ──
// 口诀表：a,b ∈ [1,9]，至少一个因子 ∈ ts（如 ×2×5 → ts=[2,5]）
const mulTable = (ts: number[], w = 1): PoolSpec => ({ kind: 'mul', weight: w, aRange: [1, 9], bRange: [1, 9],
  filter: (a, b) => ts.includes(a) || ts.includes(b) });
// 档 48：a 或 b ∈ [2,5]，另一因子 ∈ [1,9]（排除两者都在 {1,6,7,8,9}）
const mul48 = (w = 1): PoolSpec => ({ kind: 'mul', weight: w, aRange: [1, 9], bRange: [1, 9],
  filter: (a, b) => (a >= 2 && a <= 5) || (b >= 2 && b <= 5) });
// 九九全口诀：a,b ∈ [2,9]
const mulAll = (w = 1): PoolSpec => ({ kind: 'mul', weight: w, aRange: [2, 9], bRange: [2, 9] });
const missMulB = (w = 1): PoolSpec => ({ ...mulAll(w), kind: 'missing-mul-b' });
const missMulA = (w = 1): PoolSpec => ({ ...mulAll(w), kind: 'missing-mul-a' });
// 乘加/乘减两步：a×b (op2) c，从左往右算，中间与最终结果 ∈ [1,100]
const chainMul = (op2: '+' | '-', w = 1): PoolSpec => ({ kind: 'chain3', weight: w, ops: ['×', op2],
  aRange: [2, 9], bRange: [2, 9], cRange: [1, 99],
  filter: (a, b, c) => {
    const s1 = a * b;
    if (s1 < 1 || s1 > 100) return false;
    const s2 = op2 === '+' ? s1 + c! : s1 - c!;
    return s2 >= 1 && s2 <= 100;
  } });

const B = (band: number, label: string, pools: PoolSpec[]): BandConfig =>
  ({ band, chapter: Math.ceil(band / 15) as 1 | 2 | 3 | 4, label, pools });

export const BANDS: BandConfig[] = [
  B(1, '5以内加法', [add([2, 5])]),
  B(2, '5以内减法', [sub([2, 5])]),
  B(3, '5以内混合', [add([2, 5]), sub([2, 5])]),
  B(4, '10以内加法·小', [add([2, 8])]),
  B(5, '10以内加法', [add([6, 10])]),
  B(6, '凑十', [add([9, 10])]),
  B(7, '10以内减法·小', [sub([2, 8])]),
  B(8, '10以内减法', [sub([6, 10])]),
  B(9, '10以内混合', [add([2, 10]), sub([2, 10])]),
  B(10, '不进位加法', [addNoCarry10()]),
  B(11, '不退位减法', [subNoBorrow10()]),
  B(12, '20以内混合', [addNoCarry10(), subNoBorrow10()]),
  B(13, '进位加法', [addCarry20()]),
  B(14, '缺数·10以内', [missB([2, 10])]),
  B(15, '缺数·20以内', [missB([11, 20], 3), addCarry20(2)]),          // 60/40
  B(16, '退位减法·小', [subBorrow([11, 14])]),
  B(17, '退位减法', [subBorrow([11, 18])]),
  B(18, '进退位混合', [addCarry20(), subBorrow([11, 18])]),
  B(19, '缺数?+b·10以内', [missA([2, 10])]),
  B(20, '缺数?+b·20以内', [missA([11, 20])]),
  B(21, '加法缺数混合', [missB([2, 20]), missA([2, 20])]),
  B(22, '减法缺数·10以内', [missSub([2, 10])]),
  B(23, '减法缺数·20以内', [missSub([11, 20])]),
  B(24, '缺数综合', [missB([2, 20]), missA([2, 20]), missSub([2, 20])]),
  B(25, '连加·10以内', [chain(['+', '+'], 10)]),
  B(26, '连加连减', [chain(['+', '+'], 20), chain(['-', '-'], 20)]),
  B(27, '加减混连', [chain(['+', '-'], 20), chain(['-', '+'], 20)]),
  B(28, '综合挑战I', [addCarry20(), subBorrow([11, 18]),
    chain(['+', '+'], 20), chain(['-', '-'], 20), chain(['+', '-'], 20), chain(['-', '+'], 20)]),
  B(29, '综合挑战II', [missB([2, 20]), missA([2, 20]), missSub([2, 20])]),
  B(30, '深海大挑战', [add([2, 10]), sub([2, 10]), addNoCarry10(), subNoBorrow10(),
    addCarry20(), subBorrow([11, 18]), missB([2, 20]), missA([2, 20]), missSub([2, 20]),
    chain(['+', '+'], 20), chain(['-', '-'], 20), chain(['+', '-'], 20), chain(['-', '+'], 20)]),
  B(31, '整十加法', [tensAdd()]),
  B(32, '整十减法', [tensSub()]),
  B(33, '整十混合', [tensAdd(), tensSub()]),
  B(34, '两位数+一位数', [add2d1dNC()]),
  B(35, '两位数−一位数', [sub2d1dNB()]),
  B(36, '混合', [add2d1dNC(), sub2d1dNB()]),
  B(37, '两位数+整十', [add2dTens()]),
  B(38, '两位数−整十', [sub2dTens()]),
  B(39, '混合', [add2dTens(), sub2dTens()]),
  B(40, '进位加法', [add2d1dC()]),
  B(41, '退位减法', [sub2d1dB()]),
  B(42, '进退位混合', [add2d1dC(), sub2d1dB()]),
  B(43, '两位数±两位数', [add2d2dNC(), sub2d2dNB()]),
  B(44, '两位数±两位数·进退位', [add2d2dC(), sub2d2dB()]),
  B(45, '远洋大挑战', [tensAdd(), tensSub(), add2d1dNC(), sub2d1dNB(), add2dTens(), sub2dTens(),
    add2d1dC(), sub2d1dB(), add2d2dNC(), sub2d2dNB(), add2d2dC(), sub2d2dB()]),
  // 第四章「银河」· 乘法与进阶
  B(46, '乘法入门 ×2 ×5', [mulTable([2, 5])]),
  B(47, '乘法 ×3 ×4', [mulTable([3, 4])]),
  B(48, '口诀 2–5 混合', [mul48()]),
  B(49, '乘法 ×6 ×7', [mulTable([6, 7])]),
  B(50, '乘法 ×8 ×9', [mulTable([8, 9])]),
  B(51, '九九全口诀', [mulAll()]),
  B(52, '乘法缺数 a×?=c', [missMulB()]),
  B(53, '乘法缺数 ?×b=c', [missMulA()]),
  B(54, '乘法缺数混合', [missMulB(), missMulA()]),
  B(55, '两位数进退位强化', [add2d2dC(), sub2d2dB()]),
  B(56, '乘加两步', [chainMul('+')]),
  B(57, '乘减两步', [chainMul('-')]),
  B(58, '口诀+缺数混合', [mulAll(), missMulB(), missMulA()]),
  B(59, '乘加减混合', [chainMul('+'), chainMul('-')]),
  B(60, '银河大挑战', [mulAll(), missMulB(), missMulA(), chainMul('+'), chainMul('-'),
    add2d2dC(), sub2d2dB()]),
];

export const bandOf = (band: number): BandConfig => {
  if (band < 1 || band > 60) throw new RangeError(`band out of range [1,60]: ${band}`);
  return BANDS[band - 1];
};
