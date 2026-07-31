# 史蒂夫养成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现史蒂夫养成模块：五矿派生经济 + 16 件装备阶梯 + 12 件配件 + 星空点星 + 工作台兑换，全程遵守评审的呈现纪律 M1–M7。

**Architecture:** 核心是 `src/core/rewards.ts` 纯函数层（派生余额 = income(Progress) − spent，无独立矿石存量，可自愈）；UI 新增 `'steve'` 屏两个标签；精灵混搭靠装备叠加层 + 裁剪偏移 manifest。

**Tech Stack:** 既有栈不变。**本模块与 UI 重构相反——核心逻辑是纯函数，全程真 TDD。**

**规范：** `docs/superpowers/specs/2026-07-30-steve-raise-design.md`
**经济权威：** `docs/edu-pm-reviews/2026-07-30-steve-raise-review.md`（数值照抄，不再推导）

**每任务完成即提交。** TDD 节奏：先写失败测试 → 跑红 → 实现 → 跑绿 → 提交。

---

## Task 1: 目录常量与类型

**Files:** Create `src/core/rewardsCatalog.ts`, `tests/core/rewardsCatalog.test.ts`

- [ ] 失败测试：28 个 id 唯一（16 装备 `eq-{tier}-{slot}` + 12 配件 `ac-*`）；
      装备件价与评审表 A 逐项相等（皮革 3/6/9/12 等）；配件价与表 B 相等；
      星图样 5 个共 45 星；兑换链 `4:1` 四段；每件装备有 `tier/slot/material/cost`，
      每配件有 `anchor`（手持/脚边/肩侧/站边）
- [ ] 实现目录常量（纯数据，无逻辑）
- [ ] 绿 → 提交 `feat(core): 养成目录常量`

## Task 2: 收入公式（TDD）

**Files:** Create `src/core/rewards.ts`, `tests/core/rewards.test.ts`

- [ ] 失败测试（手算样例）：
      `income(默认Progress)` 全零；10 关得星（3★×5+2★×3+1★×2）→ 煤 10、铁 13；
      `P=207` → 煤 +25、金 8、钻 +1；`N★=23` → 钻 +2；
      `litBest=11, bestStreak=27` → 绿 5
- [ ] 性质测试：对任意「进度增长」操作（加星/星级提升/P+1/litBest+1）收入逐项单调不减；
      重玩同关星级不变时收入不变（farm-proof）
- [ ] 实现 `income()`，公式照抄规范 §3
- [ ] 绿 → 提交

## Task 3: 余额 / 制作 / 解锁 / 兑换 / 点星（TDD）

**Files:** Modify `src/core/rewards.ts`, `tests/core/rewards.test.ts`; Modify `src/core/types.ts`（rewards 切片类型）

- [ ] 失败测试：`spent` 按 owned+skyStars+traded 结算；`balance ≥ 0` 性质；
      `tierUnlocked`：皮革恒开、铁需皮革 4 件、**不可越阶**（有 2 钻但皮革未齐时钻靴不可做）；
      `craft` 幂等（重复 craft 同 id 原样返回）、余额不足拒绝；
      `trade` 四段算术（4 煤→1 铁后煤−4 铁+1）、余额不足拒绝、无向下兑换；
      `lightStar` 10 煤门槛、按图样顺序推进
- [ ] 实现全部函数
- [ ] 绿 → 提交

## Task 4: 画像仿真回归（把评审时间线变成测试）

**Files:** Create `tests/core/rewardsSimulation.test.ts`

- [ ] 三条脚本化周进度流（收入假设照评审 §F）：
      常规画像——皮革靴首会话可达、钻套 ≤10 周、任意空窗 ≤14 天（装备+配件+星合并计）；
      跳级画像——从 46 关起步、全程 `income` 不要求任何低章星（路径无关复验）、钻套 ≤9 周；
      弱画像——铁阶靠 4:1 无死锁、钻套 ≤21 周
- [ ] 仿真辅助放 `tests/core/helpers.ts`（周推进函数），不进 src
- [ ] 绿 → 提交 `test(core): 三画像经济仿真回归`

## Task 5: 数据切片 + 迁移 + 埋点

**Files:** Modify `src/core/storage.ts`, `src/core/types.ts`, `src/ui/App.tsx`; Modify `tests/core/storage.test.ts`

- [ ] 失败测试：无 rewards 切片的 v2 存档载入后
      `practiceFirstTry === endless.totalAnswered`、owned/skyStars/traded 为空；
      已有切片原样保留；weekly 翻周重置
- [ ] 实现 merge-over-defaults + 折算；`App.answer()` 埋点：
      非 campaign 且 `excluded.length===0` 的答对 → `practiceFirstTry+1`、weekly 计数；
      星图按 `resolved` 首触语义
- [ ] 绿；`npm test` 全量绿 → 提交

## Task 6: 装备叠加素材 + manifest

**Files:** Modify `scripts/gen-steve.mjs`; Create（生成）`src/assets/eq-*.png` ×16、`src/assets/ac-*.png` ×12、`src/ui/components/steveMeta.ts`

- [ ] gen-steve 增加：四套装备配色（皮革/铁/金/钻各明暗两档）按 slot 输出叠加网格
      （靴=腿部末 4 行、盔=头部 y8–12、腿=腿部、胸=躯干），裁剪偏移写入生成的
      `steveMeta.ts`；12 件配件小网格（16×16 内）
- [ ] 测试：manifest 覆盖全部 5 姿势；每目录 id 有对应素材文件（fs 检查，Node 环境可用）
- [ ] 目视：合成一张混搭表（皮革靴+铁盔+金胸）确认对位
- [ ] 提交 `feat(assets): 装备叠加层与姿势偏移 manifest`

## Task 7: Steve 组件混搭渲染

**Files:** Modify `src/ui/components/Steve.tsx`, `src/styles.css`

- [ ] `equipped` prop → 容器内基础精灵 + 按 manifest 定位的叠加 img
      （全部 pixelated，缩放同源；答题屏内无动效）
- [ ] 调用点传入当前穿戴（App 持有 progress）
- [ ] 目视五姿势 × 混搭各一张 → 提交

## Task 8: 养成屏（装备标签）+ 入口

**Files:** Create `src/ui/screens/Steve.tsx`（屏，注意与组件重名——屏文件命名 `SteveScreen.tsx`）; Modify `src/ui/session.ts`（Screen 加 `'steve'`）, `src/ui/App.tsx`, `src/ui/screens/Map.tsx`, `src/styles.css`

- [ ] 入口改造：史蒂夫卡片 onClick → 进屏；🔊 徽标 stopPropagation 念台词；
      顶栏加煤计数（仅地图屏）
- [ ] 装备标签：阶列表（渐次显形：解锁阶展开、下一阶剪影+价、其后不显示）、
      中央立绘点件穿脱、点阵价格渲染（M3）
- [ ] 呈现纪律自查：无角标、无红点、无换装计数（§6 检查单逐条过）
- [ ] 进屏欢迎语音 → 提交

## Task 9: 工作台标签（配件 / 兑换 / 点星）

**Files:** Modify `src/ui/screens/SteveScreen.tsx`, `src/styles.css`

- [ ] 配件目录渐次显形（已拥有 + 下 2–3 件，无「?」）；制作按钮（「做」措辞）
- [ ] 兑换 4 条（÷4/×4 点阵呈现）；点星入口
- [ ] 材料说明卡（点矿石念来源）→ 提交

## Task 10: 地图夜空层 + 结算入账

**Files:** Modify `src/ui/screens/Map.tsx`, `src/ui/screens/Result.tsx`, `src/ui/App.tsx`, `src/styles.css`

- [ ] 夜空层：已点亮星按图样常量渲染进地图背景；星座集齐连线常驻
- [ ] 结算卡增量行 `income(after)−income(before)`：静态、≤1s、无音效；
      **确认无尽/限时/星图结算同样只在结算处入账**
- [ ] 提交

## Task 11: 家长面（开关 / 清单 / 重置文案 / 周小结行）

**Files:** Modify `src/ui/components/SettingsModal.tsx`, `src/core/types.ts`（settings 加 `steveRaise: boolean` 默认 true）

- [ ] 开关：关 = 隐藏入口与煤计数，史蒂夫保持装扮（测试：equipped 不被清）
- [ ] 观察清单静态文案（评审版逐条照抄）；重置二次确认追加装备/星星消失提示
- [ ] 周小结行「本周答题 N · 首答正确率 P%」→ 提交

## Task 12: 语音 / 字体 / 全量验收

**Files:** Modify `src/ui/App.tsx`（VOICE 表）; 运行 `scripts/subset-font.sh`

- [ ] 新 TTS 行（欢迎/制作成功/点星/星座集齐/材料来源）；
      `bash scripts/subset-font.sh` 重跑子集 → charset 测试绿
- [ ] 全量：`npm test` 全绿；`npm run build`；dist 增量 ≤30KB（全部素材为字节级像素图）
- [ ] 逐屏目视 + 呈现纪律 §6 七条终查；生产 preview 断网冒烟
- [ ] 提交 → 汇报，合并决策留给用户

---

## 回滚

每任务独立提交。核心经济在 `src/core/rewards*.ts` 纯函数内，UI 崩了不伤数据
（余额可从 Progress 重算）。最坏 `git revert` 区间即可，`src/core` 既有模块零改动
（除 types/storage 的附加切片）。
