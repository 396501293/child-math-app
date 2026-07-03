# 数学夜航 v1 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现「数学夜航」v1——4–7 岁儿童 iPad 横屏数学 PWA：3 章 × 15 关主线 + 无尽/限时模式，离线可玩，GitHub Pages 部署。

**Architecture:** 纯逻辑核心层（`src/core`，零 DOM、全单测：45 档约束生成器 / 干扰项 / 进度 / 持久化）+ Preact 薄 UI 层（1024×768 定画布等比缩放，三屏状态机）+ Web Speech 语音封装。规则权威来源是 `docs/superpowers/specs/2026-07-03-math-nightsail-design.md`（技术）与 `design_handoff_数学夜航/题库难度与模式设计.md`（题库/模式）；像素权威来源是 `design_handoff_数学夜航/数学夜航原型.dc.html` 与 `design_handoff_数学夜航/README.md` §Screens（后者以文字列出了全部颜色/字号/坐标值）。

**Tech Stack:** Preact + Vite + TypeScript、Vitest、vite-plugin-pwa（Workbox）、@fontsource/noto-sans-sc、GitHub Actions → GitHub Pages。

**约定：**
- TDD：先写测试（@superpowers:test-driven-development），核心层每个任务红→绿→提交。
- UI 像素还原不在本计划内联代码——实现时**必须打开原型 HTML 对照**，README §Screens 有全部数值；本计划只给组件契约与状态逻辑。
- 所有命令在仓库根 `/Users/chenji/Documents/workspace/child-math-app` 执行。

---

### Task 1: 项目脚手架

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `src/styles.css`, `tests/smoke.test.ts`

- [ ] **Step 1: 写 package.json**

```json
{
  "name": "math-nightsail",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "preact": "^10.24.0"
  },
  "devDependencies": {
    "@fontsource/noto-sans-sc": "^5.1.0",
    "@preact/preset-vite": "^2.9.0",
    "typescript": "^5.6.0",
    "vite": "^6.0.0",
    "vite-plugin-pwa": "^0.21.0",
    "vitest": "^2.1.0",
    "sharp": "^0.33.0"
  }
}
```

- [ ] **Step 2: 写 tsconfig.json / vite.config.ts / index.html / 入口**

`tsconfig.json`：`strict: true`，`jsx: "react-jsx"`，`jsxImportSource: "preact"`，`moduleResolution: "bundler"`，`types: ["vite/client"]`。

`vite.config.ts`（PWA 配置 Task 13 再加）：

```ts
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  base: '/child-math-app/',
  plugins: [preact()],
});
```

`index.html`：`<html lang="zh-CN">`、`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`、title「数学夜航」、`<div id="app">`、`<script type="module" src="/src/main.tsx">`。

`src/main.tsx`：`render(<App/>, document.getElementById('app')!)`。`src/ui/App.tsx` 暂时渲染 `<h1>数学夜航</h1>`。`src/styles.css` 先只放 `:root` 设计 token（颜色变量，值抄 README §Design Tokens）+ reset。

`tests/smoke.test.ts`：`expect(1+1).toBe(2)`。

- [ ] **Step 3: 安装并验证**

Run: `npm install && npm test && npm run build && npm run dev &`（dev 起后 curl 首页再杀掉）
Expected: 测试 1 passed；build 成功产出 `dist/`；dev 服务器返回 HTML。

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite + Preact + TS + Vitest"
```

---

### Task 2: core 类型与池枚举器

**Files:**
- Create: `src/core/types.ts`, `src/core/enumerate.ts`
- Test: `tests/core/enumerate.test.ts`

- [ ] **Step 1: 写 types.ts（spec §4.1 直译）**

```ts
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
```

- [ ] **Step 2: 写失败测试**

```ts
import { describe, expect, test } from 'vitest';
import { enumeratePool, itemKey } from '../../src/core/enumerate';

test('add pool: a+b<=5, operands>=1 has 10 items', () => {
  const items = enumeratePool({ kind: 'add', weight: 1, aRange: [1, 4], bRange: [1, 4],
    filter: (a, b) => a + b >= 2 && a + b <= 5 });
  expect(items).toHaveLength(10);
  for (const i of items) expect(i.operands[0] + i.operands[1]).toBeLessThanOrEqual(5);
});

test('chain3 pool respects stepwise bounds', () => {
  const items = enumeratePool({ kind: 'chain3', weight: 1, ops: ['+', '+'],
    aRange: [1, 10], bRange: [1, 10], cRange: [1, 10],
    filter: (a, b, c) => a + b <= 10 && a + b + c! <= 10 });
  expect(items).toHaveLength(120);
});

test('itemKey unique per item', () => {
  expect(itemKey({ kind: 'add', operands: [2, 3], ops: ['+'] }))
    .not.toBe(itemKey({ kind: 'missing-b', operands: [2, 3], ops: ['+'] }));
});
```

- [ ] **Step 3: 跑测试确认失败**（`npm test` → 模块不存在）

- [ ] **Step 4: 实现 enumerate.ts**

```ts
import type { Item, PoolSpec } from './types';

export const itemKey = (i: Item) => `${i.kind}|${i.ops.join('')}|${i.operands.join(',')}`;

export function enumeratePool(pool: PoolSpec): Item[] {
  const out: Item[] = [];
  for (let a = pool.aRange[0]; a <= pool.aRange[1]; a++)
    for (let b = pool.bRange[0]; b <= pool.bRange[1]; b++) {
      if (pool.kind === 'chain3') {
        for (let c = pool.cRange![0]; c <= pool.cRange![1]; c++)
          if (!pool.filter || pool.filter(a, b, c)) out.push({ kind: pool.kind, operands: [a, b, c], ops: [...pool.ops!] });
      } else if (!pool.filter || pool.filter(a, b)) {
        out.push({ kind: pool.kind, operands: [a, b],
          ops: [pool.kind === 'sub' || pool.kind === 'missing-sub' ? '-' : '+'] });
      }
    }
  return out;
}
```

- [ ] **Step 5: 测试转绿，Commit**（`feat(core): pool enumeration engine`）

---

### Task 3: 45 档配置表 bands.ts + 域大小断言

**Files:**
- Create: `src/core/bands.ts`
- Test: `tests/core/bands.test.ts`

这是题库规范三张表的数据化。**逐档约束、示例、组合数以 `题库难度与模式设计.md` §1 与附录为准**，实现完必须与附录数字逐一对上。

- [ ] **Step 1: 写失败测试（附录数字全表断言）**

```ts
import { expect, test } from 'vitest';
import { BANDS, bandOf } from '../../src/core/bands';
import { enumeratePool } from '../../src/core/enumerate';

const domainSize = (band: number) =>
  bandOf(band).pools.reduce((n, p) => n + enumeratePool(p).length, 0);

// 题库规范附录：42 个精确值（band → 组合数）
const EXACT: Record<number, number> = {
  1: 10, 2: 10, 3: 20, 4: 28, 5: 35, 6: 17, 7: 28, 8: 35, 9: 90,
  10: 45, 11: 45, 12: 90, 13: 36, 14: 45, 15: 181,
  16: 26, 17: 36, 18: 72, 19: 45, 20: 145, 21: 380, 22: 45, 23: 145,
  24: 570, 25: 120, 26: 2280, 27: 4940,
  31: 45, 32: 36, 33: 81, 34: 405, 35: 405, 36: 810, 37: 360, 38: 441,
  39: 801, 40: 360, 41: 396, 42: 756, 43: 4365, 44: 2880,
  45: 9693,   // 12 个子池合计（含跨池重复题面），见题库规范附录
};

test('all 45 bands exist with correct chapter', () => {
  expect(BANDS).toHaveLength(45);
  BANDS.forEach((b, i) => {
    expect(b.band).toBe(i + 1);
    expect(b.chapter).toBe(Math.ceil(b.band / 15));
  });
});

test('domain sizes match spec appendix exactly (42 bands)', () => {
  for (const [band, size] of Object.entries(EXACT)) expect(domainSize(+band), `band ${band}`).toBe(size);
});

test('challenge-mix bands 28-30 are at least as large as components', () => {
  expect(domainSize(28)).toBeGreaterThanOrEqual(36 + 36 + 1140 + 1140 + 4940 / 2);
  expect(domainSize(29)).toBe(570);
  expect(domainSize(30)).toBeGreaterThanOrEqual(570);
});

test('every item in every pool satisfies global constraints', () => {
  for (const cfg of BANDS) {
    const maxV = cfg.chapter === 3 ? 100 : 20;
    for (const pool of cfg.pools)
      for (const it of enumeratePool(pool)) {
        for (const n of it.operands) expect(n).toBeGreaterThanOrEqual(1);
        // 逐步结果 ∈ [1, maxV]
        let acc = it.operands[0];
        it.ops.forEach((op, k) => {
          acc = op === '+' ? acc + it.operands[k + 1] : acc - it.operands[k + 1];
          expect(acc).toBeGreaterThanOrEqual(1);
          expect(acc).toBeLessThanOrEqual(cfg.band <= 30 ? 20 : maxV);
        });
      }
  }
});
```

（band 31/33 整十加法可达 100——上面 `maxV` 对第三章取 100 已覆盖。）

- [ ] **Step 2: 跑测试确认失败**

- [ ] **Step 3: 实现 bands.ts**

用帮助函数构造池（完整代码如下，权重默认 1；`missX` 复用加/减法域，与 spec §4.1 的「operands 存真实值」一致）：

```ts
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

const B = (band: number, label: string, pools: PoolSpec[]): BandConfig =>
  ({ band, chapter: Math.ceil(band / 15) as 1 | 2 | 3, label, pools });

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
];

export const bandOf = (band: number): BandConfig => BANDS[band - 1];
```

- [ ] **Step 4: 测试转绿。若某档域大小不匹配，修 bands.ts 的约束（附录数字是对的，已用脚本双重验算过），不许改测试期望值**

- [ ] **Step 5: Commit**（`feat(core): 45 band configs, domain sizes verified against spec appendix`）

---

### Task 4: 干扰项 makeOptions

**Files:**
- Create: `src/core/options.ts`
- Test: `tests/core/options.test.ts`

规则见题库规范 §4。要点：距离档位（档 1–6 d∈{2,3}；档 7+ d∈{1,2}）、弄反（档 7+ 且 add/sub 计算题，50% 概率）、十位偏差 ±10（第三章，50% 概率）、整十题 d∈{10,20}、clamp [1, 章上限]、兜底扩距。

- [ ] **Step 1: 写失败测试（规范 §4 边界表逐条 + 性质）**

```ts
import { expect, test } from 'vitest';
import { makeOptions } from '../../src/core/options';
import { seeded } from './helpers';   // 见下

// tests/core/helpers.ts: 简单 LCG 种子 RNG
// export const seeded = (s: number) => () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;

const addItem = (a: number, b: number) => ({ kind: 'add' as const, operands: [a, b], ops: ['+' as const] });
const subItem = (a: number, b: number) => ({ kind: 'sub' as const, operands: [a, b], ops: ['-' as const] });

test('always 3 unique options containing the answer, in range', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const opts = makeOptions(subItem(3, 2), 1, 3, seeded(seed));   // correct=1, 档3
    expect(new Set(opts).size).toBe(3);
    expect(opts).toContain(1);
    for (const o of opts) { expect(o).toBeGreaterThanOrEqual(1); expect(o).toBeLessThanOrEqual(20); }
  }
});

test('correct=1 at band<=6 yields distractors {3,4}', () => {
  const opts = makeOptions(subItem(3, 2), 1, 3, seeded(7));
  expect([...opts].sort((x, y) => x - y)).toEqual([1, 3, 4]);
});

test('correct=19 at band 10: 21 clamped out', () => {
  for (let s = 1; s <= 100; s++)
    for (const o of makeOptions(addItem(12, 7), 19, 10, seeded(s))) expect(o).toBeLessThanOrEqual(20);
});

test('flipped distractor never out of range or equal to answer (17-4 → 21 discarded)', () => {
  for (let s = 1; s <= 200; s++) {
    const opts = makeOptions(subItem(17, 4), 13, 11, seeded(s));
    expect(opts).not.toContain(21);
  }
});

test('tens bands use d in {10,20}', () => {
  for (let s = 1; s <= 50; s++) {
    const opts = makeOptions(addItem(30, 20), 50, 31, seeded(s));
    for (const o of opts) expect(o % 10).toBe(0);
  }
});

test('chapter-3 options clamped to [1,100]', () => {
  for (let s = 1; s <= 100; s++)
    for (const o of makeOptions(addItem(50, 50), 100, 31, seeded(s))) {
      expect(o).toBeGreaterThanOrEqual(1); expect(o).toBeLessThanOrEqual(100);
    }
});
```

- [ ] **Step 2: 确认失败**

- [ ] **Step 3: 实现 options.ts**

```ts
import type { Item, Rng } from './types';

const shuffle = <T>(arr: T[], rng: Rng): T[] => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

export function makeOptions(item: Item, answer: number, band: number, rng: Rng): number[] {
  const maxV = band <= 30 ? 20 : 100;
  const isTens = band >= 31 && item.operands.every(n => n % 10 === 0);
  const dists = isTens ? [10, 20] : band <= 6 ? [2, 3] : [1, 2];
  const ok = (v: number) => v >= 1 && v <= maxV && v !== answer;
  const cands: number[] = [];

  // 特殊干扰（优先，但最多占一个名额）
  if (band >= 7 && (item.kind === 'add' || item.kind === 'sub') && rng() < 0.5) {
    const [a, b] = item.operands;
    const flipped = item.kind === 'add' ? a - b : a + b;
    if (ok(flipped)) cands.push(flipped);
  }
  if (band >= 31 && !isTens && cands.length === 0 && rng() < 0.5) {
    const shifted = answer + (rng() < 0.5 ? 10 : -10);
    if (ok(shifted)) cands.push(shifted);
  }

  // 距离干扰
  const near = shuffle(dists.flatMap(d => [answer + d, answer - d]), rng).filter(ok);
  for (const v of near) if (!cands.includes(v)) cands.push(v);

  // 兜底扩距
  for (let d = Math.max(...dists) + 1; cands.length < 2 && d <= maxV; d++)
    for (const v of [answer + d, answer - d])
      if (ok(v) && !cands.includes(v)) cands.push(v);

  return shuffle([answer, ...cands.slice(0, 2)], rng);
}
```

- [ ] **Step 4: 测试转绿。注意 `correct=1 档3` 用例：dists {2,3} → 负侧被 clamp，正侧恰 {3,4}**

- [ ] **Step 5: Commit**（`feat(core): distractor generation per spec §4`）

---

### Task 5: 生成器 generateQuestion / generateLevel / applyHardMode

**Files:**
- Create: `src/core/generator.ts`
- Test: `tests/core/generator.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { expect, test } from 'vitest';
import { applyHardMode, generateLevel, generateQuestion } from '../../src/core/generator';
import { bandOf } from '../../src/core/bands';
import { itemKey } from '../../src/core/enumerate';
import { seeded } from './helpers';

test('every band: 500 sampled questions satisfy invariants', () => {
  for (let band = 1; band <= 45; band++) {
    const cfg = bandOf(band);
    const rng = seeded(band * 97);
    for (let n = 0; n < 500; n++) {
      const q = generateQuestion(cfg, rng, []);
      expect(new Set(q.options).size).toBe(3);
      expect(q.options).toContain(q.answer);
      if (q.missingIndex !== undefined) expect(q.answer).toBe(q.operands[q.missingIndex]);
      expect(q.ttsText.length).toBeGreaterThan(0);
      if (cfg.chapter === 3) expect(q.blocksPlan).toBeUndefined();
      else { expect(q.blocksPlan).toBeDefined(); expect(q.blocksHint).toBeDefined(); }
    }
  }
});

test('band 15 level of 5 = exactly 3 missing + 2 carry', () => {
  for (let s = 1; s <= 30; s++) {
    const qs = generateLevel(bandOf(15), 5, seeded(s));
    expect(qs.filter(q => q.kind === 'missing-b')).toHaveLength(3);
    expect(qs.filter(q => q.kind === 'add')).toHaveLength(2);
  }
});

test('level questions unique and sorted by answer', () => {
  for (let band = 1; band <= 45; band++) {
    const qs = generateLevel(bandOf(band), 10, seeded(band));
    expect(new Set(qs.map(q => itemKey(q))).size).toBe(10);
    for (let i = 1; i < qs.length; i++) expect(qs[i].answer).toBeGreaterThanOrEqual(qs[i - 1].answer);
  }
});

test('recentKeys are avoided when possible', () => {
  const cfg = bandOf(1); // 域只有 10
  const rng = seeded(42);
  const recent: string[] = [];
  for (let n = 0; n < 8; n++) {
    const q = generateQuestion(cfg, rng, recent);
    expect(recent).not.toContain(itemKey(q));
    recent.push(itemKey(q));
    if (recent.length > 5) recent.shift();
  }
});

test('applyHardMode converts addition pools to missing-b in same domain', () => {
  const hard = applyHardMode(bandOf(13));
  expect(hard.pools[0].kind).toBe('missing-b');
  const q = generateQuestion(hard, seeded(1), []);
  expect(q.kind).toBe('missing-b');
  expect(q.operands[0] + q.operands[1]).toBeGreaterThanOrEqual(11); // 数域不变
  const hardSub = applyHardMode(bandOf(17));
  expect(hardSub.pools[0].kind).toBe('sub'); // 减法不变
});
```

- [ ] **Step 2: 确认失败**

- [ ] **Step 3: 实现 generator.ts**

```ts
import type { BandConfig, BlocksPlan, Item, Op, Question, Rng } from './types';
import { enumeratePool, itemKey } from './enumerate';
import { makeOptions } from './options';

const shuffle = <T>(arr: T[], rng: Rng): T[] => { /* 同 options.ts，可提到 core/rand.ts 复用 */ };

const evalItem = (it: Item): number =>
  it.ops.reduce((acc, op, k) => op === '+' ? acc + it.operands[k + 1] : acc - it.operands[k + 1], it.operands[0]);

// 加权选池
function pickPool(cfg: BandConfig, rng: Rng) {
  const total = cfg.pools.reduce((s, p) => s + p.weight, 0);
  let roll = rng() * total;
  for (const p of cfg.pools) { roll -= p.weight; if (roll < 0) return p; }
  return cfg.pools[cfg.pools.length - 1];
}

// 整关配比：floor(权重份额) + 余量按权重随机分配
export function allocate(cfg: BandConfig, count: number, rng: Rng): number[] {
  const total = cfg.pools.reduce((s, p) => s + p.weight, 0);
  const alloc = cfg.pools.map(p => Math.floor((p.weight / total) * count));
  let rest = count - alloc.reduce((a, b) => a + b, 0);
  while (rest-- > 0) alloc[cfg.pools.indexOf(pickPool(cfg, rng))]++;
  return alloc;
}

const opWord = (op: Op) => (op === '+' ? '加' : '减');

function toQuestion(it: Item, cfg: BandConfig, rng: Rng): Question {
  const [a, b] = it.operands;
  let answer: number, missingIndex: number | undefined, ttsText: string;
  switch (it.kind) {
    case 'add': case 'sub': case 'chain3': {
      answer = evalItem(it);
      ttsText = it.kind === 'chain3'
        ? `${a} ${opWord(it.ops[0])} ${b} 再${opWord(it.ops[1])} ${it.operands[2]}，等于几？`
        : `${a} ${opWord(it.ops[0])} ${b} 等于几？`;
      break;
    }
    case 'missing-b': { answer = b; missingIndex = 1; ttsText = `${a} 加上几，等于 ${a + b}？`; break; }
    case 'missing-a': { answer = a; missingIndex = 0; ttsText = `几加上 ${b}，等于 ${a + b}？`; break; }
    case 'missing-sub': { answer = b; missingIndex = 1; ttsText = `${a} 减去几，等于 ${a - b}？`; break; }
  }
  const q: Question = { kind: it.kind, operands: it.operands, ops: it.ops, missingIndex,
    answer, options: makeOptions(it, answer, cfg.band, rng), ttsText };
  if (cfg.chapter !== 3) attachBlocks(q);
  return q;
}

function attachBlocks(q: Question): void {
  const [a, b] = q.operands;
  switch (q.kind) {
    case 'add': q.blocksPlan = { type: 'two-group', a, b };
      q.blocksHint = `先数 ${a} 个，再数 ${b} 个，一共几个？`; break;
    case 'sub': q.blocksPlan = { type: 'divide-out', total: a, crossOut: b };
      q.blocksHint = `${a} 个方块，划掉 ${b} 个，剩下几个？`; break;
    case 'missing-b': q.blocksPlan = { type: 'fill-slot', filled: a, empty: b, filledFirst: true };
      q.blocksHint = `已经有 ${a} 个，再填几个才是 ${a + b} 个？`; break;
    case 'missing-a': q.blocksPlan = { type: 'fill-slot', filled: b, empty: a, filledFirst: false };
      q.blocksHint = `后面有 ${b} 个，前面填几个才是 ${a + b} 个？`; break;
    case 'missing-sub': q.blocksPlan = { type: 'keep-mark', total: a, keep: a - b };
      q.blocksHint = `${a} 个方块，要剩下 ${a - b} 个，得划掉几个？`; break;
    case 'chain3': q.blocksPlan = { type: 'three-group',
      groups: [q.operands[0], q.operands[1], q.operands[2]], ops: q.ops as [Op, Op] };
      q.blocksHint = `一组一组数，${q.ttsText}`; break;
  }
}

export function applyHardMode(cfg: BandConfig): BandConfig {
  return { ...cfg, pools: cfg.pools.map(p => (p.kind === 'add' ? { ...p, kind: 'missing-b' } : p)) };
}

export function generateQuestion(cfg: BandConfig, rng: Rng, recentKeys: string[]): Question {
  const pool = pickPool(cfg, rng);
  let items = enumeratePool(pool).filter(i => !recentKeys.includes(itemKey(i)));
  if (items.length === 0) items = enumeratePool(pool);
  return toQuestion(items[Math.floor(rng() * items.length)], cfg, rng);
}

export function generateLevel(cfg: BandConfig, count: number, rng: Rng): Question[] {
  const alloc = allocate(cfg, count, rng);
  const used = new Set<string>();
  const picked: Item[] = [];
  cfg.pools.forEach((pool, pi) => {
    const items = shuffle(enumeratePool(pool).filter(i => !used.has(itemKey(i))), rng);
    for (let n = 0; n < alloc[pi]; n++) { picked.push(items[n]); used.add(itemKey(items[n])); }
  });
  return picked.map(i => toQuestion(i, cfg, rng)).sort((x, y) => x.answer - y.answer);
}
```

注意：band 15 权重 3:2 → `allocate(…, 5)` = floor(3)=3、floor(2)=2，无余量——测试断言恰好 3+2。**禁止**在合并域上均匀抽样（spec §4.2 明令）。

- [ ] **Step 4: 测试转绿；`npm test` 全套跑通**

- [ ] **Step 5: Commit**（`feat(core): weighted question generator with per-level mix ratios`）

---

### Task 6: 进度与模式逻辑 progression.ts

**Files:**
- Create: `src/core/progression.ts`
- Test: `tests/core/progression.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
import { expect, test } from 'vitest';
import { chapterOf, endlessBand, endlessUnlocked, starsFor, timedPool, timedUnlocked, unlockAfterWin }
  from '../../src/core/progression';
import { defaultProgress } from '../../src/core/storage';

test('starsFor', () => {
  expect(starsFor(0)).toBe(3); expect(starsFor(1)).toBe(2);
  expect(starsFor(2)).toBe(2); expect(starsFor(3)).toBe(1);
});

test('chapterOf boundaries', () => {
  expect(chapterOf(1)).toBe(1); expect(chapterOf(15)).toBe(1);
  expect(chapterOf(16)).toBe(2); expect(chapterOf(30)).toBe(2); expect(chapterOf(31)).toBe(3);
});

test('endlessBand: starts at current chapter first band, +1 per 4 correct, capped', () => {
  expect(endlessBand(0, 4)).toBe(1);
  expect(endlessBand(3, 4)).toBe(1);
  expect(endlessBand(4, 4)).toBe(2);
  expect(endlessBand(99, 4)).toBe(4);           // 封顶 maxUnlocked
  expect(endlessBand(0, 17)).toBe(16);           // 第二章起步档 16
  expect(endlessBand(4, 17)).toBe(17);
});

test('mode unlock gates: stars on level 3 / level 9', () => {
  const p = defaultProgress();
  expect(endlessUnlocked(p)).toBe(false); expect(timedUnlocked(p)).toBe(false);
  p.stars[3] = 1; expect(endlessUnlocked(p)).toBe(true);
  p.stars[9] = 2; expect(timedUnlocked(p)).toBe(true);
});

test('timedPool: completed bands within current + previous chapter only', () => {
  const p = defaultProgress();
  for (let l = 1; l <= 16; l++) p.stars[l] = 3;
  p.unlocked = 17;                                // 当前章 = 2
  expect(timedPool(p)).toEqual([...Array(16)].map((_, i) => i + 1)); // 章1+2 已完成档
  const p3 = defaultProgress();
  for (let l = 1; l <= 31; l++) p3.stars[l] = 1;
  p3.unlocked = 32;                               // 当前章 = 3 → 只含章 2、3
  expect(timedPool(p3)).toEqual([...Array(16)].map((_, i) => i + 16));
});

test('unlockAfterWin: extends unlocked, keeps best stars', () => {
  const p = defaultProgress();
  const p2 = unlockAfterWin(p, 1, 2);
  expect(p2.unlocked).toBe(2); expect(p2.stars[1]).toBe(2);
  const p3 = unlockAfterWin(p2, 1, 1);
  expect(p3.stars[1]).toBe(2);                    // 取历史最高
  const p4 = unlockAfterWin(p3, 45, 3);
  expect(p4.unlocked).toBe(45);                   // 上限 45
});
```

- [ ] **Step 2: 确认失败 → Step 3: 实现**

```ts
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
  return { ...p,
    stars: { ...p.stars, [level]: Math.max(p.stars[level] ?? 0, stars) as 0 | 1 | 2 | 3 },
    unlocked: Math.max(p.unlocked, Math.min(level + 1, 45)) };
}
```

- [ ] **Step 4: 转绿 → Step 5: Commit**（`feat(core): progression & mode logic`）

---

### Task 7: 持久化 storage.ts

**Files:**
- Create: `src/core/storage.ts`
- Test: `tests/core/storage.test.ts`

- [ ] **Step 1: 写失败测试**（注入 StorageLike 假实现；用例：默认值 / v2 往返 / v1 迁移保留原 key / JSON 损坏拷贝到 `_corrupt` 并重置 / setItem 抛异常时内存兜底且 load 能读回）

```ts
import { expect, test } from 'vitest';
import { defaultProgress, loadProgress, saveProgress } from '../../src/core/storage';

const fakeStore = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
};

test('default progress shape', () => {
  const p = defaultProgress();
  expect(p).toMatchObject({ version: 2, unlocked: 1,
    endless: { bestStreak: 0, totalAnswered: 0 }, timed: { bestCount: 0 },
    settings: { questionCount: 5, hardMode: false, showBlocks: true, showBlocksTimed: false } });
});

test('save/load round-trip', () => {
  const s = fakeStore();
  const p = defaultProgress(); p.unlocked = 7; p.stars[3] = 2;
  saveProgress(p, s);
  expect(loadProgress(s)).toEqual(p);
});

test('migrates prototype v1 data and keeps original key', () => {
  const s = fakeStore({ math_nightsail_v1: JSON.stringify({ stars: { 1: 3, 2: 2 }, unlocked: 3 }) });
  const p = loadProgress(s);
  expect(p.version).toBe(2); expect(p.stars[1]).toBe(3); expect(p.unlocked).toBe(3);
  expect(s.dump()).toHaveProperty('math_nightsail_v1');   // 原 key 不删
  expect(s.dump()).toHaveProperty('math_nightsail_v2');   // 迁移即落盘
});

test('corrupt v2 JSON → copied to backup key, reset to default', () => {
  const s = fakeStore({ math_nightsail_v2: '{oops' });
  const p = loadProgress(s);
  expect(p).toEqual(defaultProgress());
  expect(s.dump().math_nightsail_v2_corrupt).toBe('{oops');
});

test('storage throwing → in-memory fallback works for the session', () => {
  const boom = { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); },
    removeItem: () => {} };
  const p = defaultProgress(); p.unlocked = 9;
  saveProgress(p, boom);                 // 不抛
  expect(loadProgress(boom).unlocked).toBe(9);   // 内存兜底读回
});
```

- [ ] **Step 2: 确认失败 → Step 3: 实现**（`StorageLike` 接口 + 默认参数 `globalThis.localStorage`；模块级 `let mem: Progress | null` 兜底；v1 迁移把 `stars`/`unlocked` 合入 `defaultProgress()`）

- [ ] **Step 4: 转绿 → Step 5: Commit**（`feat(core): v2 persistence with v1 migration and fallbacks`）

---

### Task 8: 语音 tts.ts + 缩放 scale.ts

**Files:**
- Create: `src/audio/tts.ts`, `src/ui/scale.ts`
- Test: `tests/core/scale.test.ts`（scale 纯函数可测；tts 是 DOM API 薄封装，手动验证）

- [ ] **Step 1: scale 失败测试**

```ts
import { expect, test } from 'vitest';
import { stageScale } from '../../src/ui/scale';
test('scale = min(vw/1024, vh/768)', () => {
  expect(stageScale(2048, 1536)).toBe(2);
  expect(stageScale(1024, 384)).toBe(0.5);
  expect(stageScale(512, 768)).toBe(0.5);
});
```

- [ ] **Step 2: 实现 scale.ts**（`stageScale(w,h)` 纯函数 + `useStageScale()` hook：监听 resize/orientationchange，返回 scale；App 外层 `<div id="stage">` 定宽高 1024×768，`transform: scale(s)`、`transform-origin: center`、flex 居中）

- [ ] **Step 3: 实现 tts.ts**（spec §6）

```ts
let voice: SpeechSynthesisVoice | null = null;
let ready = false;

function pickVoice(): void {
  const list = speechSynthesis.getVoices();
  voice = list.find(v => v.lang.startsWith('zh') && v.localService)
       ?? list.find(v => v.lang.startsWith('zh')) ?? null;
  ready = true;
}

export function initTTS(): void {
  if (!('speechSynthesis' in globalThis)) { ready = true; return; }
  pickVoice();
  speechSynthesis.addEventListener('voiceschanged', pickVoice); // iOS 首次列表为空
}

export const ttsAvailable = (): boolean => !!voice;

export function speak(text: string, opts: { interrupt?: boolean } = {}): void {
  if (!voice) return;                                  // 静默降级
  if (opts.interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice; u.lang = voice.lang; u.rate = 0.9;
  speechSynthesis.speak(u);
}

export const stopTTS = (): void => { if ('speechSynthesis' in globalThis) speechSynthesis.cancel(); };
```

`initTTS()` 在 `src/main.tsx` 顶部、`render()` 之前调用一次。

- [ ] **Step 4: `npm test` 转绿；Commit**（`feat: tts wrapper + stage scaling`）

---

### Task 9: App 状态机 + 地图屏

**Files:**
- Create: `src/ui/screens/Map.tsx`, `src/ui/components/Mascot.tsx`, `src/ui/components/RotateOverlay.tsx`
- Modify: `src/ui/App.tsx`, `src/styles.css`

**像素对照源：README §Screens「1. 关卡地图」逐条列了数值；原型 `数学夜航原型.dc.html` 可直接开在浏览器旁对比。**

- [ ] **Step 1: App 状态机**

```ts
type Screen = 'map' | 'quiz' | 'result';
type Mode = 'campaign' | 'endless' | 'timed';
interface Session {
  mode: Mode; level?: number;             // campaign
  questions?: Question[]; qIndex: number; // campaign 预生成；模式流式
  wrongThis: number; wrongTotal: number; excluded: number[];
  feedback: 'right' | 'wrong' | null;
  correctCount: number; streak: number; runBestStreak: number;
  timeLeftMs?: number; recentKeys: string[];
  current?: Question;                     // endless/timed 当前题
}
```

App 持 `progress`（useState，初始 `loadProgress()`；任何更新即 `saveProgress`）与 `session`。回调下传：`startLevel(n)`、`startEndless()`、`startTimed()`、`answer(option)`、`exitToMap()`、`replayTts()`。`startLevel` 用 `generateLevel(applyIfHard(bandOf(n)), settings.questionCount, Math.random)`，其中 `applyIfHard = cfg => settings.hardMode ? applyHardMode(cfg) : cfg`（模式同样套用）。

- [ ] **Step 2: Map.tsx**

内容与行为（值抄 README §1）：背景渐变 + 星点；顶栏标题「数学夜航 · 第N章 章名」+ 已完成计数 + 星星胶囊（当前章星数）；左路径面板：**章节切换**（面板顶部：`‹ 第二章 · 深海 ›`，箭头 68×68 同返回键样式，未解锁章置灰+🔒，只影响浏览不影响进度）+ 蛇形虚线路径（SVG polyline，dash）+ 15 节点（三种状态：完成=琥珀+星级；当前=白底红框脉冲；锁定=半透明）；右面板：Mascot + 欢迎语 + 🔊 + CTA「挑战第 N 关 ▶」+ **两个模式入口按钮**（未解锁置灰+🔒；刚解锁角标「新玩法！」——用 localStorage 标记 seen）。齿轮按钮（右下角 48×48，`rgba(255,255,255,.25)`）本任务只占位，Task 12 接。

Mascot.tsx：README §Assets 的几何吉祥物（琥珀圆角脸+深色眼+白高光+嘴），props `pose: 'idle'|'happy'|'cheer'`（v1 三种姿态用眼嘴参数微调），floaty 动画。

- [ ] **Step 3: 手动验证**

Run: `npm run dev`，浏览器开 1024×768 与任意窗口尺寸对比原型：布局、缩放、节点状态、章节切换置灰、模式入口置灰。竖屏（窄窗口）出 RotateOverlay。
Expected: 与原型地图屏视觉一致；点当前关进入（quiz 屏可先是占位）。

- [ ] **Step 4: Commit**（`feat(ui): app state machine + map screen with chapters & mode entries`）

---

### Task 10: 答题屏（主线）+ 计数块 + 选项

**Files:**
- Create: `src/ui/screens/Quiz.tsx`, `src/ui/components/QuestionRow.tsx`, `src/ui/components/Options.tsx`, `src/ui/components/Blocks.tsx`, `src/ui/components/FeedbackOverlay.tsx`
- Modify: `src/ui/App.tsx`, `src/styles.css`

**像素对照源：README §Screens「2. 答题」。**

- [ ] **Step 1: QuestionRow.tsx**

由 `Question` 渲染等式：计算题 `a op b = [?]`、chain3 `a op b op c = [?]`、缺数题在 `missingIndex` 处放虚线未知框、等式结果处显示计算出的 c。96px/900，运算符与等号琥珀；**chain3 与两位数题（任一操作数 ≥10）字号降至 76px**（spec §5）。未知框样式抄 README（120×120 虚线框）。

- [ ] **Step 2: Blocks.tsx（受 blocksPlan 驱动，组件不含题型知识）**

| plan.type | 渲染 | 交互 |
|---|---|---|
| two-group | a 个青绿 + b 个琥珀 | 点击变暗 opacity .55，可还原 |
| divide-out | total 个青绿 | 点击→红底+✕，再点还原 |
| fill-slot | filled 个实心（filledFirst 决定先后）+ empty 个虚线空槽 | 点空槽填充琥珀，可再点清空 |
| keep-mark | total 个青绿，其中 keep 个带角标「留」 | 无角标块可点✕划掉 |
| three-group | 三组分色：青绿/琥珀/白 .85 | 点击变暗，同 two-group |

尺寸/颜色/圆角抄 README §2；面板下方提示行 = `🔊 {q.blocksHint}`，点击行重播 blocksHint 语音。`showBlocks=false` 或 `blocksPlan===undefined`（第三章）时整个面板不渲染。

- [ ] **Step 3: Options.tsx + FeedbackOverlay.tsx + Quiz.tsx 组装**

答题逻辑（README §2 交互）：
- 答对：选项变青绿；遮罩+「太棒了！ ★」pop；1.1s 后 `qIndex+1` 或进结算。`speak('答对啦！', {interrupt:true})`。
- 答错：选项 shake 0.4s 后保持 60% 透明进入 `excluded`；遮罩红「再试一次！」0.9s；`wrongThis++`、`wrongTotal++`；同题继续可答。
- 顶栏：返回键（campaign 中途退出=放弃本关，直接回地图不结算）、进度条（宽度动画 .4s）、`n/5`、🔊 重播键（重播 `q.ttsText`）。
- 切题时 `speak(q.ttsText, {interrupt:true})` 自动朗读。

- [ ] **Step 4: 手动验证**

Run: `npm run dev`。走查：第 1 关 5 题全对→结算占位；答错→排除+可重试；缺数题（改 URL/临时把 unlocked 调到 14）虚线框与空槽教具正确；hardMode 开关后加法全变缺数。
Expected: 与原型答题屏一致。

- [ ] **Step 5: Commit**（`feat(ui): quiz screen with blocks manipulatives and feedback`）

---

### Task 11: 结算屏 + 主线闭环

**Files:**
- Create: `src/ui/screens/Result.tsx`
- Modify: `src/ui/App.tsx`

- [ ] **Step 1: Result.tsx（campaign 变体，README §3）**

Mascot(happy/cheer) → 「第 N 关完成！」→ 星级 pop（`starsFor(wrongTotal)`）→ 副文案 + 🔊（朗读祝贺）→ 按钮「回地图」/「下一关 ▶」（第 45 关无；章末 15/30 关显示「进入第二/三章 ▶」）。

- [ ] **Step 2: 闭环逻辑**：结算时 `progress = unlockAfterWin(progress, level, stars)` 并 `saveProgress`；回地图后节点状态/星数刷新；「下一关」直接 `startLevel(level+1)`。

- [ ] **Step 3: 手动验证**：连通关 3 关，刷新页面进度还在；故意错 3 次拿 1 星，重打拿 3 星，保留 3 星。

- [ ] **Step 4: Commit**（`feat(ui): result screen, campaign loop with persistence`）

---

### Task 12: 无尽模式 + 限时模式 + 家长设置

**Files:**
- Create: `src/ui/components/StreakBar.tsx`, `src/ui/components/TimerBar.tsx`, `src/ui/components/SettingsModal.tsx`
- Modify: `src/ui/App.tsx`, `src/ui/screens/Quiz.tsx`, `src/ui/screens/Result.tsx`

- [ ] **Step 1: 无尽模式**

- 出题流：答对后 `correctCount++`，下一题 `generateQuestion(applyIfHard(bandOf(endlessBand(correctCount, progress.unlocked))), Math.random, recentKeys)`；`recentKeys` 滚动保留 5。
- 顶栏变体 StreakBar：`🔥×streak` + 航行距离（小船 `⛵`/几何船形沿虚线前进，每答对一格，20 格循环）。答错 `streak=0`，不计入其他惩罚。
- 返回键=结束本轮→Result 无尽变体：「本轮答对 N 题！」+ 最高连对；更新 `endless.bestStreak`（破纪录额外庆祝文案+语音）与 `totalAnswered`。

- [ ] **Step 2: 限时模式**

- 计时：`performance.now()` 基准，rAF 更新；起始 60_000ms，答对 `+8_000` 上限 90_000；`document.visibilitychange` 隐藏时记账暂停。答错不扣时。
- 抽题：每题从 `timedPool(progress)` 均匀抽一个档 → `generateQuestion`。计数块按 `settings.showBlocksTimed`（默认 false）。
- TimerBar：琥珀填充随时间缩短；答对回弹动画；≤10s 变 `#E85D5D`（无音效）。
- 时间到→Result 限时变体：「时间到！你答对了 N 题！」+ 个人最佳；更新 `timed.bestCount`。
- 无尽/限时中途返回键行为：无尽=正常结算；限时=放弃本轮回地图（不记录）。

- [ ] **Step 3: SettingsModal**

齿轮**长按 1.5s**（pointerdown/up 计时，移出取消）打开：`questionCount`(3–10 步进)、`hardMode`、`showBlocks`、`showBlocksTimed`、重置进度（点两次确认，二次按钮红色）。改动即 `saveProgress`。

- [ ] **Step 4: 手动验证**

无尽：完成第 3 关后入口点亮；从档 1 起每对 4 题升档（console 打印当前档核对）；封顶当前解锁档。限时：完成第 9 关后点亮；+8s 上限 90s 生效；切后台回来时间没少。设置：长按才开；重置后回初始。
Expected: 全部符合题库规范 §2。

- [ ] **Step 5: Commit**（`feat(ui): endless & timed modes, parent settings`）

---

### Task 13: 语音全接入 + PWA + 字体 + 图标

**Files:**
- Create: `public/manifest 相关（vite-plugin-pwa 生成）`, `scripts/gen-icons.mjs`, `public/icons/*`
- Modify: `vite.config.ts`, `src/main.tsx`, `index.html`, `src/styles.css`

- [ ] **Step 1: 语音接入点走查**（题库规范 §7 + README Interactions）：进地图欢迎语（首次交互后）、切题自动朗读、计数块提示行、答对/答错反馈、结算祝贺、模式入口介绍（点入口时）、冲刺开始/时间到、破纪录祝贺、章节解锁祝贺。全部经 `speak()`；🔊 图标在 `!ttsAvailable()` 时置灰。

- [ ] **Step 2: 字体**：`import '@fontsource/noto-sans-sc/500.css'`（+700/900）于 main.tsx；styles.css `font-family: 'Noto Sans SC', 'PingFang SC', sans-serif`。构建后检查 `dist/` 体积：CJK 分片全预缓存可能达 10–20MB，若超过 ~8MB 则改为只打包 700/900 两档（500 落到 PingFang SC 系统字体），或在验收后追加真子集化任务。

- [ ] **Step 3: 图标**：`scripts/gen-icons.mjs` 用 sharp 把手写的吉祥物 SVG（琥珀圆角方脸 #F2A541、深色眼 #12333E、白高光，背景 #12333E）渲染为 192/512/apple-touch-icon 180；`index.html` 加 `<link rel="apple-touch-icon">`。

- [ ] **Step 4: vite-plugin-pwa**

```ts
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: '数学夜航', short_name: '数学夜航',
    display: 'fullscreen', orientation: 'landscape',
    background_color: '#12333E', theme_color: '#12333E', start_url: '.',
    icons: [/* 192, 512 */],
  },
  workbox: { globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'] },
})
```

- [ ] **Step 5: 验证**

Run: `npm run build && npm run preview`。检查：Lighthouse/DevTools Application 面板 SW 激活、manifest 正确；断网刷新可玩；字体三档字重生效（对照原型 900 粗标题）。
Expected: 离线完整可用。

- [ ] **Step 6: Commit**（`feat: full tts wiring, PWA offline, fonts, icons`）

---

### Task 14: GitHub Actions 部署 + 仓库 README

**Files:**
- Create: `.github/workflows/deploy.yml`, `README.md`（仓库根）

- [ ] **Step 1: deploy.yml**

```yaml
name: Deploy to GitHub Pages
on:
  push: { branches: [main] }
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}   # 注意：${{ }} 不能放在 { } flow mapping 里，必须块式写法
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 仓库 README.md**：项目简介、`npm install / dev / test / build`、部署说明（GitHub 仓库 Settings→Pages→Source 选 GitHub Actions；仓库名须为 `child-math-app` 与 vite `base` 一致）、iPad 安装步骤（Safari 打开 → 分享 → 添加到主屏幕）。

- [ ] **Step 3: 验证**：`npm test && npm run build` 本地过；yml 用 `npx yaml-lint` 或 actionlint 校验（没有就目检）。推送与开 Pages 由用户在 GitHub 建仓后执行——**本任务不推远端**。

- [ ] **Step 4: Commit**（`ci: GitHub Pages deploy workflow + repo readme`）

---

### Task 15: 手动验收清单（发布前必过）

**Files:** 无新文件；发现问题按 @superpowers:systematic-debugging 修复并补测试。

- [ ] 桌面浏览器全流程：45 关跳查（第 1/6/13/16/25/31/40/45 关各打一遍，覆盖全部题型与教具类型）
- [ ] 星级/解锁/章节切换/重玩取最高星，刷新不丢
- [ ] 无尽：解锁门槛、起始档、每 4 题升档、封顶、连对中断、纪录持久化
- [ ] 限时：解锁门槛、+8s/上限 90s、后台暂停、结算与最佳纪录
- [ ] hardMode / questionCount / showBlocks / showBlocksTimed 生效；重置进度二次确认
- [ ] 原型 v1 localStorage 数据迁移（手工注入 `math_nightsail_v1` 验证）
- [ ] 竖屏遮罩；任意窗口尺寸等比缩放无变形
- [ ] iPad Safari 实机：添加到主屏幕、全屏、离线断网可玩、TTS 中文发声、点击目标不误触
- [ ] 对照原型逐屏截图比对（1024×768 窗口）
- [ ] 全部通过后 Commit（`chore: v1 acceptance pass`）；用 @superpowers:verification-before-completion 确认后再宣布完成

---

## 执行提示

- 任务顺序即依赖顺序：1→2→3→4→5（core 链）；6、7、8 可并行；9→10→11→12（UI 链）；13→14→15 收尾。
- 核心层（Task 2–7）**严格 TDD**；UI 层以原型为准手动验证，逻辑尽量下沉 core。
- 每个任务一个 commit（或按步骤多个小 commit），信息用 conventional commits。
