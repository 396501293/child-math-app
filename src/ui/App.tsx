import { useEffect, useRef, useState } from 'preact/hooks';
import type { BandConfig, Progress, Question } from '../core/types';
import { bandOf } from '../core/bands';
import { itemKey } from '../core/enumerate';
import { applyHardMode, generateLevel, generateQuestion } from '../core/generator';
import { endlessBand, starsFor, timedPool, unlockAfterWin } from '../core/progression';
import { loadProgress, saveProgress } from '../core/storage';
import { useStageScale } from './scale';
import { Map } from './screens/Map';
import { Quiz } from './screens/Quiz';
import { Result } from './screens/Result';
import { RotateOverlay } from './components/RotateOverlay';

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
  feedback: 'right' | 'wrong' | null;
  correctCount: number;
  streak: number;
  runBestStreak: number;
  timeLeftMs?: number;                // timed
  recentKeys: string[];               // 模式滚动去重（最近 5 题）
  current?: Question;                 // endless/timed 当前题
  resultStars?: 1 | 2 | 3;            // campaign 结算星级（进结算前算定并落盘，供结算屏读取）
}

const TIMED_START_MS = 60_000;

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
  const scale = useStageScale();
  const portrait = usePortrait();

  // 反馈延迟推进的定时器；退出/卸载时清除，避免离开答题屏后仍触发。
  const timerRef = useRef<number | undefined>(undefined);
  // 供定时器回调读取最新 session（避免闭包读到旧值）。
  const sessionRef = useRef<Session | null>(session);
  sessionRef.current = session;

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
      // `progress` 此刻是当前值（关内不改 progress），unlockAfterWin 基于它即可，
      // 不依赖 setState 后的 re-render 时序。「下一关」按钮点击已是后续 render，
      // 那时 startLevel 读到的是更新后的 progress，无陈旧闭包风险。
      const stars = starsFor(s.wrongTotal);
      updateProgress(unlockAfterWin(progress, s.level!, stars));
      setSession({ ...s, feedback: null, resultStars: stars });
      setScreen('result');
    } else {
      setSession({ ...s, qIndex: s.qIndex + 1, feedback: null, excluded: [], wrongThis: 0 });
    }
  };
  const advanceModeCorrect = () => {
    const s = sessionRef.current;
    if (!s || s.mode === 'campaign') return;
    const correctCount = s.correctCount + 1;
    const streak = s.streak + 1;
    const recentKeys = [...s.recentKeys, itemKey(s.current!)].slice(-5);
    setSession({
      ...s,
      current: nextModeQuestion(s.mode, correctCount, recentKeys),
      recentKeys,
      correctCount,
      streak,
      runBestStreak: Math.max(s.runBestStreak, streak),
      feedback: null,
      excluded: [],
    });
  };

  // 批改选项。答对：闪青绿 + 遮罩，延迟推进。答错：排除该项 + shake，0.9s 后清除反馈原地重试。
  const answer = (option: number) => {
    const s = sessionRef.current;
    if (!s || s.feedback !== null) return; // 反馈展示期间忽略（含答对 1.1s 窗口，防止二次触发）
    const q = s.mode === 'campaign' ? s.questions![s.qIndex] : s.current!;
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
      });
      timerRef.current = window.setTimeout(() => {
        setSession((prev) => (prev && prev.feedback === 'wrong' ? { ...prev, feedback: null } : prev));
      }, 900);
    }
  };

  // Task 13 接 TTS。
  const replayTts = () => {};

  const exitToMap = () => {
    clearTimer();
    setSession(null);
    setScreen('map');
  };

  const openSettings = () => {}; // Task 12 接 SettingsModal（长按齿轮）

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
            onAnswer={answer}
            onExit={exitToMap}
            onReplay={replayTts}
          />
        )}
        {/* 结算屏仅服务 campaign；endless/timed 结算变体于 Task 12 接入（届时按 mode 分支）。 */}
        {screen === 'result' && session && session.mode === 'campaign' && (
          <Result
            level={session.level!}
            stars={session.resultStars ?? starsFor(session.wrongTotal)}
            onBackToMap={exitToMap}
            onNextLevel={session.level! < 45 ? () => startLevel(session.level! + 1) : undefined}
          />
        )}
      </div>
      {portrait && <RotateOverlay />}
    </div>
  );
}
