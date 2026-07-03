import { useEffect, useState } from 'preact/hooks';
import type { BandConfig, Progress, Question } from '../core/types';
import { bandOf } from '../core/bands';
import { applyHardMode, generateLevel, generateQuestion } from '../core/generator';
import { endlessBand, timedPool } from '../core/progression';
import { loadProgress, saveProgress } from '../core/storage';
import { useStageScale } from './scale';
import { Map } from './screens/Map';
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

// 占位屏（Task 10 答题 / Task 11 结算填充）
function Placeholder({ label, onExit, onReplay }: { label: string; onExit: () => void; onReplay: () => void }) {
  return (
    <div class="mn-placeholder">
      <div>{label}</div>
      <div class="mn-placeholder-row">
        <button class="mn-mode-btn" style={{ width: 'auto', padding: '18px 40px' }} onClick={onExit}>← 返回地图</button>
        <button class="mn-mode-btn" style={{ width: 'auto', padding: '18px 40px' }} onClick={onReplay}>🔊 重播</button>
      </div>
    </div>
  );
}

export function App() {
  const [progress, setProgressState] = useState<Progress>(() => loadProgress());
  const [screen, setScreen] = useState<Screen>('map');
  const [session, setSession] = useState<Session | null>(null);
  const scale = useStageScale();
  const portrait = usePortrait();

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

  const startEndless = () => {
    const band = endlessBand(0, progress.unlocked);
    const current = generateQuestion(applyIfHard(bandOf(band)), Math.random, []);
    setSession({ ...blankRun('endless'), current });
    setScreen('quiz');
  };

  const startTimed = () => {
    const pool = timedPool(progress);
    const band = pool.length ? pool[Math.floor(Math.random() * pool.length)] : progress.unlocked;
    const current = generateQuestion(applyIfHard(bandOf(band)), Math.random, []);
    setSession({ ...blankRun('timed'), timeLeftMs: TIMED_START_MS, current });
    setScreen('quiz');
  };

  // Task 10 填充：批改选项、推进题目、结算。
  const answer = (_option: number) => {};
  // Task 13 接 TTS。
  const replayTts = () => {};

  const exitToMap = () => {
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
        {screen === 'quiz' && (
          <Placeholder label="quiz 屏（Task 10）" onExit={exitToMap} onReplay={replayTts} />
        )}
        {screen === 'result' && (
          <Placeholder label="result 屏（Task 11）" onExit={exitToMap} onReplay={replayTts} />
        )}
      </div>
      {portrait && <RotateOverlay />}
    </div>
  );
}
