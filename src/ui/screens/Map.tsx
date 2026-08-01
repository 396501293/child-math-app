import { useEffect, useRef, useState } from 'preact/hooks';
import type { Progress } from '../../core/types';
import { chapterOf, chapterStart, effectiveLevel, endlessUnlocked, mapNodeState, timedUnlocked, timesTableUnlocked } from '../../core/progression';
import { Steve } from '../components/Steve';
import nodeLocked from '../../assets/ico-lock.png';
import { balance } from '../../core/rewards';
import { ORE_SRC } from '../components/oreAssets';
import { SkyLayer } from '../components/SkyLayer';
import icoEndless from '../../assets/ico-mode-endless.png';
import icoStar from '../../assets/ico-mode-chart.png';
import icoTimed from '../../assets/ico-mode-timed.png';
import { Ico } from '../components/Ico';

interface MapProps {
  progress: Progress;
  onStartLevel: (level: number) => void;
  onStartEndless: () => void;
  onStartTimed: () => void;
  onOpenStarChart: () => void; // 进九九星图模式主页
  onOpenSteve: () => void;     // 点史蒂夫卡片进养成屏（🔊 徽标仍念台词）
  onOpenSettings: () => void;
  onWelcome: (line: string) => void; // 点击史蒂夫卡片/🔊 徽标念欢迎语（首次交互后发声，无自动播）
}

const CN_NUM = ['一', '二', '三', '四', '五'];
const CHAPTER_NAME = ['启航', '深海', '远洋', '银河', '下界'];
const STEVE_LINES = ['准备好出发了吗？', '这一关有点挑战，加油！', '你越来越厉害了！', '星星快集满一排啦！'];

// 蛇形路径几何（面板内坐标，面板 660×598）：5 列节点 × 3 行，第 2 行反向。
const ROW_Y = [175, 325, 475];
// PATH_D 的坐标与 ROW_Y 及节点行 flex 布局（left/right:52、space-between、格宽 80）手工耦合——改动需同步。
const PATH_D = 'M 92 175 H 568 C 620 175 620 325 568 325 H 92 C 40 325 40 475 92 475 H 568';

const SEEN_KEY = 'math_nightsail_seen_modes';

function loadSeen(): Record<string, boolean> {
  try {
    const raw = globalThis.localStorage?.getItem(SEEN_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as Record<string, boolean>;
    }
  } catch {
    // 忽略解析/存储异常
  }
  return {};
}

function saveSeen(seen: Record<string, boolean>): void {
  try {
    globalThis.localStorage?.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // 私密模式/满额：静默降级
  }
}

// 模式键类名：解锁时挂颜色修饰类，锁定时不挂（改由 .mn-btn.is-locked 统一置灰）。
const modeClass = (color: string, unlocked: boolean): string =>
  unlocked ? `mn-btn ${color} mn-mode-btn` : 'mn-btn mn-mode-btn is-locked';

type NodeState = 'done' | 'current' | 'locked';

function NodeCell({ level, state, stars, onTap }: {
  level: number;
  state: NodeState;
  stars: number;
  onTap: () => void;
}) {
  const cls =
    state === 'current' ? 'mn-node mn-node--current'
    : state === 'locked' ? 'mn-node mn-node--locked'
    : 'mn-node mn-node--done';
  const starStr = state === 'done' ? '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars) : '';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 80 }}>
      <div style={{ height: 92, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div class={cls} onClick={state === 'locked' ? undefined : onTap}>
          {state === 'locked' ? <img src={nodeLocked} alt="未解锁" /> : level}
        </div>
      </div>
      <div class="mn-node-stars">{starStr}</div>
    </div>
  );
}

export function Map({ progress, onStartLevel, onStartEndless, onStartTimed, onOpenStarChart, onOpenSteve, onOpenSettings, onWelcome }: MapProps) {
  const maxChapter = chapterOf(progress.unlocked);
  // 落地章跟随真实前沿（审查 A1）：unlock-all 后仍打开孩子正在学的那一章
  const [viewChapter, setViewChapter] = useState<number>(chapterOf(effectiveLevel(progress)));
  const [seen, setSeen] = useState<Record<string, boolean>>(loadSeen);

  const cnNum = CN_NUM[viewChapter - 1];
  const chapterName = CHAPTER_NAME[viewChapter - 1];
  const start = chapterStart(viewChapter);
  const levels = Array.from({ length: 15 }, (_, i) => start + i);

  const stateOf = (n: number): NodeState => mapNodeState(progress, n);

  const doneCount = levels.filter((n) => (progress.stars[n] ?? 0) > 0).length;
  const chapterStars = levels.reduce((sum, n) => sum + (progress.stars[n] ?? 0), 0);

  const rows = [levels.slice(0, 5), levels.slice(5, 10).reverse(), levels.slice(10, 15)];

  // CTA 与台词轮换锚真实前沿，unlocked 只决定节点可点性（审查 A1）
  const current = effectiveLevel(progress);
  const steveLine = STEVE_LINES[current % STEVE_LINES.length];

  const leftDisabled = viewChapter <= 1;
  const rightLocked = viewChapter < 5 && viewChapter + 1 > maxChapter;
  const rightDisabled = viewChapter >= 5 || rightLocked;

  const endlessOn = endlessUnlocked(progress);
  const timedOn = timedUnlocked(progress);
  const starChartOn = timesTableUnlocked(progress);

  const openMode = (key: 'endless' | 'timed' | 'starchart', run: () => void) => {
    if (!seen[key]) {
      const next = { ...seen, [key]: true };
      saveSeen(next);
      setSeen(next);
    }
    run();
  };

  // 齿轮长按 1.5s 才打开设置（防误触）：pointerdown 起计时，抬起/移出取消；普通点击无效。
  const gearTimer = useRef<number | undefined>(undefined);
  const startHold = () => {
    gearTimer.current = window.setTimeout(onOpenSettings, 1500);
  };
  const cancelHold = () => {
    window.clearTimeout(gearTimer.current);
    gearTimer.current = undefined;
  };
  useEffect(() => () => window.clearTimeout(gearTimer.current), []);


  return (
    <>
      {/* ─── 夜空层：点亮的星常驻地图背景（评审：终局层 = 环境级展示物） ─── */}
      <SkyLayer skyStars={progress.rewards.skyStars} />
      {/* ─── 顶栏 ─── */}
      <div style={{ position: 'absolute', top: 32, left: 40, right: 40, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ fontSize: 38, fontWeight: 900, color: 'var(--color-white-100)' }}>
          数学夜航 · 第{cnNum}章 · {chapterName}
        </div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-white-55)' }}>{doneCount} / 15 关</div>
        <div class="mn-star-cap" style={{ marginLeft: 'auto' }}>★ {chapterStars}</div>
        {progress.settings.steveRaise && (
          <div class="mn-coal-cap">
            <img class="mn-ico" src={ORE_SRC.coal} alt="煤" /> {balance(progress).coal}
          </div>
        )}
      </div>

      {/* ─── 左路径面板 ─── */}
      <div class="mn-panel" style={{ position: 'absolute', top: 130, left: 40, width: 660, bottom: 40, overflow: 'hidden' }}>
        {/* 章节切换行 */}
        <div style={{ position: 'absolute', top: 16, left: 24, right: 24, height: 68, display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            class={leftDisabled ? 'mn-btn mn-btn--square mn-arrow is-disabled' : 'mn-btn mn-btn--square mn-arrow'}
            disabled={leftDisabled}
            onClick={leftDisabled ? undefined : () => setViewChapter((c) => c - 1)}
            aria-label="上一章"
          >
            ‹
          </button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
            <span class="mn-ribbon" style={{ fontSize: 22 }}>第{cnNum}章 · {chapterName}</span>
          </div>
          <button
            class={rightDisabled ? 'mn-btn mn-btn--square mn-arrow is-disabled' : 'mn-btn mn-btn--square mn-arrow'}
            disabled={rightDisabled}
            onClick={rightDisabled ? undefined : () => setViewChapter((c) => c + 1)}
            aria-label={rightLocked ? '下一章（未解锁）' : '下一章'}
          >
            {rightLocked ? <Ico name="lock" /> : '›'}
          </button>
        </div>

        {/* 蛇形虚线路径 */}
        <svg width="660" height="598" style={{ position: 'absolute', top: 0, left: 0 }}>
          <path d={PATH_D} fill="none" style={{ stroke: 'var(--path-dash)' }} strokeWidth={10} strokeLinecap="butt" strokeDasharray="10 14" />
        </svg>

        {/* 节点三行 */}
        {rows.map((row, r) => (
          <div key={r} style={{ position: 'absolute', left: 52, right: 52, top: ROW_Y[r] - 46, display: 'flex', justifyContent: 'space-between' }}>
            {row.map((n) => (
              <NodeCell key={n} level={n} state={stateOf(n)} stars={progress.stars[n] ?? 0} onTap={() => onStartLevel(n)} />
            ))}
          </div>
        ))}
      </div>

      {/* ─── 右面板 ─── */}
      <div style={{ position: 'absolute', top: 130, right: 40, width: 280, bottom: 40, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          class="mn-panel"
          style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, cursor: 'pointer' }}
          onClick={() => (progress.settings.steveRaise ? onOpenSteve() : onWelcome(steveLine))}
        >
          <Steve pose="wave" equipped={progress.rewards.equipped} />
          <div style={{ fontSize: 23, color: 'var(--color-white-85)', textAlign: 'center', lineHeight: 1.5, padding: '0 18px' }}>
            {steveLine}{' '}
            <span
              class="mn-tts-badge"
              role="button"
              aria-label="念一句"
              onClick={(e) => { e.stopPropagation(); onWelcome(steveLine); }}
            >
              <Ico name="sound" />
            </span>
          </div>
        </div>

        {/* 通关后语义从「没做完」变「自选挑战」（审查 A4）；仍指第 60 关 */}
        <button class="mn-btn mn-btn--coral mn-cta" onClick={() => onStartLevel(current)}>
          {(progress.stars[75] ?? 0) >= 1 ? '再战下界大挑战 ▶' : `挑战第 ${current} 关 ▶`}
        </button>

        {/* 三个模式键分配琥珀/青绿/叶绿：既是动森的色彩性格，
            也让 4–7 岁能靠颜色而非文字辨认模式。 */}
        <button
          class={modeClass('mn-btn--amber', endlessOn)}
          disabled={!endlessOn}
          onClick={endlessOn ? () => openMode('endless', onStartEndless) : undefined}
        >
          <img class="mn-mode-ico" src={icoEndless} alt="" />
          {!endlessOn && <Ico name="lock" />}无尽夜航
          {endlessOn && !seen.endless && <span class="mn-badge">新玩法！</span>}
        </button>

        <button
          class={modeClass('mn-btn--teal', timedOn)}
          disabled={!timedOn}
          onClick={timedOn ? () => openMode('timed', onStartTimed) : undefined}
        >
          <img class="mn-mode-ico" src={icoTimed} alt="" />
          {!timedOn && <Ico name="lock" />}星光冲刺
          {timedOn && !seen.timed && <span class="mn-badge">新玩法！</span>}
        </button>

        <button
          class={modeClass('mn-btn--leaf', starChartOn)}
          disabled={!starChartOn}
          onClick={starChartOn ? () => openMode('starchart', onOpenStarChart) : undefined}
        >
          <img class="mn-mode-ico" src={icoStar} alt="" />
          {!starChartOn && <Ico name="lock" />}九九星图
          {starChartOn && !seen.starchart && <span class="mn-badge">新玩法！</span>}
        </button>
      </div>

      {/* ─── 右下角齿轮：长按 1.5s 打开家长设置 ─── */}
      <button
        class="mn-btn mn-btn--square mn-gear"
        style={{ position: 'absolute', right: 16, bottom: 16 }}
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="家长设置（长按打开）"
      >
        <Ico name="gear" />
      </button>
    </>
  );
}
