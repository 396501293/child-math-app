import { useEffect, useRef, useState } from 'preact/hooks';
import type { BandConfig, Progress, Question } from '../core/types';
import { bandOf } from '../core/bands';
import { itemKey } from '../core/enumerate';
import { applyHardMode, generateLevel, generateQuestion } from '../core/generator';
import { chapterOf, effectiveLevel, endlessBand, starsFor, timedPool, unlockAfterWin } from '../core/progression';
import { defaultProgress, loadProgress, saveProgress } from '../core/storage';
import { onAvailabilityChange, speak, stopTTS, ttsAvailable } from '../audio/tts';
import { currentQuestion, type Mode, type Screen, type Session } from './session';
import { useCountdown } from './useCountdown';
import { useStageScale } from './scale';
import { Map } from './screens/Map';
import { Quiz } from './screens/Quiz';
import { CAMPAIGN_SUB, Result } from './screens/Result';
import { RotateOverlay } from './components/RotateOverlay';
import { SettingsModal } from './components/SettingsModal';

const TIMED_START_MS = 60_000;
const TIMED_MAX_MS = 90_000;
const TIMED_BONUS_MS = 8_000;

// 语音文案（简体、短句、5 岁儿童向）。题目/提示句由题库生成（q.ttsText / q.blocksHint）。
// right 须在答对 1.1s 推进窗口内念完（rate 0.9），保持极短。
const VOICE = {
  right: '答对啦！',
  wrong: '再试一次！',
  endlessIntro: '无尽夜航！看看你能连对多少题？',
  timedStart: '星光冲刺，开始！',
  unlockChapter: '解锁新章节！',
  record: '新纪录！',
  endlessResult: (n: number) => `本轮答对 ${n} 题！`,
  timedResult: (n: number) => `时间到！你答对了 ${n} 题！`,
} as const;

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

  // 🔊 全局灰态：无中文语音时置灰（voiceschanged 后由 tts 订阅刷新）。切屏时停读。
  const [ttsReady, setTtsReady] = useState(() => ttsAvailable());
  useEffect(() => onAvailabilityChange(() => setTtsReady(ttsAvailable())), []);
  useEffect(() => () => stopTTS(), []);

  // 反馈延迟推进的定时器；退出/卸载时清除，避免离开答题屏后仍触发。
  const timerRef = useRef<number | undefined>(undefined);
  // 供定时器/倒计时回调读取最新 session（避免闭包读到旧值）。
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
    speak(questions[0].ttsText, { interrupt: true }); // 进新题自动朗读
    setSession({ ...blankRun('campaign'), level, questions });
    setScreen('quiz');
  };

  // 模式流式出题：无尽档位随连对爬升；限时从已完成档均匀混抽。滚动去重（最近 5 题）。
  const nextModeQuestion = (mode: Mode, correctCount: number, recentKeys: string[]): Question => {
    if (mode === 'endless') {
      const band = endlessBand(correctCount, effectiveLevel(progress));
      return generateQuestion(applyIfHard(bandOf(band)), Math.random, recentKeys);
    }
    const pool = timedPool(progress);
    // 兜底：正常状态下 timedUnlocked 时题池必非空（锚点恒含最高得星档所在章）；
    // 万一异常数据导致为空，回落最温和的档 1，而非家长可能拉满的 unlocked。
    const band = pool.length ? pool[Math.floor(Math.random() * pool.length)] : 1;
    return generateQuestion(applyIfHard(bandOf(band)), Math.random, recentKeys);
  };

  const startEndless = () => {
    const current = nextModeQuestion('endless', 0, []);
    speak(VOICE.endlessIntro, { interrupt: true }); // 模式入口介绍（进入前一句）
    speak(current.ttsText);                           // 队列在介绍之后朗读首题
    setSession({ ...blankRun('endless'), current });
    setScreen('quiz');
  };

  const startTimed = () => {
    countdown.reset(TIMED_START_MS);
    const current = nextModeQuestion('timed', 0, []);
    speak(VOICE.timedStart, { interrupt: true }); // 单句开场，少吃倒计时
    speak(current.ttsText);                        // 首题
    setSession({ ...blankRun('timed'), current });
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
      const next = unlockAfterWin(progress, s.level!, stars);
      const chapterUp = chapterOf(next.unlocked) > chapterOf(progress.unlocked); // 完成 15/30 关跨章
      updateProgress(next);
      speak(CAMPAIGN_SUB[stars], { interrupt: true }); // 结算祝贺（按星级副文案）
      if (chapterUp) speak(VOICE.unlockChapter);        // 章节解锁祝贺
      setSession({ ...s, feedback: null, resultStars: stars });
      setScreen('result');
    } else {
      const next = s.questions![s.qIndex + 1];
      speak(next.ttsText, { interrupt: true }); // 进新题自动朗读
      setSession({ ...s, qIndex: s.qIndex + 1, feedback: null, excluded: [], lastWrong: undefined });
    }
  };
  const advanceModeCorrect = () => {
    const s = sessionRef.current;
    if (!s || s.mode === 'campaign') return;
    const correctCount = s.correctCount + 1;
    const streak = s.streak + 1;
    const recentKeys = [...s.recentKeys, itemKey(s.current!)].slice(-5);
    // 限时答对 +8s（上限 90s）。此刻反馈刚清除、时间条重新可见，宽度增大触发回弹动画。
    if (s.mode === 'timed') countdown.addTime(TIMED_BONUS_MS);
    const next = nextModeQuestion(s.mode, correctCount, recentKeys);
    speak(next.ttsText, { interrupt: true }); // 进新题自动朗读
    setSession({
      ...s,
      current: next,
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
      speak(VOICE.right, { interrupt: true }); // 答对反馈
      setSession({ ...s, feedback: 'right' });
      timerRef.current = window.setTimeout(
        s.mode === 'campaign' ? advanceCampaign : advanceModeCorrect,
        1100,
      );
    } else {
      speak(VOICE.wrong, { interrupt: true }); // 答错反馈
      setSession({
        ...s,
        feedback: 'wrong',
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
    speak(VOICE.endlessResult(s.correctCount), { interrupt: true }); // 无尽结算祝贺
    if (broke) speak(VOICE.record);
    setSession({ ...s, feedback: null, resultBroke: broke });
    setScreen('result');
  };

  // 限时时间到 → 冲刺结算。进结算瞬间持久化 bestCount。由 useCountdown 的 onExpire 触发。
  const finishTimed = () => {
    const s = sessionRef.current;
    if (!s || s.mode !== 'timed') return;
    clearTimer();
    const oldBest = progress.timed.bestCount;
    const broke = s.correctCount > oldBest;
    updateProgress({ ...progress, timed: { bestCount: Math.max(oldBest, s.correctCount) } });
    speak(VOICE.timedResult(s.correctCount), { interrupt: true }); // 冲刺结算祝贺
    if (broke) speak(VOICE.record);
    setSession({ ...s, feedback: null, resultBroke: broke });
    setScreen('result');
  };

  // 限时倒计时（spec §5，实现见 useCountdown）：仅 timed + quiz 时运转；
  // 到 0 时若反馈仍在展示（答对 1.1s / 答错 0.9s 窗口），canExpire 拦截，等反馈清掉再结算。
  const countdown = useCountdown(session?.mode === 'timed' && screen === 'quiz', {
    startMs: TIMED_START_MS,
    maxMs: TIMED_MAX_MS,
    onExpire: finishTimed,
    canExpire: () => sessionRef.current?.feedback == null,
  });

  // 顶栏 🔊 = 同句重播当前题；计数块提示行 = 念 blocksHint。均读 sessionRef 最新题。
  const replayTts = () => {
    const s = sessionRef.current;
    if (s) speak(currentQuestion(s).ttsText, { interrupt: true });
  };
  const hintTts = () => {
    const s = sessionRef.current;
    const hint = s && currentQuestion(s).blocksHint;
    if (hint) speak(hint, { interrupt: true });
  };
  // 结算屏 🔊：重播进结算时念的那句星级副文案。
  const replaySubTts = () => {
    const s = sessionRef.current;
    if (s?.mode === 'campaign') speak(CAMPAIGN_SUB[s.resultStars ?? starsFor(s.wrongTotal)], { interrupt: true });
  };

  const exitToMap = () => {
    clearTimer();
    stopTTS(); // 切屏停读
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
    clearTimer();
    stopTTS();
    updateProgress(defaultProgress());
    setSettingsOpen(false);
    setSession(null);
    setScreen('map');
  };
  // 解锁全部关卡（家长设置）：拉满 unlocked，不动星星；关面板回地图。
  const unlockAll = () => {
    updateProgress({ ...progress, unlocked: 60 });
    setSettingsOpen(false);
  };

  return (
    <div class="mn-viewport">
      <div class={ttsReady ? 'mn-stage' : 'mn-stage mn-tts-off'} style={{ transform: `scale(${scale})` }}>
        {screen === 'map' && (
          <Map
            progress={progress}
            onStartLevel={startLevel}
            onStartEndless={startEndless}
            onStartTimed={startTimed}
            onOpenSettings={openSettings}
            onWelcome={(line) => speak(line, { interrupt: true })}
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
            timeLeftMs={countdown.displayMs}
            timeMaxMs={TIMED_MAX_MS}
            onAnswer={answer}
            onExit={onQuizExit}
            onReplay={replayTts}
            onHint={hintTts}
          />
        )}
        {/* 结算屏对三种 mode 穷举，无静默空屏。 */}
        {screen === 'result' && session && (
          session.mode === 'campaign' ? (
            <Result
              variant="campaign"
              level={session.level!}
              stars={session.resultStars ?? starsFor(session.wrongTotal)}
              onReplaySub={replaySubTts}
              onBackToMap={exitToMap}
              onNextLevel={session.level! < 60 ? () => startLevel(session.level! + 1) : undefined}
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
            onUnlockAll={unlockAll}
            onClose={() => setSettingsOpen(false)}
          />
        )}
      </div>
      {portrait && <RotateOverlay />}
    </div>
  );
}
