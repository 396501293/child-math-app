# 动森风格重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把「数学夜航」的 UI 形状语言换成动森风格（粗描边 + pill 圆角 + 3D 硬阴影 + 按压回弹 + 手绘素材），保留夜航叙事与现有配色。

**Architecture:** 纯视觉层改造。新增一层设计令牌，抽取统一的 `.mn-btn` 按钮基类替换八处重复实现，把 CSS 几何拼装的吉祥物换成 WebP 素材。`src/core/` 与 `src/audio/` 零改动。

**Tech Stack:** Preact 10 · Vite 6 · vite-plugin-pwa · 原生 CSS 自定义属性 · WebP 素材

**规范：** `docs/superpowers/specs/2026-07-29-animal-crossing-restyle-design.md`
**视觉基准：** `docs/ui-preview/index.html`（浏览器直接打开，工具条切「夜色」即目标效果）

---

## ⚠️ 关于验证方式（执行前必读）

**本仓库的测试全是纯逻辑**——`vitest.config.ts` 注释写明「测试全部是纯逻辑（无 JSX/插件依赖）」，
没有 jsdom、没有组件渲染、没有快照。视觉重构不存在可断言的行为，
**为 CSS 编造测试会产出比没有测试更糟的东西**（虚假的安全感 + 维护负担）。

因此本计划的验证门槛是三层，每个任务明确标注适用哪层：

| 层 | 命令 | 能抓住什么 |
|---|---|---|
| **回归** | `npm test` | 确认 `src/core/` 逻辑未被误伤（应始终全绿且数量不变） |
| **构建** | `npm run build` | 类型错误、素材路径解析失败、导入拼写错误 |
| **目视** | `npm run dev` + 对照 `docs/ui-preview/index.html` | 形状、颜色、阴影、按压回弹 |

全程只有 **Task 9** 有真正值得写的单元测试（吉祥物姿势→素材映射的完整性），
它被刻意设计成不依赖 DOM 的纯数据模块，这样才测得着。

**每个任务结束后提交。** 提交信息用仓库现有风格（`feat(ui):` / `refactor(ui):` / `chore:`）。

---

## Task 1: 分支、依赖与设计令牌

**Files:**
- Modify: `package.json`
- Modify: `src/main.tsx`
- Modify: `src/styles.css:19-72`（`:root` 块）、`src/styles.css:73-77`（`body` 字体栈）

- [ ] **Step 1: 建分支**

当前在 `main`。视觉重构会连续改动 `styles.css`，必须隔离。

```bash
git checkout -b feat/animal-crossing-restyle
```

- [ ] **Step 2: 装 Nunito**

```bash
npm install -D @fontsource/nunito
```

> 注意：本仓库**不提交 `package-lock.json`**（见 `README.md`——开发机 npm 配了私有镜像，
> 产出的 lockfile 带 CI 无法访问的地址）。装完确认 `package-lock.json` 未被 `git add`。

- [ ] **Step 3: 只引 latin 子集的三档字重**

`src/main.tsx` 现有的 Noto Sans SC 引入之后追加。**只引 latin**——
中文字形本项目已有 Noto Sans SC 承担，引 Nunito 的中文子集会白白增加数百 KB。

```ts
import '@fontsource/nunito/latin-500.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-900.css';
```

- [ ] **Step 4: 字体栈加 Nunito 前置**

`src/styles.css` 的 `body` 规则，把 `font-family` 改为：

```css
  font-family: 'Nunito', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
```

Nunito 必须在 Noto Sans SC **之前**：它只有拉丁字形，中文会自动回退到后者。
本应用数字密集，圆润数字是动森观感的主要来源。

- [ ] **Step 5: 新增设计令牌**

在 `src/styles.css` 的 `:root` 块**末尾**追加（现有令牌一个都不删）：

```css
  /* ══ 以下为动森风格重构新增（配方源：animal-island-ui skill/SKILL.md） ══ */

  /* 描边——动森核心特征：万物有边 */
  --line: rgba(255, 255, 255, 0.22);
  --line-strong: rgba(255, 255, 255, 0.34);
  --bw: 3px; /* 标准描边宽（原库 2px，按本应用元素尺寸放大） */
  --bw-strong: 4px; /* 焦点元素 */

  /* 主色的暗色变体：着色元素的描边用，比阴影更清晰地勾出形状 */
  --amber-dk: #cf8524;
  --teal-dk: #21907d;
  --coral-dk: #c44a4a;

  /* 叶绿：动森的 success 色，用于「答对」 */
  --color-leaf: #7cc44a;
  --leaf-dk: #5f9e35;

  /* 3D 硬阴影（原库硬规则 19：主按钮的核心识别特征，禁止去除） */
  --btn3d: rgba(0, 0, 0, 0.34);

  /* 柔和投影：面板用 */
  --elev-sm: 0 3px 10px rgba(0, 0, 0, 0.2);
  --elev: 0 6px 22px rgba(0, 0, 0, 0.28);

  /* 圆角尺度 */
  --r-sm: 12px;
  --r-base: 18px;
  --r-lg: 24px;
  --r-pill: 999px;

  /* 动效 */
  --ease: cubic-bezier(0.4, 0, 0.2, 1);
  --dur-fast: 0.15s;
  --dur-base: 0.25s;
```

- [ ] **Step 6: 验证**

```bash
npm test          # 期望：全绿，数量与改动前一致
npm run build     # 期望：类型检查通过、构建成功
```

目视：`npm run dev`，界面**除数字字形变圆润外应与改动前完全一致**（新令牌尚未被引用）。
如果有任何布局变化，说明 Nunito 的度量影响了排版，需在此处解决而非留到后面。

- [ ] **Step 7: 提交**

```bash
git add package.json src/main.tsx src/styles.css
git commit -m "feat(ui): 动森设计令牌与 Nunito 字体"
```

---

## Task 2: 修正与补齐美术素材

**Files:**
- Create: `scripts/gen-assets.mjs`
- Modify: `src/assets/icon-endless.webp`（重出）
- Create: `src/assets/mascot-oops.webp`
- Modify: `.gitignore`

已入库素材（`src/assets/`，共 184KB）：`mascot-idle` / `mascot-happy` / `mascot-wave` /
`mascot-cheer` / `icon-endless` / `icon-timed` / `icon-star` / `node-locked` / `app-icon`。

本任务只补两处缺口：`icon-endless` 缩到 30px 过糊需重出；答错反馈缺表情素材。

> **不生成关卡节点 done/current 底座。** 那两态是「带数字的圆盘」，数字必须随节点尺寸
> 缩放并保持居中，用 CSS（底色 + 暗边 + 硬阴影）比用位图可靠得多，也省 2 张素材的体积。

- [ ] **Step 1: 写生成脚本**

`scripts/gen-assets.mjs`。**这是一次性开发工具，不接入 `npm run build`，CI 不执行**——
构建绝不能依赖外部 API（本仓库的部署门槛是全量测试，多一个外部依赖就多一个卡死点）。

关键实现要点：

- 密钥读环境变量 `AGNES_API_KEY`，**不落盘、不入库**（本机存于 `~/.secrets/personal.md`）
- 端点 `POST https://apihub.agnes-ai.com/v1/images/generations`，OpenAI 兼容，
  `Authorization: Bearer <key>`，模型 `agnes-image-2.1-flash`，返回图片 URL，单张约 22 秒
- **该 API 不支持透明背景**（传 `background: "transparent"` 仍返回 RGB），必须自行抠白底
- 抠底算法：**从画布四边做连通域洪泛填充**，容差 52。
  不可按颜色全局删白——素材内部大量使用米白（角色身体就是 `#f8f8f0` 一类），
  全局删会把角色挖空；而洪泛只吃掉与边界连通的白，角色被粗棕描边围死，填充进不去。
  容差取 52 是为了连带吃掉模型强行添加的脚下浅灰投影（提示词写 "no shadow" 无效）
- 边缘处理：alpha 先 `MinFilter(3)` 收一像素再高斯模糊 1px，消除重采样白边
- 输出：裁到内容边界 → 缩放 → WebP quality 86（实测比 PNG 省 83%）
- 脚本内保存统一风格前缀与角色固定描述，保证任何时候重出都同一支笔

- [ ] **Step 2: 确认密钥不会入库**

`.gitignore` 追加（防御性，脚本本就不写文件）：

```
.env
.env.local
```

检查脚本源码中**没有任何硬编码的 `sk-` 字符串**：

```bash
grep -rn 'sk-' scripts/ src/ && echo "❌ 发现硬编码密钥" || echo "✅ 无硬编码密钥"
```

- [ ] **Step 3: 重出 `icon-endless`**

现版本是绳结无限符号，细节太多，30px 下糊成一团。重出提示词要求**极简剪影**：
粗绳环成的 ∞、无内部纹理、中心一颗星。

- [ ] **Step 4: 生成 `mascot-oops`（答错表情）**

同一角色，歪头、眉毛下垂、小小的「哎呀」表情，**不要哭**——
4–7 岁的错误反馈应是「再试一次」而非挫败。

```bash
AGNES_API_KEY=$(grep -m1 '^- API Key:' ~/.secrets/personal.md | sed 's/^- API Key: //') \
  node scripts/gen-assets.mjs icon-endless mascot-oops
```

- [ ] **Step 5: 验证**

```bash
du -sh src/assets     # 期望：≤ 220KB
```

目视：在深色底上检查两张新素材无白边、无残留投影。

- [ ] **Step 6: 提交**

```bash
git add scripts/gen-assets.mjs src/assets .gitignore
git commit -m "chore(assets): agnes-ai 素材生成脚本与补齐素材"
```

---

## Task 3: 抽取 `.mn-btn` 按钮基类

**Files:**
- Modify: `src/styles.css`（在「通用按钮硬阴影范式」注释处，约 165 行）

现有八处控件各自重复了一遍「硬阴影 + 按压位移」，且值互不一致
（圆角 22/20/26px 混用，阴影 `0 6px 0` / `0 3px 0` 混用）。
本任务**只新增基类，不迁移任何调用点**——迁移在 Task 4–6 分批进行，
这样每一批都能独立目视验收，出问题时回滚范围小。

- [ ] **Step 1: 在 `.mn-cta` 定义之前插入基类**

```css
/* ── 动森按钮基类 ──
   CTA / 模式键 / 章节箭头 / 返回 / 重播 / 齿轮 / 选项砖 / 结算键 共八处，
   统一：描边 + 圆角 + 3D 硬阴影 + 按压回弹。改一处即全体生效。 */
.mn-btn {
  font-family: inherit;
  font-weight: 900;
  color: var(--color-white-100);
  background: var(--panel-10);
  border: var(--bw) solid var(--line);
  border-radius: var(--r-pill);
  box-shadow: 0 8px 0 0 var(--btn3d);
  cursor: pointer;
  user-select: none;
  transition: transform var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease);
}
.mn-btn:active {
  transform: translateY(4px);
  box-shadow: 0 2px 0 0 var(--btn3d);
}

/* 着色变体：底色 + 同色系暗边（暗边比阴影更清晰地勾出形状） */
.mn-btn--coral {
  background: var(--color-coral);
  border-color: var(--coral-dk);
}
.mn-btn--amber {
  background: var(--color-amber);
  border-color: var(--amber-dk);
  color: var(--color-text-dark);
}
.mn-btn--teal {
  background: var(--color-teal);
  border-color: var(--teal-dk);
}
.mn-btn--leaf {
  background: var(--color-leaf);
  border-color: var(--leaf-dk);
}

/* 方形变体：返回 / 章节箭头 / 齿轮——圆角而非 pill，阴影浅一档 */
.mn-btn--square {
  border-radius: var(--r-lg);
  box-shadow: 0 5px 0 0 var(--btn3d);
}
.mn-btn--square:active {
  transform: translateY(3px);
  box-shadow: 0 2px 0 0 var(--btn3d);
}

/* 禁用 / 锁定：去阴影去位移——这是「不可按」的关键视觉信号，不要只降透明度 */
.mn-btn:disabled,
.mn-btn.is-locked,
.mn-btn.is-disabled {
  background: var(--panel-06);
  border-color: var(--line);
  color: var(--color-white-40);
  box-shadow: none;
  cursor: default;
}
.mn-btn:disabled:active,
.mn-btn.is-locked:active,
.mn-btn.is-disabled:active {
  transform: none;
  box-shadow: none;
}
```

- [ ] **Step 2: 验证**

```bash
npm run build
```

目视：界面**应完全无变化**（基类尚无调用点）。若有变化说明选择器意外命中了现有元素。

- [ ] **Step 3: 提交**

```bash
git add src/styles.css
git commit -m "refactor(ui): 抽取 .mn-btn 动森按钮基类"
```

---

## Task 4: 迁移地图右栏按钮（CTA / 模式键）

**Files:**
- Modify: `src/styles.css`（`.mn-cta`、`.mn-mode-btn`、`.mn-badge`、`.mn-cta.is-disabled`）
- Modify: `src/ui/screens/Map.tsx:186,189,198,207`
- Modify: `src/ui/screens/StarChart.tsx:97,101`

- [ ] **Step 1: 删除旧规则，保留布局属性**

`.mn-cta` 与 `.mn-mode-btn` 中**只保留尺寸/排版**（`width`、`padding`、`font-size`、`position`），
删掉 `border`、`border-radius`、`background`、`box-shadow`、`color`、`cursor`、`user-select`
以及各自的 `:active` 与 `.is-locked` / `.is-disabled` 规则——这些现在由基类提供。

- [ ] **Step 2: 改调用点类名**

`Map.tsx`：

| 行 | 原 | 新 |
|---|---|---|
| 186 | `class="mn-cta"` | `class="mn-btn mn-btn--coral mn-cta"` |
| 189 | `endlessOn ? 'mn-mode-btn' : 'mn-mode-btn is-locked'` | `'mn-btn mn-btn--amber mn-mode-btn' + (endlessOn ? '' : ' is-locked')` |
| 198 | 同上（`timedOn`） | `'mn-btn mn-btn--teal mn-mode-btn'` + 同款锁定拼接 |
| 207 | 同上（`starChartOn`） | `'mn-btn mn-btn--leaf mn-mode-btn'` + 同款锁定拼接 |

`StarChart.tsx:97` 的「开始练习」→ `mn-btn mn-btn--coral mn-cta`（禁用态沿用 `is-disabled`）；
`:101` 的「回地图」→ `mn-btn mn-mode-btn`。

> 三个模式键此前同为半透明白，现在分配了琥珀/青绿/叶绿三色——
> 这既是动森的色彩性格，也让 4–7 岁儿童靠颜色而非文字辨认模式。

- [ ] **Step 3: 「新玩法！」徽标补描边**

`.mn-badge` 加 `border: 2px solid var(--coral-dk);`，`box-shadow` 改 `0 3px 0 0 var(--btn3d)`。

- [ ] **Step 4: 验证**

```bash
npm test && npm run build
```

目视地图屏与九九星图屏，对照 `docs/ui-preview/index.html`「夜色」版：
四个按钮有描边和硬阴影；**按下时下沉 4px 且阴影收缩**；锁定态无阴影、按下无反应。

- [ ] **Step 5: 提交**

```bash
git add src/styles.css src/ui/screens/Map.tsx src/ui/screens/StarChart.tsx
git commit -m "feat(ui): 地图右栏按钮动森化"
```

---

## Task 5: 迁移方形控件（箭头 / 返回 / 重播 / 齿轮）

**Files:**
- Modify: `src/styles.css`（`.mn-arrow`、`.mn-gear`、`.mn-quiz-back`、`.mn-quiz-replay`）
- Modify: `src/ui/screens/Map.tsx:139,150,218`、`src/ui/screens/Quiz.tsx:36,53`

- [ ] **Step 1: 精简四条规则，加 `mn-btn mn-btn--square`**

四者都只保留 `width`/`height`/`position`/`font-size`/`display` 等布局属性。
`.mn-gear` 的 `touch-action: none` **必须保留**——齿轮是长按 1.5 秒开设置，
没有它长按会触发页面滚动/文本选择手势。

- [ ] **Step 2: 章节箭头的禁用态**

`.mn-arrow.is-disabled` 现为 `opacity: .4`。改用基类的 `is-disabled`（去阴影），
但**保留 `opacity`**——箭头没有底色变化，只靠去阴影不够明显。

- [ ] **Step 3: 验证**

```bash
npm test && npm run build
```

目视：地图屏章节箭头、齿轮；答题屏返回键与 🔊 重播键。
**重点验证齿轮长按 1.5 秒仍能打开家长设置**（`touch-action` 未被误删）。

- [ ] **Step 4: 提交**

```bash
git add src/styles.css src/ui/screens/Map.tsx src/ui/screens/Quiz.tsx
git commit -m "feat(ui): 方形控件动森化"
```

---

## Task 6: 迁移选项砖与结算按钮

**Files:**
- Modify: `src/styles.css`（`.mn-opt` 及其修饰态、`.mn-result-btn` 及其修饰态）
- Modify: `src/ui/components/Options.tsx`、`src/ui/screens/Result.tsx:44,46,75,100,101,123`

- [ ] **Step 1: 选项砖**

`.mn-opt` 保留 `width`/`height`/`font-size`/`display`，圆角改 `var(--r-lg)`
（选项砖是矩形不是 pill），描边宽度维持 3px 但颜色改 `var(--line-strong)`。

三个状态：

- `.mn-opt--correct`：底色由 `--color-teal` **改为 `--color-leaf`**，描边 `--leaf-dk`。
  动森的正确色是叶绿；青绿在本应用已被计数块占用，区分开可减少误读。
- `.mn-opt--excluded`：去阴影、去位移（已排除即不可再点），保留珊瑚描边
- `.mn-opt--shake`：`mn-shake` 动画保持不变

- [ ] **Step 2: 结算按钮**

`.mn-result-btn--ghost` → `mn-btn`（默认半透明白）；
`.mn-result-btn--next` → `mn-btn mn-btn--coral`。

- [ ] **Step 3: 验证**

```bash
npm test && npm run build
```

目视答题屏：四个选项砖有描边硬阴影、按压回弹；答对时变叶绿；答错的选项变暗且按不动。
结算屏两个按钮层级分明。

- [ ] **Step 4: 提交**

```bash
git add src/styles.css src/ui/components/Options.tsx src/ui/screens/Result.tsx
git commit -m "feat(ui): 选项砖与结算按钮动森化"
```

---

## Task 7: 面板描边

**Files:**
- Modify: `src/styles.css`（`.mn-blocks-panel`、`.mn-sc-card`、`.mn-sc-counter`、`.mn-result`）
- Modify: `src/ui/screens/Map.tsx:135,177`、`src/ui/screens/StarChart.tsx:80`（内联样式的面板）

地图屏的左右面板目前是**内联样式**（`background: var(--panel-06)`、`borderRadius: 28`）。
把它们抽成 `.mn-panel` 类，避免在 TSX 里散落视觉常量。

- [ ] **Step 1: 新增 `.mn-panel`**

```css
/* ── 面板：动森的「万物有边」也适用于容器 ── */
.mn-panel {
  background: var(--panel-06);
  border: var(--bw) solid var(--line);
  border-radius: 28px;
  box-shadow: var(--elev-sm);
}
```

- [ ] **Step 2: 迁移调用点**

`Map.tsx:135`（左路径面板）与 `:177`（吉祥物卡片）删掉内联的 `background`/`borderRadius`，
改挂 `class="mn-panel"`，保留 `position`/尺寸类内联样式。
`.mn-blocks-panel`、`.mn-sc-card`、`.mn-sc-counter` 各自加描边与 `--elev-sm`。

- [ ] **Step 3: 结算卡片**

`.mn-result` 现无背景（直接浮在夜空上）。加一层 `.mn-panel` 质感的卡片包裹，
宽 620px、内边距 40px——见预览稿结算屏。

- [ ] **Step 4: 验证**

```bash
npm test && npm run build
```

目视五屏所有面板均有细描边与柔和投影，层次比改动前清晰。

- [ ] **Step 5: 提交**

```bash
git add src/styles.css src/ui/screens/
git commit -m "feat(ui): 面板描边与结算卡片"
```

---

## Task 8: 关卡节点

**Files:**
- Modify: `src/styles.css:250-293`（`.mn-node` 系列）
- Modify: `src/ui/screens/Map.tsx:56-68`（`NodeCell`）

- [ ] **Step 1: 三态改造**

- `.mn-node--done`：加 `border: var(--bw) solid var(--amber-dk)` + `box-shadow: 0 6px 0 0 var(--btn3d)`
  + `:active` 回弹（`translateY(3px)` / `0 2px 0`）
- `.mn-node--current`：`border` 6px → `var(--bw-strong)`，颜色改 `var(--teal-dk)`，
  底色改 `var(--color-teal)`、字色白（预览稿即此配色，比原先的白底珊瑚边更醒目），
  外发光环 `0 0 0 10px` 与 `mn-pulse` 动画保留
- `.mn-node--locked`：底色透明、`border: var(--bw) dashed var(--line)`，内容换木牌素材

- [ ] **Step 2: 锁定节点用木牌素材**

`NodeCell` 中锁定态的内容由数字改为：

```tsx
<img src={nodeLocked} alt="未解锁" width={66} height={66} />
```

素材静态导入 `src/assets/node-locked.webp`。

- [ ] **Step 3: 验证**

```bash
npm test && npm run build
```

目视地图屏：已完成节点有琥珀暗边与硬阴影、可按下回弹；当前关节点青绿高亮且脉冲；
未解锁节点是虚线圈内嵌木牌锁头。**确认锁定节点仍不可点击**（`onClick` 逻辑未动）。

- [ ] **Step 4: 提交**

```bash
git add src/styles.css src/ui/screens/Map.tsx
git commit -m "feat(ui): 关卡节点动森化与木牌锁素材"
```

---

## Task 9: 吉祥物素材化（含单元测试）

**Files:**
- Create: `src/ui/components/mascotAssets.ts`
- Create: `tests/ui/mascotAssets.test.ts`
- Modify: `src/ui/components/Mascot.tsx`（整体改写）
- Modify: `src/styles.css`（删除 `.mn-mascot-*` 约 45 行）
- Modify: `src/ui/screens/Map.tsx:180`

**这是本计划唯一适合 TDD 的任务。** 姿势→素材的映射是纯数据，
把它从组件里分离出来就能在无 DOM 环境下测试——漏掉一个姿势会在测试时立刻暴露，
而不是等到运行时渲染出一张碎图。

- [ ] **Step 1: 先写失败的测试**

`tests/ui/mascotAssets.test.ts`：

```ts
import { expect, test } from 'vitest';
import { MASCOT_POSES, mascotSrc, type MascotPose } from '../../src/ui/components/mascotAssets';

test('每个姿势都有对应素材', () => {
  for (const pose of MASCOT_POSES) {
    expect(mascotSrc(pose), `姿势 ${pose} 缺素材`).toBeTruthy();
  }
});

test('姿势清单覆盖全部调用点用到的姿势', () => {
  // 地图屏用 wave，结算屏按星级/破纪录用 happy 与 cheer，idle 为兜底默认值
  const used: MascotPose[] = ['idle', 'happy', 'wave', 'cheer'];
  for (const pose of used) expect(MASCOT_POSES).toContain(pose);
});

test('不同姿势指向不同素材', () => {
  const srcs = MASCOT_POSES.map(mascotSrc);
  expect(new Set(srcs).size).toBe(MASCOT_POSES.length);
});
```

- [ ] **Step 2: 运行确认失败**

```bash
npx vitest run tests/ui/mascotAssets.test.ts
```

期望：FAIL，报找不到模块 `mascotAssets`。

- [ ] **Step 3: 写映射模块**

`src/ui/components/mascotAssets.ts`——**不含 JSX**，所以纯逻辑测试环境跑得起来：

```ts
import cheer from '../../assets/mascot-cheer.webp';
import happy from '../../assets/mascot-happy.webp';
import idle from '../../assets/mascot-idle.webp';
import wave from '../../assets/mascot-wave.webp';

export const MASCOT_POSES = ['idle', 'happy', 'wave', 'cheer'] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

const SRC: Record<MascotPose, string> = { idle, happy, wave, cheer };

export const mascotSrc = (pose: MascotPose): string => SRC[pose];
```

> Vite 把 `.webp` 导入解析为 URL 字符串。Vitest 未走 Vite 插件管线时会把它解析为
> 文件路径字符串——两种情况下都是非空字符串，测试成立。
> 若 Vitest 报无法解析 `.webp`，在 `vitest.config.ts` 加：
> `resolve: { alias: [{ find: /\.webp$/, replacement: '' }] }` 之外更简单的做法是
> 给测试配置 `assetsInclude`；先跑一次看实际行为再决定，**不要预先加不需要的配置**。

- [ ] **Step 4: 运行确认通过**

```bash
npx vitest run tests/ui/mascotAssets.test.ts
```

期望：3 个测试 PASS。

- [ ] **Step 5: 改写组件**

`src/ui/components/Mascot.tsx` 整体替换。原有的 `MOUTHS` 嘴形表与五层 div 全部删除：

```tsx
import { mascotSrc, type MascotPose } from './mascotAssets';

export type { MascotPose };

export function Mascot({ pose = 'idle', scale = 1 }: { pose?: MascotPose; scale?: number }) {
  return (
    <img
      class="mn-mascot"
      src={mascotSrc(pose)}
      alt=""
      style={{ transform: `scale(${scale})` }}
    />
  );
}
```

`alt=""`：吉祥物是装饰性的，情绪信息已由同屏文案表达，给它加 alt 会让读屏器重复播报。

- [ ] **Step 6: 更新 CSS 与调用点**

`.mn-mascot` 改为 `{ display: block; height: 168px; width: auto; transform-origin: center center; }`，
删除 `.mn-mascot-halo` / `-face` / `-eye` / `-hi` / `-mouth` 五条规则（约 45 行）。
`Map.tsx:180` 的 `<Mascot pose="idle" />` 改为 `pose="wave"`（招手比静立更具邀请感）。

- [ ] **Step 7: 验证**

```bash
npm test          # 期望：原有测试全绿 + 新增 3 个
npm run build
```

目视地图屏与结算屏吉祥物为手绘素材、无白边；结算屏 `cheer` 姿势正常。

- [ ] **Step 8: 提交**

```bash
git add src/ui/components/ tests/ui/ src/styles.css src/ui/screens/Map.tsx
git commit -m "feat(ui): 吉祥物改用手绘素材"
```

---

## Task 10: 答题屏与星图细节

**Files:**
- Modify: `src/styles.css`（`.mn-qrow-box`、`.mn-block*`、`.mn-sc-cell*`、`.mn-quiz-progress*`、`.mn-feedback-card*`）
- Modify: `src/ui/screens/Map.tsx`（模式键加图标）

- [ ] **Step 1: 答案空格与计数块**

- `.mn-qrow-box`：虚线描边保留，加 `box-shadow: 0 6px 0 0 var(--btn3d)`
- `.mn-block`：圆角 12 → 16px，加 `border: 3px solid rgba(0,0,0,.16)` + `box-shadow: 0 4px 0 0 rgba(0,0,0,.14)`

> **计数块维持纯色方块，不换道具图。** 换成苹果/贝壳对 4–7 岁确实更直观，
> 但 `Blocks.tsx` 有 7 种状态变体（teal/amber/white/dim/cross/slot-empty/slot-filled），
> 全部素材化属于**教学法改动**而非视觉改动。见规范 §7——单独走 edu-pm 评审。

- [ ] **Step 2: 进度条与反馈卡**

进度条填充改斜纹（动森的 loading 语言）：
`repeating-linear-gradient(-45deg, var(--color-leaf) 0 12px, var(--leaf-dk) 12px 24px)`。
反馈卡 `.mn-feedback-card--right` 底色改 `var(--color-leaf)`，两种反馈卡各加暗色描边。

- [ ] **Step 3: 星图格**

`.mn-sc-cell` 圆角 12 → 16px；`--s1` / `--s2` 加 `var(--teal-dk)` 描边；
`--s3`（已点亮）加 `var(--amber-dk)` 描边 + `0 3px 0 0 var(--btn3d)` 硬阴影；
`--locked` 改虚线描边。表头 `.mn-sc-head` 改琥珀底 + 暗边 + 小硬阴影。

- [ ] **Step 4: 模式键加图标**

`Map.tsx` 三个模式按钮内嵌 `src/assets/icon-endless|timed|star.webp`：

```tsx
<img class="mn-mode-ico" src={iconEndless} alt="" />
```

```css
.mn-mode-ico { height: 30px; width: auto; vertical-align: -8px; margin-right: 8px; }
.mn-btn.is-locked .mn-mode-ico { filter: grayscale(1); opacity: 0.45; }
```

- [ ] **Step 5: 验证**

```bash
npm test && npm run build
```

目视答题屏（含答对/答错反馈）与九九星图屏，对照预览稿。

- [ ] **Step 6: 提交**

```bash
git add src/styles.css src/ui/screens/Map.tsx
git commit -m "feat(ui): 答题屏与星图细节动森化"
```

---

## Task 11: 缎带标题与 Modal blob 轮廓

**Files:**
- Modify: `src/styles.css`
- Modify: `src/ui/components/SettingsModal.tsx`
- Modify: `src/ui/screens/Map.tsx:146`

- [ ] **Step 1: 燕尾缎带**

```css
/* ── 燕尾缎带标题（动森 Title 组件的形状语言） ── */
.mn-ribbon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 40px;
  background: var(--color-amber);
  color: var(--color-text-dark);
  font-weight: 900;
  border-radius: 6px;
  clip-path: polygon(0 0, 100% 0, calc(100% - 20px) 50%, 100% 100%, 0 100%, 20px 50%);
  filter: drop-shadow(0 3px 0 var(--amber-dk));
}
```

用于 `Map.tsx:146` 的章节名与设置弹窗标题。

- [ ] **Step 2: Modal blob 轮廓**

`SettingsModal.tsx` 内联 SVG `clipPath`（路径取自 `animal-island-ui` 的 `skill/SKILL.md` 原文，
`clipPathUnits="objectBoundingBox"`，完整路径见 `docs/ui-preview/index.html` 中的 `#ac-modal-clip`），
弹窗容器挂 `clip-path: url(#mn-modal-clip)`。

> **注意：`clip-path` 会裁掉溢出内容且不能与 `overflow: auto` 共存。**
> 确认设置项在弹窗尺寸内放得下；若放不下，改用大圆角而非 blob——形状不值得牺牲可用性。

- [ ] **Step 3: 验证**

```bash
npm test && npm run build
```

目视：地图屏章节名为缎带；长按齿轮 1.5 秒打开设置弹窗，轮廓为不规则 blob，
**四项设置全部可见可点、无内容被裁**。

- [ ] **Step 4: 提交**

```bash
git add src/styles.css src/ui/components/SettingsModal.tsx src/ui/screens/Map.tsx
git commit -m "feat(ui): 缎带标题与弹窗 blob 轮廓"
```

---

## Task 12: PWA 图标、构建配置与验收

**Files:**
- Modify: `scripts/gen-icons.mjs`
- Modify: `vite.config.ts:28`
- Modify: `README.md`

- [ ] **Step 1: PWA 图标改用素材**

`scripts/gen-icons.mjs` 现在把内嵌的几何吉祥物 SVG 光栅化——那个造型已被素材取代，
留着会导致主屏图标与应用内吉祥物长得不一样。改为用 `sharp` 处理 `src/assets/app-icon.webp`：
铺 `#12333E` 圆角底 → 居中合成素材 → 输出 192/512/180 三档 PNG。

```bash
node scripts/gen-icons.mjs
```

- [ ] **Step 2: WebP 进预缓存**

`vite.config.ts` 的 workbox `globPatterns` 加 `webp`，否则素材不进离线缓存、断网即碎图：

```ts
globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
```

- [ ] **Step 3: README 补致谢与素材说明**

新增一节，写明：设计配方源自 [animal-island-ui](https://github.com/guokaigdg/animal-island-ui)（`CC-BY-NC-4.0`，
仅移植设计令牌未引入代码）；美术素材由 agnes-ai 生成，
重出方式 `AGNES_API_KEY=... node scripts/gen-assets.mjs`，**该脚本不属于构建流程**。

- [ ] **Step 4: 体积核对**

```bash
npm run build
du -sh dist
```

期望：相比重构前增量 **≤ 300KB**（素材约 190KB + Nunito 拉丁子集约 48KB）。
超标则检查是否误引了 Nunito 的中文子集。

- [ ] **Step 5: 全量验收**

```bash
npm test        # 全绿
npm run build   # 通过
npm run preview # 起生产构建
```

逐项确认：

- [ ] 五屏（地图 / 答题 / 结算 / 九九星图 / 家长设置）与 `docs/ui-preview/index.html`「夜色」版一致
- [ ] 所有可点元素按下有回弹；禁用/锁定态无阴影、按下无位移
- [ ] 齿轮长按 1.5 秒打开设置（防误触逻辑未坏）
- [ ] 锁定关卡不可点击
- [ ] 语音朗读正常（本次未触碰 `src/audio/`，若坏说明误改）
- [ ] 断网后从主屏图标启动，素材与字体正常显示
- [ ] 竖屏旋转提示仍生效

- [ ] **Step 6: 提交并合并**

```bash
git add scripts/gen-icons.mjs vite.config.ts README.md public/icons
git commit -m "chore: PWA 图标改用素材、WebP 进预缓存、README 致谢"
```

合并策略问本人后再执行（参见 @superpowers:finishing-a-development-branch）。

---

## 回滚

每个任务独立提交，出问题 `git revert <sha>` 即可。
最坏情况整支分支丢弃：`git checkout main && git branch -D feat/animal-crossing-restyle`——
`src/core/` 与 `src/audio/` 全程未被触碰，业务逻辑无风险。
