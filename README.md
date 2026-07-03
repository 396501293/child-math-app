# 数学夜航

面向 4–7 岁儿童的 iPad 横屏数学学习 PWA：3 章 × 15 关（共 45 关）加减法主线，外加「无尽夜航」（无尽模式）与「星光冲刺」（限时模式）两个练习模式，支持离线游玩、语音朗读、家长设置。

## 文档地图

- [`design_handoff_数学夜航/`](./design_handoff_数学夜航/) — 设计交接资产：高保真可交互原型（`数学夜航原型.dc.html`）、题库难度与模式设计（`题库难度与模式设计.md`）、整体交接说明（`README.md`）。UI 像素细节（颜色/字号/间距/动画）以此为权威来源。
- [`docs/superpowers/specs/`](./docs/superpowers/specs/) — 技术设计规范（v1 实现范围、架构、数据模型）。
- [`docs/superpowers/plans/`](./docs/superpowers/plans/) — 实现计划（任务拆解、验收标准）。

## 本地开发

要求 **Node.js ≥ 20**（CI 使用 Node 22）。

```bash
npm install     # 安装依赖
npm run dev     # 本地开发服务器（Vite）
npm test        # 运行单元测试（Vitest）
npm run build   # 类型检查 + 生产构建 → dist/
```

## 部署（GitHub Pages）

本项目通过 GitHub Actions 自动部署到 GitHub Pages，配置见 [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)。

1. 在 GitHub 上新建仓库，**仓库名必须为 `child-math-app`**（需与 `vite.config.ts` 中的 `base: '/child-math-app/'` 一致，否则静态资源路径会 404）。
2. 将本地代码推送到该仓库的 `main` 分支。
3. 进入仓库 **Settings → Pages**，将 **Source** 设置为 **GitHub Actions**。
4. 推送到 `main` 后工作流会自动构建并发布，完成后访问：
   `https://<你的用户名>.github.io/child-math-app/`

工作流会在上传产物前删除 `dist/` 中未使用的 `.woff` 回退字体文件（PWA 预缓存与实际加载只使用 `.woff2`），以减小部署体积。

## iPad 安装与使用

1. 用 Safari 打开上面的部署地址。
2. 点击底部分享按钮 → **添加到主屏幕**。
3. 从主屏幕图标启动（全屏、横屏）。
4. 首次联网加载完成后，应用会离线缓存资源，之后无网络也可继续游玩。
5. **家长设置**：在地图屏右下角长按齿轮图标约 1.5 秒即可打开（防止儿童误触）。

## 图标再生成

App / PWA 图标由脚本从内嵌 SVG 光栅化生成，如需重新生成：

```bash
node scripts/gen-icons.mjs
```
