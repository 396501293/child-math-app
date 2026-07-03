# 数学夜航 · 技术设计规范（v1 实现）

日期：2026-07-03 ｜ 状态：已获用户批准的设计，待实现规划

## 1. 背景与目标

「数学夜航」是面向 4–7 岁儿童的 iPad 横屏数学学习应用（加减法，主线 3 章 × 15 关 + 无尽/限时两个练习模式）。目前仓库只有设计资产，无代码。本文档定义 v1 的技术实现方案。

**权威参考文件（本仓库内，实现时必须遵循）：**

- `design_handoff_数学夜航/数学夜航原型.dc.html` — 高保真可交互原型：三屏（地图/答题/结算）的颜色、字号、间距、动画、交互逻辑均以此为准，像素级还原（1024×768 逻辑画布等比缩放）。
- `design_handoff_数学夜航/题库难度与模式设计.md` — 题库规则权威来源：45 个难度档的约束表、干扰项规则、无尽/限时模式规则、计数块教具适配、新增 UI 清单、逐档组合数。
- `design_handoff_数学夜航/README.md` — 整体交接说明（其「出题规则」条已被上一文件替代）。

**已确认的交付决策：** Web 应用（PWA），Safari「添加到主屏幕」使用，全屏、离线可用；部署 GitHub Pages；技术栈 Preact + Vite + TypeScript。

## 2. 范围

**v1 包含**：三屏核心循环（3 章 45 关主线、章节切换）、无尽模式「无尽夜航」、限时模式「星光冲刺」、计数块教具（第一、二章）、Web Speech 中文语音、家长设置（长按进入）、进度持久化（含原型 v1 数据迁移）、PWA 离线、GitHub Pages 自动部署。

**v1 不包含**（规范中已标注为后续）：插画版吉祥物（沿用几何占位）、第三章「十条+散块」教具（第三章默认隐藏计数块）、预生成音频、云同步、第四章内容（乘法/时钟/人民币）、UI 自动化测试。

## 3. 仓库与总体结构

`child-math-app/` 为 git 仓库根（设计资产与代码同仓）：

```
child-math-app/
  design_handoff_数学夜航/     # 设计资产（已有）
  docs/superpowers/specs/      # 本文档
  src/
    core/                      # 纯逻辑，零 DOM 依赖，100% 单测
      types.ts                 # Question / BandConfig / Progress / BlocksPlan
      bands.ts                 # 45 档配置表（题库规范三张表的数据化直译）
      generator.ts             # 约束生成器：枚举合法域→抽样→干扰项→去重→排序
      progression.ts           # 星级 / 解锁 / 无尽爬档 / 限时抽题池
      storage.ts               # localStorage v2 读写 + v1 迁移 + 降级
    audio/
      tts.ts                   # Web Speech 封装
    ui/
      App.tsx                  # 顶层状态机：screen × mode
      screens/                 # Map.tsx / Quiz.tsx / Result.tsx
      components/              # QuestionRow / Options / Blocks / TimerBar /
                               # StreakBar / Mascot / SettingsModal / RotateOverlay
      scale.ts                 # 1024×768 等比缩放
    styles.css                 # 设计 token（颜色/字号/圆角/阴影/动画）直译自原型
  public/                      # manifest.webmanifest、图标（几何吉祥物）
  .github/workflows/deploy.yml # push main → 构建 → GitHub Pages
```

## 4. 核心逻辑层（src/core）

### 4.1 数据模型

```ts
type Op = '+' | '-';
type QuestionKind =
  | 'add' | 'sub'            // a op b = ?
  | 'missing-a'              // ? + b = c
  | 'missing-b'              // a + ? = c
  | 'missing-sub'            // a − ? = c
  | 'chain3';                // a op b op c = ?（连算）

interface Question {
  kind: QuestionKind;
  operands: number[];        // 等式的全部真实数值：[a,b] 或 [a,b,c]（缺数题也存完整值）
  ops: Op[];                 // 1 个或 2 个
  missingIndex?: number;     // 缺数题：operands 中被隐藏（待答）项的下标，
                             //   此时 answer === operands[missingIndex]，等式结果单独展示
                             // 计算题：undefined，answer = 运算结果（不在 operands 中）
  answer: number;
  options: number[];         // 3 个，含 answer，已乱序
  ttsText: string;           // 朗读文案（数字重读由 UI 层拆分处理）
  blocksPlan?: BlocksPlan;   // 计数块渲染方案；第三章为 undefined
}

interface BandConfig { band: number; /* 约束域描述，形态见题库规范 §3 */ }

interface Progress {
  version: 2;
  stars: Record<number, 0 | 1 | 2 | 3>;   // 关 1..45
  unlocked: number;                        // 1..45
  endless: { bestStreak: number; totalAnswered: number };
  timed: { bestCount: number };
  settings: {
    questionCount: number;      // 3–10，仅主线
    hardMode: boolean;          // 加法计算题转 a+?=c（见 4.2）
    showBlocks: boolean;        // 主线/无尽的计数块开关，默认 true
    showBlocksTimed: boolean;   // 限时模式单独开关，默认 false（题库规范 §2.2）
  };
}
```

### 4.2 生成器

```ts
generateQuestion(cfg: BandConfig, rng: Rng, recentKeys: string[]): Question
generateLevel(cfg: BandConfig, count: number, rng: Rng): Question[]
```

- **实现策略：枚举 + 两段式加权抽样**。混合档（`mix`）先按 `weight` 选中子池，再在子池内穷举合法组合（最大子池 4940 个，性能无虞）并均匀抽取；过滤 `recentKeys`（模式滚动去重，最近 5 题）。单一子池即退化为均匀抽样。若直接对合并域均匀抽样，band 15 的 60/40 会因子池大小悬殊（145 vs 36）跑成 80/20——禁止这种实现。
- `generateLevel`：混合档**按整关强制配比**——各子池题数 = round(weight × count) 并修正总和（如 5 题 60/40 → 3+2；「各半」5 题 → 3+2，多出的 1 题随机归属），子池内抽样去重后合并；整关题面两两不同（题面 key = operands+ops+missingIndex），按答案升序排列（首题不为最难）。
- **hardMode 变换**：生成前的配置预处理 `applyHardMode(cfg)`（所有生成入口统一走它）——把加法计算子池（add/凑十/进退位加法）替换为同数域的 `a+?=c` 缺数形态；减法与连算不变。
- **干扰项**：按题库规范 §4 实现——距离干扰（档 1–6 d∈{2,3}，档 7+ d∈{1,2}）、弄反干扰（档 7+，50% 概率）、十位偏差 ±10（第三章）、整十题 d∈{10,20}、兜底扩距；clamp 到 [1, 章上限]（第一、二章 20，第三章 100）。
- **RNG 注入**：`Rng = () => number`（[0,1)），生产用 `Math.random`，测试注入种子实现以复现。

### 4.3 进度与模式逻辑

```ts
starsFor(wrongCount: number): 1 | 2 | 3          // 0 错→3；≤2 错→2；否则 1
chapterOf(level: number): 1 | 2 | 3              // 每 15 关一章
// 「当前章」的统一定义：chapterOf(progress.unlocked)，即已解锁最高关所在章
endlessBand(correctCount: number, maxUnlocked: number): number
  // 起始 = 当前章首档；每答对 4 题 +1；封顶 maxUnlocked
timedPool(progress: Progress): number[]
  // 当前章与前一章中「已完成（≥1星）」的档号集合
```

主线解锁：完成第 n 关解锁 n+1（上限 45）；星级取历史最高。

### 4.4 持久化

- key `math_nightsail_v2`，JSON 序列化 `Progress`。
- **v1 迁移**：启动时若存在原型的 `math_nightsail_v1`（`{stars, unlocked}`，1–15 关），迁移其 stars/unlocked 后保留原 key 不删（原型仍可打开）。
- **降级**：localStorage 抛异常（私密模式/满）→ 退化为内存对象，本次会话有效；JSON 解析失败 → 将损坏内容拷入 `math_nightsail_v2_corrupt` 后重置为初始进度。

## 5. UI 层（src/ui）

- **缩放**：固定 1024×768 的 `#stage`，`transform: scale(min(vw/1024, vh/768))` 居中（原型同款策略）；`orientation: portrait` 时显示全屏「请把 iPad 横过来」遮罩。
- **状态机**：`App` 持有 `{ screen: 'map'|'quiz'|'result', mode: 'campaign'|'endless'|'timed', progress, session }`；`session` 为关内/轮内状态（questions、qIndex、wrongThis、pickedWrong、blockStates、streak、timeLeft…）。三屏为受控组件。
- **答题屏变体**：`campaign` 顶部为进度条 + n/N；`endless` 为连对 🔥×N + 航行距离；`timed` 为时间条（答对 +8s 回弹动画、剩余 10s 变 `#E85D5D`）。计时用 `requestAnimationFrame` 驱动、以 `performance.now()` 为准（不依赖 setInterval 精度）；标签页隐藏（visibilitychange）时暂停。
- **计数块**：渲染完全由 `Question.blocksPlan` 驱动（组数、颜色、空槽数、交互类型：divide-out / two-group / fill-slot / three-group），组件不含题型知识。
- **章节切换**：路径面板顶部左右箭头 + 章节名（启航/深海/远洋），未解锁章置灰 + 锁。
- **模式入口**：地图右侧面板 CTA 下方两个按钮，解锁条件见题库规范 §2（完成第 3 / 9 关）。
- **家长设置**：地图角落齿轮，**长按 1.5s** 打开（防误触）：`questionCount`(3–10)、`hardMode`、`showBlocks`（主线/无尽）、`showBlocksTimed`（冲刺模式，默认关）、重置进度（二次确认）。
- 新题型排版（`?+b=c`、`a−?=c`、连算三操作数）与字号自适应（连算/两位数降至 72–80px）按题库规范 §6/§7。

## 6. 语音（src/audio/tts.ts）

- `speak(text, opts?: { interrupt?: boolean })` / `stop()`；内部维护 utterance 队列。
- 音色选择：`speechSynthesis.getVoices()` 中优先 `zh-CN` 且 `localService` 的音色；监听 `voiceschanged`（iOS 上首次为空列表）。语速 0.9。
- 切屏/切题时 `stop()`；iPadOS 需用户手势后发声——应用全程点按驱动，天然满足。
- **降级**：无 `speechSynthesis` 或无中文音色 → `speak` 为 no-op，🔊 按钮置灰；界面文字提示保留，App 完全可用。
- 接口稳定，后续可无痛替换为预生成音频实现。

## 7. PWA 与部署

- `vite-plugin-pwa`（Workbox `generateSW`）：预缓存全部构建产物，离线完整可玩；`registerType: 'autoUpdate'`。
- manifest：名称「数学夜航」、`display: fullscreen`、`orientation: landscape`、主题色 `#12333E`、图标为几何吉祥物（SVG 源生成 192/512 PNG + iOS `apple-touch-icon`）。
- 字体：Noto Sans SC **本地打包**（subset：数字/常用字号所需字符 + 界面文案），不依赖 Google Fonts 在线加载（离线 + 国内网络可靠性）。
- 部署：GitHub Actions（push `main` → `npm ci && npm test && npm run build` → 发布 `dist/` 到 Pages）；仓库名定为 `child-math-app`，Vite `base: '/child-math-app/'`。

## 8. 测试策略

- **性质测试**（Vitest，`src/core` 全覆盖）：每档用种子 RNG 生成 500 题断言约束全部成立（操作数 ≥1、和/差/中间结果域、进退位条件、缺数 `?`≥1、选项 3 个互异且含正确答案、clamp 域）；穷举断言合法域大小——附录给出精确值的 42 个档（1–27、31–45）逐一相等，混合池档 28–30 断言 ≥ 其成分档之和；混合档另断言整关配比（如 band 15 五题为 3 缺数 + 2 进位）。
- **边界用例**：题库规范 §4 表格逐条成测试（correct=1 / 19 / 100、弄反与十位偏差越界丢弃等）。
- **进度/模式单测**：starsFor、解锁、endlessBand（起始/爬档/封顶）、timedPool（跨章边界）、storage（v1 迁移、损坏重置、降级）。
- **手动验收**（iPad Safari）：横竖屏、添加到主屏幕、离线断网可玩、TTS 出声、三屏走查 + 两模式各一轮、家长设置长按、v1 原型数据迁移。清单随实现计划给出。

## 9. 错误处理汇总

| 故障 | 行为 |
|---|---|
| 无 TTS / 无中文音色 | 静默降级，🔊 置灰，文字提示保留 |
| localStorage 不可用 | 内存兜底，本次会话有效 |
| 进度 JSON 损坏 | 拷贝到备用 key 后重置 |
| 竖屏 | 全屏提示横屏 |
| 页面隐藏（限时模式中） | 计时暂停，回来继续 |

## 10. 验收标准

1. `src/core` 测试全绿，含 45 档域大小断言。
2. iPad Safari（横屏）像素级还原原型三屏；1024×768 之外的尺寸等比缩放无变形。
3. 主线 45 关可完整通关，星级/解锁/章节切换正确；两个模式按规范解锁与运行。
4. 添加到主屏幕后断网可完整游玩，进度不丢。
5. 原型 localStorage v1 数据可无损迁移。
