import { useEffect, useRef, useState } from 'preact/hooks';
import type { BandConfig, Progress, Question } from '../core/types';
import { bandOf } from '../core/bands';
import { itemKey } from '../core/enumerate';
import { applyHardMode, generateLevel, generateQuestion } from '../core/generator';
import { endlessBand, starsFor, timedPool, unlockAfterWin } from '../core/progression';
import { defaultProgress, loadProgress, saveProgress } from '../core/storage';
import { useStageScale } from './scale';
import { Map } from './screens/Map';
import { Quiz } from './screens/Quiz';
import { Result } from './screens/Result';
import { RotateOverlay } from './components/RotateOverlay';
import { SettingsModal } from './components/SettingsModal';

export type Screen = 'map' | 'quiz' | 'result';
export type Mode = 'campaign' | 'endless' | 'timed';

export interface Session {
  mode: Mode;
  level?: number;                     // campaign
  questions?: Question[];             // campaign 预生成；模式流式
  qIndex: number;
  wrongThis: number;
  wrongTotal: number;
  excluded: number[];                 // 本题已排除的错误选项
  lastWrong?: number;                 // 最近一次点错的选项值（仅该项在 wrong 反馈期抖动）
  feedback: 'right' | 'wrong' | null;
  correctCount: number;
  streak: number;
  runBestStreak: number;
  timeLeftMs?: number;                // timed 起始值；每帧真值在 timeLeftRef，见计时 effect
  recentKeys: string[];               // 模式滚动去重（最近 5 题）
  current?: Question;                 // endless/timed 当前题
  resultStars?: 1 | 2 | 3;            // campaign 结算星级（进结算前算定并落盘，供结算屏读取）
  resultBroke?: boolean;              // endless/timed 是否破纪录（进结算瞬间算定，供结算屏庆祝）
}

const TIMED_START_MS = 60_000;
const TIMED_MAX_MS = 90_000;
const TIMED_BONUS_MS = 8_000;

// 当前题选择器：campaign 读预生成数组，endless/timed 读流式 current。
// （App 与 Quiz 共用，避免两处重复该分支。）
export function currentQuestion(s: Session): Question {
  return s.mode === 'campaign' ? s.questions![s.qIndex] : s.current!;
}

function usePortrait(): boolean {
  const [portrait, setPortrait] = useState(() => window.innerHeight > window.innerWidth);
  useEffect(() => {
    const onResize = () => setPortrait(window.innerHeight > window.innerWidth);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);
  return portrait;
}

export function App() {
  const [progress, setProgressState] = useState<Progress>(() => loadProgress());
  const [screen, setScreen] = useState<Screen>('map');
  const [session, setSession] = useState<Session | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const scale = useStageScale();
  const portrait = usePortrait();

  // 反馈延迟推进的定时器；退出/卸载时清除，避免离开答题屏后仍触发。
  const timerRef = useRef<number | undefined>(undefined);
  // 供定时器/rAF 回调读取最新 session（避免闭包读到旧值）。
  const sessionRef = useRef<Session | null>(session);
  sessionRef.current = session;

  // 限时计时（spec §5）：真值在 timeLeftRef，rAF 以 performance.now() 差值递减；
  // displayTimeLeft 仅驱动 TimerBar（节流 ~100ms），刻意不每帧重建整个 session。
  const timeLeftRef = useRef(TIMED_START_MS);
  const [displayTimeLeft, setDisplayTimeLeft] = useState(TIMED_START_MS);
  // rAF 回调捕获于 effect 创建那一刻，用 ref 指向最新 finishTimed，避免闭包读到旧 progress。
  const finishTimedRef = useRef<() => void>(() => {});

  const clearTimer = () => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  };
  useEffect(() => () => clearTimer(), []);

  const updateProgress = (p: Progress) => {
    setProgressState(p);
    saveProgress(p);
  };

  const applyIfHard = (cfg: BandConfig): BandConfig =>
    progress.settings.hardMode ? applyHardMode(cfg) : cfg;

  const blankRun = (mode: Mode): Session => ({
    mode,
    qIndex: 0,
    wrongThis: 0,
    wrongTotal: 0,
    excluded: [],
    feedback: null,
    correctCount: 0,
    streak: 0,
    runBestStreak: 0,
    recentKeys: [],
  });

  const startLevel = (level: number) => {
    const questions = generateLevel(applyIfHard(bandOf(level)), progress.settings.questionCount, Math.random);
    setSession({ ...blankRun('campaign'), level, questions });
    setScreen('quiz');
  };

  // 模式流式出题：无尽档位随连对爬升；限时从已完成档均匀混抽。滚动去重（最近 5 题）。
  const nextModeQuestion = (mode: Mode, correctCount: number, recentKeys: string[]): Question => {
    if (mode === 'endless') {
      const band = endlessBand(correctCount, progress.unlocked);
      return generateQuestion(applyIfHard(bandOf(band)), Math.random, recentKeys);
    }
    const pool = timedPool(progress);
    const band = pool.length ? pool[Math.floor(Math.random() * pool.length)] : progress.unlocked;
    return generateQuestion(applyIfHard(bandOf(band)), Math.random, recentKeys);
  };

  const startEndless = () => {
    setSession({ ...blankRun('endless'), current: nextModeQuestion('endless', 0, []) });
    setScreen('quiz');
  };

  const startTimed = () => {
    timeLeftRef.current = TIMED_START_MS; // 计时真值复位（rAF effect 会随 mode/screen 变化启动）
    setDisplayTimeLeft(TIMED_START_MS);
    setSession({ ...blankRun('timed'), timeLeftMs: TIMED_START_MS, current: nextModeQuestion('timed', 0, []) });
    setScreen('quiz');
  };

  // 答对 1.1s 后推进：主线到下一题或结算；模式生成下一题（滚动去重 + 计数/连对）。
  const advanceCampaign = () => {
    const s = sessionRef.current;
    if (!s || s.mode !== 'campaign') return;
    const last = s.qIndex + 1 >= s.questions!.length;
    if (last) {
      // 结算：星级一次算定并立即落盘（不在结算 render / 按钮点击时算），
      // 这样即便玩家在结算屏退出 App，本次胜利与解锁也已保存。
      const stars = starsFor(s.wrongTotal);
      updateProgress(unlockAfterWin(progress, s.level!, stars));
      setSession({ ...s, feedback: null, resultStars: stars });
      setScreen('result');
    } else {
      setSession({ ...s, qIndex: s.qIndex + 1, feedback: null, excluded: [], lastWrong: undefined, wrongThis: 0 });
    }
  };
  const advanceModeCorrect = () => {
    const s = sessionRef.current;
    if (!s || s.mode === 'campaign') return;
    const correctCount = s.correctCount + 1;
    const streak = s.streak + 1;
    const recentKeys = [...s.recentKeys, itemKey(s.current!)].slice(-5);
    if (s.mode === 'timed') {
      // 答对 +8s，上限 90s。此刻 feedback 刚清除、时间条重新可见，宽度增大触发回弹动画。
      timeLeftRef.current = Math.min(TIMED_MAX_MS, timeLeftRef.current + TIMED_BONUS_MS);
      setDisplayTimeLeft(timeLeftRef.current);
    }
    setSession({
      ...s,
      current: nextModeQuestion(s.mode, correctCount, recentKeys),
      recentKeys,
      correctCount,
      streak,
      runBestStreak: Math.max(s.runBestStreak, streak),
      feedback: null,
      excluded: [],
      lastWrong: undefined,
    });
  };

  // 批改选项。答对：闪青绿 + 遮罩，延迟推进。答错：排除该项 + shake，0.9s 后清除反馈原地重试。
  const answer = (option: number) => {
    const s = sessionRef.current;
    if (!s || s.feedback !== null) return; // 反馈展示期间忽略（含答对 1.1s 窗口，防止二次触发）
    const q = currentQuestion(s);
    clearTimer();
    if (option === q.answer) {
      setSession({ ...s, feedback: 'right' });
      timerRef.current = window.setTimeout(
        s.mode === 'campaign' ? advanceCampaign : advanceModeCorrect,
        1100,
      );
    } else {
      setSession({
        ...s,
        feedback: 'wrong',
        wrongThis: s.wrongThis + 1,
        wrongTotal: s.wrongTotal + 1,
        streak: 0, // 答错中断连对（模式用；主线不读）
        excluded: [...s.excluded, option],
        lastWrong: option, // 仅这一项在 wrong 反馈期抖动，旧排除项保持静止半透明
      });
      timerRef.current = window.setTimeout(() => {
        setSession((prev) => (prev && prev.feedback === 'wrong' ? { ...prev, feedback: null } : prev));
      }, 900);
    }
  };

  // 无尽结束本轮（返回键触发）→ 无尽结算。进结算瞬间持久化 bestStreak / totalAnswered。
  const finishEndless = () => {
    const s = sessionRef.current;
    if (!s || s.mode !== 'endless') return;
    clearTimer();
    const oldBest = progress.endless.bestStreak;
    const broke = s.runBestStreak > oldBest;
    updateProgress({
      ...progress,
      endless: {
        bestStreak: Math.max(oldBest, s.runBestStreak),
        totalAnswered: progress.endless.totalAnswered + s.correctCount,
      },
    });
    setSession({ ...s, feedback: null, resultBroke: broke });
    setScreen('result');
  };

  // 限时时间到 → 冲刺结算。进结算瞬间持久化 bestCount。由 rAF（经 finishTimedRef）触发。
  const finishTimed = () => {
    const s = sessionRef.current;
    if (!s || s.mode !== 'timed') return;
    clearTimer();
    const oldBest = progress.timed.bestCount;
    const broke = s.correctCount > oldBest;
    updateProgress({ ...progress, timed: { bestCount: Math.max(oldBest, s.correctCount) } });
    setSession({ ...s, feedback: null, resultBroke: broke });
    setScreen('result');
  };
  finishTimedRef.current = finishTimed; // 每次 render 刷新，保证 rAF 调用到最新闭包

  // 限时计时 rAF 循环（spec §5）：仅在 timed + quiz 时运行；退出即 cancel。
  // performance.now() 差值递减 timeLeftRef；节流写 displayTimeLeft（避免每帧重渲整树）。
  // visibilitychange 隐藏时不累计（隐藏期间时间不流失），可见时重置基准继续。
  // 时间到（≤0）时若仍有反馈在展示（答对 1.1s / 答错 0.9s 窗口），等反馈清掉再结算。
  const timedActive = session?.mode === 'timed' && screen === 'quiz';
  useEffect(() => {
    if (!timedActive) return;
    let raf = 0;
    let last = performance.now();
    let hidden = document.hidden;

    const onVis = () => {
      if (document.hidden) {
        hidden = true;
      } else {
        hidden = false;
        last = performance.now(); // 丢弃隐藏期间的时长
      }
    };
    document.addEventListener('visibilitychange', onVis);

    const tick = (now: number) => {
      if (hidden) {
        last = now; // 隐藏时保持基准新鲜（rAF 一般已被浏览器暂停，双保险）
      } else {
        const dt = now - last;
        last = now;
        timeLeftRef.current = Math.max(0, timeLeftRef.current - dt);
        const v = timeLeftRef.current;
        setDisplayTimeLeft((prev) => (v === 0 || Math.abs(prev - v) >= 100 ? v : prev));
        if (v <= 0 && sessionRef.current?.feedback == null) {
          finishTimedRef.current(); // 结算并切屏；不再排下一帧
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [timedActive]);

  // Task 13 接 TTS。
  const replayTts = () => {};

  const exitToMap = () => {
    clearTimer();
    setSession(null);
    setScreen('map');
  };

  // 答题屏返回键：无尽 = 结束本轮进结算；campaign / timed = 放弃本轮直接回地图（不结算不记录）。
  const onQuizExit = () => {
    if (sessionRef.current?.mode === 'endless') finishEndless();
    else exitToMap();
  };

  const openSettings = () => setSettingsOpen(true);
  const updateSettings = (patch: Partial<Progress['settings']>) => {
    updateProgress({ ...progress, settings: { ...progress.settings, ...patch } });
  };
  const resetProgress = () => {
    updateProgress(defaultProgress());
    setSettingsOpen(false);
    setSession(null);
    setScreen('map');
  };

  return (
    <div class="mn-viewport">
      <div class="mn-stage" style={{ transform: `scale(${scale})` }}>
        {screen === 'map' && (
          <Map
            progress={progress}
            onStartLevel={startLevel}
            onStartEndless={startEndless}
            onStartTimed={startTimed}
            onOpenSettings={openSettings}
          />
        )}
        {screen === 'quiz' && session && (
          <Quiz
            session={session}
            showBlocks={
              session.mode === 'timed'
                ? progress.settings.showBlocksTimed
                : progress.settings.showBlocks
            }
            timeLeftMs={displayTimeLeft}
            timeMaxMs={TIMED_MAX_MS}
            onAnswer={answer}
            onExit={onQuizExit}
            onReplay={replayTts}
          />
        )}
        {/* 结算屏对三种 mode 穷举，无静默空屏。 */}
        {screen === 'result' && session && (
          session.mode === 'campaign' ? (
            <Result
              variant="campaign"
              level={session.level!}
              stars={session.resultStars ?? starsFor(session.wrongTotal)}
              onBackToMap={exitToMap}
              onNextLevel={session.level! < 45 ? () => startLevel(session.level! + 1) : undefined}
            />
          ) : session.mode === 'endless' ? (
            <Result
              variant="endless"
              answered={session.correctCount}
              runBestStreak={session.runBestStreak}
              historyBestStreak={progress.endless.bestStreak}
              broke={!!session.resultBroke}
              onBackToMap={exitToMap}
            />
          ) : (
            <Result
              variant="timed"
              answered={session.correctCount}
              bestCount={progress.timed.bestCount}
              broke={!!session.resultBroke}
              onBackToMap={exitToMap}
            />
          )
        )}
        {settingsOpen && (
          <SettingsModal
            settings={progress.settings}
            onUpdateSettings={updateSettings}
            onResetProgress={resetProgress}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>
      {portrait && <RotateOverlay />}
    </div>
  );
}
