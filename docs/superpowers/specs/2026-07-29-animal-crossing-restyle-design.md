# 动森风格重构设计规范

> 状态：待评审 · 2026-07-29
> 范围：视觉层重构（UI 形状语言 + 美术素材）。**不改动任何 `src/core/` 业务逻辑。**

## 1. 目标与非目标

把「数学夜航」的视觉语言换成动森（《集合啦！动物森友会》）风格：粗描边、大圆角、
3D 硬阴影按钮、圆润字体、手绘感美术素材。

**保留夜航叙事。** 深青夜空底、章节名（启航/深海/远洋/银河）、「无尽夜航」「星光冲刺」
「九九星图」等全部文案不变。这是一次**形状与素材的重构，不是主题重做**。

非目标：

- 不改题库、难度曲线、进度模型、语音逻辑（`src/core/`、`src/audio/` 零改动）
- 不改 1024×768 舞台几何、蛇形路径坐标、节点行定位
- 不改组件树结构（唯一例外：`Mascot` 换实现，见 §5）
- 不引入 UI 组件库依赖（见 §2 裁决）

## 2. 关键裁决

### 2.1 不安装 `animal-island-ui`，只移植设计令牌

参考库 [animal-island-ui](https://github.com/guokaigdg/animal-island-ui)（`CC-BY-NC-4.0`）
提供了完整的动森设计规范。**采用它的配方，不引入它的包。** 理由：

| 阻碍 | 说明 |
|---|---|
| 字体重复 | `import 'animal-island-ui/style'` 会引入 3 个未子集化的 Noto Sans SC（各约 1.15MB，共 3.5MB），本项目已有 `@fontsource/noto-sans-sc` 精细子集 |
| 尺寸锁死 | 组件为桌面尺寸（基准 14px、按钮 40/45px 高），面向 4–7 岁 iPad 横屏偏小，而其硬规则 8/18 禁止用 `style` 覆盖尺寸与圆角 |
| 令牌不可覆盖 | 其 AI_USAGE 硬规则 17 明确「设计令牌不作为 CSS 自定义属性暴露」，深色主题无法官方支持 |
| 覆盖率低 | 本应用主体是定制游戏 UI（蛇形地图、计数块、选项砖、吉祥物、九九星图），库中无对应组件 |
| React 依赖 | 需 `preact/compat` 别名 + `classnames` |

移植的是设计配方（色值、圆角尺度、阴影公式、缓动曲线），属于设计参考关系。
`README.md` 需增加致谢与来源链接。

### 2.2 配色保留，形状重做

夜航现有主色板与动森配方兼容度很高，**保留全部现有色值**：

- 夜空渐变 `#12333e → #174552`、琥珀 `#f2a541`、青绿 `#2fb29b`、珊瑚 `#e85d5d` 全部不变
- 白色透明层级面板体系不变

新增四类令牌：**描边色**、**主色的暗色变体**（用于描边）、**叶绿**（成功态）、**硬阴影色**。

### 2.3 美术素材用 agnes-ai 生成，产物入库

素材由 [agnes-ai](https://agnes-ai.com) 文生图生成后入库为 WebP。
**生成脚本是一次性开发工具，不是构建步骤** —— 构建与 CI 不得依赖外部付费 API。

## 3. 设计令牌

全部数值取自参考库 `skill/SKILL.md`，按本应用的儿童尺寸等比放大
（该库基准为桌面 14px；本应用在 1024×768 舞台上元素约为其 2–3 倍）。

### 3.1 新增令牌

```css
:root {
  /* ── 描边（动森核心特征：万物有边） ── */
  --line:            rgba(255, 255, 255, 0.22);
  --line-strong:     rgba(255, 255, 255, 0.34);
  --bw:              3px;   /* 标准描边宽（原库 2px 放大） */
  --bw-strong:       4px;   /* 焦点元素描边宽 */

  /* ── 主色的暗色变体（着色元素的描边用） ── */
  --amber-dk:        #cf8524;
  --teal-dk:         #21907d;
  --coral-dk:        #c44a4a;

  /* ── 叶绿（成功 / 正确态，动森的 success 色） ── */
  --color-leaf:      #7cc44a;
  --leaf-dk:         #5f9e35;

  /* ── 3D 硬阴影（硬规则 19：主按钮的核心识别特征，不可去除） ── */
  --btn3d:           rgba(0, 0, 0, 0.34);

  /* ── 柔和投影（面板用） ── */
  --elev-sm:         0 3px 10px rgba(0, 0, 0, 0.2);
  --elev:            0 6px 22px rgba(0, 0, 0, 0.28);

  /* ── 圆角尺度 ── */
  --r-sm:            12px;
  --r-base:          18px;
  --r-lg:            24px;
  --r-pill:          999px;

  /* ── 动效 ── */
  --ease:            cubic-bezier(0.4, 0, 0.2, 1);
  --dur-fast:        0.15s;
  --dur-base:        0.25s;
}
```

### 3.2 3D 硬阴影公式

原库 `0 5px 0 0` → 本应用放大为 `0 8px 0 0`（主按钮）/ `0 5px 0 0`（次级控件）：

```css
/* 常态 */  box-shadow: 0 8px 0 0 var(--btn3d);
/* 悬停 */  transform: translateY(-2px);  box-shadow: 0 10px 0 0 var(--btn3d);
/* 按下 */  transform: translateY(4px);   box-shadow: 0 2px 0 0 var(--btn3d);
```

**禁用态去掉硬阴影**（`box-shadow: none` + 无位移），这是「不可按」的关键视觉信号。

### 3.3 字体

在现有 `Noto Sans SC` 前加入 `Nunito`（拉丁字形圆润，本应用数字密集，对动森观感贡献显著）：

```
font-family: 'Nunito', 'Noto Sans SC', -apple-system, 'PingFang SC', ...
```

新增依赖 `@fontsource/nunito`，**只引 latin 子集**的 500/700/900 三档（每档约 16KB，共约 48KB）。

## 4. 样式层重构

### 4.1 抽取共用按钮基类

`src/styles.css` 现有 1220 行，`.mn-cta` / `.mn-mode-btn` / `.mn-arrow` / `.mn-quiz-back` /
`.mn-quiz-replay` / `.mn-opt` / `.mn-result-btn` / `.mn-gear` 八处各自重复了一遍
「硬阴影 + 按压位移」，且圆角/阴影值互不一致。

抽取单一基类 `.mn-btn`，各处改为 `.mn-btn` + 修饰类：

```css
.mn-btn { /* pill 圆角 + 描边 + 硬阴影 + 按压回弹 + 缓动 */ }
.mn-btn--primary { background: var(--color-coral); border-color: var(--coral-dk); }
.mn-btn--gold    { background: var(--color-amber); border-color: var(--amber-dk); }
.mn-btn--leaf    { background: var(--color-leaf);  border-color: var(--leaf-dk); }
.mn-btn--ghost   { background: var(--panel-10);    border-color: var(--line); }
.mn-btn--square  { border-radius: var(--r-lg); }   /* 返回键 / 章节箭头 / 齿轮 */
.mn-btn.is-locked, .mn-btn:disabled { /* 去阴影、去位移、降透明度 */ }
```

这是本次唯一的结构性重构，目的是让后续改一处阴影不必改八遍。预计净减约 90 行。

### 4.2 形状改造清单

| 元素 | 改动 |
|---|---|
| 全部按钮 | 圆角 22px → `--r-pill`；加 `--bw` 描边；统一硬阴影公式 |
| 面板（地图左右panel / 计数块面板 / 星图卡片） | 加 `--bw` 描边 + `--elev-sm` |
| 关卡节点 done | 加 `--bw` 琥珀暗边 + `0 6px 0` 硬阴影 + 按压回弹 |
| 关卡节点 current | 描边 6px → `--bw-strong`；保留 `mn-pulse` 与外发光环 |
| 关卡节点 locked | 换木牌锁头素材（§5.2）；虚线描边 |
| 选项砖 `.mn-opt` | 3px 实线描边 + 硬阴影 + 按压回弹；正确态改叶绿 |
| 答案空格 `.mn-qrow-box` | 虚线描边保留，加硬阴影 |
| 计数块 `.mn-block` | 圆角 12 → 16px，加暗色描边 + `0 4px 0` 小硬阴影 |
| 星图格 `.mn-sc-cell` | 圆角 12 → 16px，各掌握度档加对应暗色描边；点亮态（s3）加硬阴影 |
| 家长设置弹窗 | 换 blob `clip-path`（§4.3） |
| 章节标题 | 换燕尾缎带样式（§4.3） |

### 4.3 两个动森标志性形状

**Modal blob 轮廓** —— 采用参考库 `skill/SKILL.md` 的 SVG `clipPath` 路径原文，
以 `clipPathUnits="objectBoundingBox"` 内联在 `SettingsModal.tsx`。

**燕尾缎带标题** —— 用于章节名与弹窗标题：

```css
clip-path: polygon(0 0, 100% 0, calc(100% - 20px) 50%, 100% 100%, 0 100%, 20px 50%);
filter: drop-shadow(0 3px 0 var(--amber-dk));
```

## 5. 美术素材

### 5.1 素材清单

| 文件 | 用途 | 状态 |
|---|---|---|
| `mascot-idle` / `happy` / `wave` / `cheer` | 吉祥物四姿势 | ✅ 已生成 |
| `icon-endless` / `icon-timed` / `icon-star` | 三个模式按钮图标 | ⚠️ `icon-endless` 需重出（30px 下过糊） |
| `node-locked` | 未解锁关卡的木牌锁头 | ✅ 已生成 |
| `prop-apple` / `prop-shell` | 计数道具（可选，见 §7） | ⚠️ apple 残留投影待修 |
| `app-icon` | PWA 图标源图 | ✅ 已生成 |
| `node-done` / `node-current` | 关卡节点底座 | ❌ 待生成 |
| 反馈表情（答对 / 答错） | 反馈遮罩 | ❌ 待生成 |
| 夜色背景装饰（海浪 / 星云 / 灯塔） | 地图屏底纹 | ❌ 待生成 |

存放于 `src/assets/`，经 Vite 导入以获得内容哈希。格式 **WebP**，
实测全套约 189KB（PNG 为 1.1MB，省 83%）。

### 5.2 `Mascot` 组件改写

现为 CSS 几何拼装（`mn-mascot-halo` / `-face` / `-eye` / `-hi` / `-mouth`），改为素材图：

```tsx
export type MascotPose = 'idle' | 'happy' | 'wave' | 'cheer';
```

- 新增 `wave` 姿势，用于地图屏吉祥物卡片（招手比静立更具邀请感）
- 现有三个姿势的调用点（地图 `idle`、结算 `happy`/`cheer`）签名不变
- `scale` prop 保留
- 对应的 `.mn-mascot-*` CSS（约 45 行）随之删除

### 5.3 素材生成脚本

`scripts/gen-assets.mjs` —— 一次性开发工具：

- 密钥读自环境变量 `AGNES_API_KEY`，**不落盘、不入库**（本机存于 `~/.secrets/`）
- 内含全部提示词与统一风格前缀，保证重出时风格一致
- 白底抠除：从画布四边做连通域洪泛填充（不可按颜色全局删白——素材内部大量使用米白，
  全局删会挖空角色身体）；容差 52 以吃掉模型强行添加的脚下浅灰投影
- 输出 WebP（quality 86）到 `src/assets/`
- **不接入 `npm run build`**，CI 不执行

`scripts/gen-icons.mjs` 改为从 `app-icon` 素材生成 PWA 图标，替代现有的内嵌几何 SVG。

### 5.4 构建配置

`vite.config.ts` 的 workbox `globPatterns` 增加 `webp`：

```ts
globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}']
```

### 5.5 行内图标替代彩色 emoji

界面原有 8 种彩色 emoji（🔊🔒⚙🎉✨🔥⛵🔄，共 20 个渲染点）。它们走系统 emoji
字体渲染，与手绘素材风格冲突，且各平台字形不一致。全部换成生成素材，
经 `ui/components/Ico.tsx` 渲染，`height: 1em` 跟随上下文字号——
行为与它替代的 emoji 一致（emoji 本就是按字号排版的字形）。

`🎉` 改为奖杯（`ico-party`）：派对拉炮在 36px 下认不出，而奖杯对
「新纪录 / 星图点亮」的语义也更准。

**保留的单色文本字形**（`★ ☆ ✕ ‹ › ← ▶ − ＋`）：它们不是 emoji，
继承 `color` 跟着主题走；`★☆` 还用在 `'★★★'.slice(0, n)` 的字符串模式里，
换成图要重构那段逻辑还丢配色，而关卡节点那排星星只有 15px，做成图反而糊。

## 6. 验收标准

1. `npm test` 全绿；`npm run build` 通过类型检查
2. 视觉：五屏（地图 / 答题 / 结算 / 九九星图 / 家长设置）与预览稿一致
3. 交互：所有可点元素有按压回弹；禁用态无阴影无位移
4. 离线：断网后从主屏图标启动，素材正常显示（WebP 已进预缓存）
5. 体积：`dist/` 相比重构前增量 **≤ 350KB**
   - 实测 328KB：素材 268KB + Nunito latin 三档 56KB
   - 原定 300KB 是按初版素材清单（10 个）估的；后续替换彩色 emoji 追加了
     8 个行内图标（见 §5.5），超出 28KB。图标已按实际渲染尺寸降采样
     （96px 而非 192px——iPad Pro 上 stage 缩放 1.33 × DPR 2 ≈ 2.67x，
     28px 图标撑死需要 75px），合计从 80KB 压到 44KB，再压会伤画质。
   - 在 8.3MB 的基线上（大头是中文字体子集），这 28KB 超支约占 0.3%，判定可接受。
6. 无障碍：素材图均有 `alt`；纯装饰图 `alt=""`

## 7. 待定项

**计数块是否改用道具图（苹果 / 贝壳）替代纯色方块。**
教育上更直观（4–7 岁对实物计数的理解优于抽象色块），但会改变 `Blocks.tsx` 的
多个变体逻辑（teal/amber/white/dim/cross/slot-empty/slot-filled 共 7 种状态各需对应素材），
属于教学法改动而非视觉改动。

**建议单独走一次 edu-pm 评审，不并入本次重构。** 本次仅做形状改造（圆角 + 描边 + 硬阴影）。

## 8. 参考

- [animal-island-ui](https://github.com/guokaigdg/animal-island-ui) — 设计配方来源，`CC-BY-NC-4.0`，
  设计令牌取自其 `skill/SKILL.md`
- 交互预览稿（本地）：重构前制作的五屏双配色可点预览，是本规范的视觉基准
