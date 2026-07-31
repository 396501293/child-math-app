import { useEffect, useRef, useState } from 'preact/hooks';
import type { BandConfig, Progress, Question } from '../core/types';
import { bandOf } from '../core/bands';
import { itemKey } from '../core/enumerate';
import { applyHardMode, generateLevel, generateQuestion } from '../core/generator';
import { chapterOf, effectiveLevel, endlessBand, starsFor, timedPool, unlockAfterWin } from '../core/progression';
import { defaultProgress, loadProgress, saveProgress } from '../core/storage';
import { koujue, TimesTableSession } from '../core/timesTable';
import { balance as oreBalance, craft, income, lightStar, placeBlock, recordAnswer, removeBlock, setEquipped, trade } from '../core/rewards';
import { CATALOG_BY_ID, SKY_PATTERNS } from '../core/rewardsCatalog';
import { SteveScreen } from './screens/SteveScreen';
import { onAvailabilityChange, speak, stopTTS, ttsAvailable } from '../audio/tts';
import { currentQuestion, type Mode, type Screen, type Session } from './session';
import { useCountdown } from './useCountdown';
import { useStageScale } from './scale';
import { Map } from './screens/Map';
import { Quiz } from './screens/Quiz';
import { StarChart } from './screens/StarChart';
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
  ttResult: (n: number) => `本轮答对 ${n} 题！`,
  ttResultLit: (n: number, lit: number) => `本轮答对 ${n} 题，新点亮 ${lit} 句口诀！`,
  ttComplete: '星图点亮！九九口诀你全会了！',
  streakN: (n: number) => `连对 ${n} 题！`,
  steveWelcome: '这是史蒂夫的家园。用你的煤搭点什么吧，怎么搭都行。不想要了就收回来，煤会还给你。',
  crafted: (name: string) => `${name}做好了！`,
  starLit: '点亮一颗星！',
  constellation: (name: string) => `${name}连起来了！`,
} as const;

// 九九星图结算祝贺语（集齐 > 有新点亮 > 普通完成）。结算与重播读同一句。
const ttResultLine = (correct: number, newLit: number, lit: number): string =>
  lit >= 36 ? VOICE.ttComplete : newLit > 0 ? VOICE.ttResultLit(correct, newLit) : VOICE.ttResult(correct);

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
  // 同理的 progress ref：养成埋点会在答题中途更新 progress，
  // 结算 setTimeout 回调若读闭包 progress 会丢掉最后一题的埋点。
  const progressRef = useRef<Progress>(progress);
  progressRef.current = progress;

  // 本局材料入账（M1：只在结算屏出现一次）：会话开始时快照收入，
  // 结算时 diff。快照在各 start* 里打，读 progressRef 保证新鲜。
  const incomeStartRef = useRef(income(defaultProgress()));
  const snapIncome = () => { incomeStartRef.current = income(progressRef.current); };
  const gainsSince = (p: Progress) => {
    const now = income(p);
    const base = incomeStartRef.current;
    const out: Partial<typeof now> = {};
    for (const k of ['coal', 'iron', 'gold', 'diamond', 'emerald'] as const)
      if (now[k] > base[k]) out[k] = now[k] - base[k];
    return Object.keys(out).length ? out : undefined;
  };

  // 九九星图会话对象：有状态、活在 Preact state 之外（ref-truth），
  // Session 只镜像顶栏/揭示/结算所需最小字段（同 useCountdown 的 ref+display 范式）。
  const ttSessionRef = useRef<TimesTableSession | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== undefined) {
      window.clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  };
  useEffect(() => () => clearTimer(), []);

  const updateProgress = (p: Progress) => {
    // 同步刷 ref：setProgressState 是异步的，同一事件回调里
    // 紧接着读 progressRef 必须拿到新值（结算入账 diff 依赖这一点——
    // endless/星图结算更新的 bestStreak/litBest 会立刻影响绿宝石收入）。
    progressRef.current = p;
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
    snapIncome();
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
    snapIncome();
    const current = nextModeQuestion('endless', 0, []);
    speak(VOICE.endlessIntro, { interrupt: true }); // 模式入口介绍（进入前一句）
    speak(current.ttsText);                           // 队列在介绍之后朗读首题
    setSession({ ...blankRun('endless'), current, streak: progress.endless.streak });
    setScreen('quiz');
  };

  const startTimed = () => {
    snapIncome();
    countdown.reset(TIMED_START_MS);
    const current = nextModeQuestion('timed', 0, []);
    speak(VOICE.timedStart, { interrupt: true }); // 单句开场，少吃倒计时
    speak(current.ttsText);                        // 首题
    setSession({ ...blankRun('timed'), current });
    setScreen('quiz');
  };

  // ── 九九星图（timestable）会话流 ──────────────────────────────────────────────
  // 会话对象存 ttSessionRef（ref-truth）；下面把其当前态镜像进 Session 供 Quiz 渲染。
  const mirrorNextTt = (s: Session, tt: TimesTableSession): Session => ({
    ...s,
    current: tt.currentQuestion(),
    qIndex: tt.index,
    ttTotal: tt.length,
    ttLit: tt.litCount(),
    feedback: null,
    excluded: [],
    lastWrong: undefined,
    ttReveal: null,
  });

  // 结算：commit() 恰一次 → 落盘；算「新点亮」格数（s 由非 3 升到 3）；按结果祝贺。
  // 注意：「答题中途退出不会丢在途作答」依赖 FeedbackOverlay/揭示卡遮罩（z-index:10, 无 onClick）
  // 在 1.1s 反馈窗内盖住返回键——若改动遮罩的可点性/层级，需同步改这里的结算时序。
  const finishTimesTable = (correctCount: number) => {
    const s = sessionRef.current;
    const tt = ttSessionRef.current;
    if (!s || s.mode !== 'timestable' || !tt) return;
    clearTimer();
    const before = progressRef.current.timesTable.facts;
    const committed = tt.commit();
    const after = committed.timesTable.facts;
    let newLit = 0;
    for (const [k, st] of Object.entries(after))
      if (st.s === 3 && (before[k]?.s ?? 0) !== 3) newLit++;
    const lit = Object.values(after).filter((f) => f.s === 3).length;
    // 只取 commit 的 timesTable 切片：committed 基于会话构造时的快照，
    // 整体落盘会回滚会话期间的养成埋点（rewards/weekly 在每题作答时都在更新）。
    updateProgress({ ...progressRef.current, timesTable: committed.timesTable });
    speak(ttResultLine(correctCount, newLit, lit), { interrupt: true }); // 结算祝贺
    setSession({
      ...s,
      feedback: null,
      ttReveal: null,
      resultTimes: { correct: correctCount, newLit, lit },
      resultGains: gainsSince(progressRef.current),
    });
    setScreen('result');
  };

  // 答对 1.1s 后推进：记账（内部 idx++、rebuild）→ 结算 or 下一题。
  const advanceTimesTable = () => {
    const s = sessionRef.current;
    const tt = ttSessionRef.current;
    if (!s || s.mode !== 'timestable' || !tt) return;
    tt.answer(true);
    const correctCount = s.correctCount + 1;
    if (tt.isDone()) { finishTimesTable(correctCount); return; }
    speak(tt.currentQuestion().ttsText, { interrupt: true }); // 进新题自动朗读
    setSession({ ...mirrorNextTt(s, tt), correctCount });
  };

  // 揭示阶段点击继续：记账答错（内部已排「再见面」、idx++）→ 结算 or 下一题。
  const continueFromReveal = () => {
    const s = sessionRef.current;
    const tt = ttSessionRef.current;
    if (!s || s.mode !== 'timestable' || !tt || !s.ttReveal) return;
    clearTimer();
    tt.answer(false);
    if (tt.isDone()) { finishTimesTable(s.correctCount); return; }
    speak(tt.currentQuestion().ttsText, { interrupt: true }); // 进新题自动朗读
    setSession(mirrorNextTt(s, tt));
  };

  // 批改（星图）：答对念口诀（庆祝，替代 VOICE.right）+ 'right' 遮罩，1.1s 后推进；
  // 答错念口诀 + 进入揭示阶段（口诀+阵列常显），不原地重试——等点击继续（spec 再见面机制）。
  const answerTimesTable = (option: number) => {
    const s = sessionRef.current;
    const tt = ttSessionRef.current;
    if (!s || !tt || s.feedback !== null || s.ttReveal) return;
    const q = tt.currentQuestion();
    const fact = tt.currentFact();
    clearTimer();
    updateProgress(
      recordAnswer(
        progressRef.current,
        { practice: true, firstTry: s.excluded.length === 0, correct: option === q.answer },
        Date.now(),
      ),
    );
    speak(koujue(fact.a, fact.b), { interrupt: true }); // 答对=庆祝口诀 / 答错=揭示口诀（同句）
    if (option === q.answer) {
      setSession({ ...s, feedback: 'right' });
      timerRef.current = window.setTimeout(advanceTimesTable, 1100);
    } else {
      setSession({
        ...s,
        wrongTotal: s.wrongTotal + 1,
        excluded: [...s.excluded, option],
        lastWrong: option,
        ttReveal: { a: fact.a, b: fact.b, koujue: koujue(fact.a, fact.b) },
      });
    }
  };

  const startTimesTable = () => {
    snapIncome();
    const tt = new TimesTableSession(progress, Math.random);
    ttSessionRef.current = tt;
    if (tt.isDone()) { ttSessionRef.current = null; setScreen('starchart'); return; } // 活跃池为空兜底（CTA 已禁用，理论不触发）
    const q = tt.currentQuestion();
    speak(q.ttsText, { interrupt: true }); // 进新题自动朗读
    setSession({
      ...blankRun('timestable'),
      current: q,
      qIndex: tt.index,
      ttTotal: tt.length,
      ttLit: tt.litCount(),
      ttReveal: null,
    });
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
      const next = unlockAfterWin(progressRef.current, s.level!, stars);
      const chapterUp = chapterOf(next.unlocked) > chapterOf(progressRef.current.unlocked); // 完成 15/30 关跨章
      updateProgress(next);
      speak(CAMPAIGN_SUB[stars], { interrupt: true }); // 结算祝贺（按星级副文案）
      if (chapterUp) speak(VOICE.unlockChapter);        // 章节解锁祝贺
      setSession({ ...s, feedback: null, resultStars: stars, resultGains: gainsSince(next) });
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
    const streak = s.streak; // answer() 已 +1（分级反馈需要提前知道连对数），这里只读
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
    if (!s) return;
    if (s.mode === 'timestable') { answerTimesTable(option); return; } // 星图独立批改（口诀庆祝/答错揭示）
    if (s.feedback !== null) return; // 反馈展示期间忽略（含答对 1.1s 窗口，防止二次触发）
    const q = currentQuestion(s);
    clearTimer();
    // 养成埋点（评审 P 定义 = 练习模式首答即对；weekly 计全模式首答题量）
    let nextP = recordAnswer(
      progressRef.current,
      { practice: s.mode !== 'campaign', firstTry: s.excluded.length === 0, correct: option === q.answer },
      Date.now(),
    );
    // 无尽连对活持久化：每题作答即落盘（搭埋点写盘的顺风车），
    // 中途强退也不丢；答错清零同样立即落盘。
    if (s.mode === 'endless') {
      nextP = {
        ...nextP,
        endless: { ...nextP.endless, streak: option === q.answer ? s.streak + 1 : 0 },
      };
    }
    updateProgress(nextP);
    if (option === q.answer) {
      // 反馈分级：连续答对降为轻量（0.45s 快进、无语音——下一题朗读即确认），
      // 每 5 连对回到完整庆祝。首题/答错后重新开始给完整反馈（确认机制在）。
      // 表扬每题都给会通胀贬值，且 1.1s×N 的强制等待正是「被打断」感的来源。
      const streakNext = s.streak + 1;
      const milestone = streakNext >= 5 && streakNext % 5 === 0;
      const lite = streakNext >= 2 && !milestone;
      if (milestone) speak(VOICE.streakN(streakNext), { interrupt: true });
      else if (!lite) speak(VOICE.right, { interrupt: true });
      setSession({
        ...s,
        feedback: lite ? 'right-lite' : 'right',
        streak: streakNext,
        runBestStreak: Math.max(s.runBestStreak, streakNext),
      });
      timerRef.current = window.setTimeout(
        s.mode === 'campaign' ? advanceCampaign : advanceModeCorrect,
        lite ? 450 : milestone ? 1400 : 1100, // 里程碑句更长，窗口给足
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
    const oldBest = progressRef.current.endless.bestStreak;
    const broke = s.runBestStreak > oldBest;
    updateProgress({
      ...progressRef.current,
      endless: {
        bestStreak: Math.max(oldBest, s.runBestStreak),
        totalAnswered: progressRef.current.endless.totalAnswered + s.correctCount,
        streak: s.streak, // 退出保持连对（下次进无尽从这里继续）
      },
    });
    speak(VOICE.endlessResult(s.correctCount), { interrupt: true }); // 无尽结算祝贺
    if (broke) speak(VOICE.record);
    setSession({ ...s, feedback: null, resultBroke: broke, resultGains: gainsSince(progressRef.current) });
    setScreen('result');
  };

  // 限时时间到 → 冲刺结算。进结算瞬间持久化 bestCount。由 useCountdown 的 onExpire 触发。
  const finishTimed = () => {
    const s = sessionRef.current;
    if (!s || s.mode !== 'timed') return;
    clearTimer();
    const oldBest = progressRef.current.timed.bestCount;
    const broke = s.correctCount > oldBest;
    updateProgress({ ...progressRef.current, timed: { bestCount: Math.max(oldBest, s.correctCount) } });
    speak(VOICE.timedResult(s.correctCount), { interrupt: true }); // 冲刺结算祝贺
    if (broke) speak(VOICE.record);
    setSession({ ...s, feedback: null, resultBroke: broke, resultGains: gainsSince(progressRef.current) });
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
  // 结算屏 🔊：重播进结算时念的那句副文案（campaign 星级副文案 / 星图祝贺语）。
  const replaySubTts = () => {
    const s = sessionRef.current;
    if (s?.mode === 'campaign') speak(CAMPAIGN_SUB[s.resultStars ?? starsFor(s.wrongTotal)], { interrupt: true });
    else if (s?.mode === 'timestable' && s.resultTimes) {
      const rt = s.resultTimes;
      speak(ttResultLine(rt.correct, rt.newLit, rt.lit), { interrupt: true });
    }
  };

  const exitToMap = () => {
    clearTimer();
    stopTTS(); // 切屏停读
    setSession(null);
    ttSessionRef.current = null;
    setScreen('map');
  };

  const openStarChart = () => {
    stopTTS();
    setSession(null);
    ttSessionRef.current = null;
    setScreen('starchart');
  };

  // 星图结算「回星图」：进度已 commit 落盘，只需清会话回模式主页。
  const backToStarChart = () => {
    clearTimer();
    stopTTS();
    setSession(null);
    ttSessionRef.current = null;
    setScreen('starchart');
  };

  // 答题屏返回键：无尽 = 结束本轮进结算；星图 = 提前结算落盘（spec §1 中途返回提前结算）；
  // campaign / timed = 放弃本轮直接回地图（不结算不记录）。
  const onQuizExit = () => {
    const s = sessionRef.current;
    if (s?.mode === 'endless') finishEndless();
    else if (s?.mode === 'timestable') finishTimesTable(s.correctCount);
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
    ttSessionRef.current = null;
    setScreen('map');
  };
  // ── 史蒂夫养成（呈现纪律 M1/M2/M7：无角标无催促；措辞「做」；结算处才入账）──
  const openSteve = () => {
    setScreen('steve');
    speak(VOICE.steveWelcome, { interrupt: true });
  };
  const doCraft = (id: string) => {
    const next = craft(progressRef.current, id);
    if (next === progressRef.current) return;
    updateProgress(next);
    speak(VOICE.crafted(CATALOG_BY_ID[id]?.name ?? ''), { interrupt: true });
  };
  const doToggleWear = (slot: 'boots' | 'helm' | 'legs' | 'chest', id: string) => {
    const cur = progressRef.current.rewards.equipped[slot];
    updateProgress(setEquipped(progressRef.current, { [slot]: cur === id ? null : id }));
  };
  const doTrade = (kind: Parameters<typeof trade>[1]) => {
    updateProgress(trade(progressRef.current, kind));
  };
  // 建造（评审 2026-07-31）：放置静默；收回前 3 次念「煤收回来了」建立可逆心智，
  // 之后静默（逐块播报会把孩子逼疯）。会话内计数即可，不持久化。
  const reclaimCountRef = useRef(0);
  const doPlaceBlock = (index: number, blockId: string) => {
    updateProgress(placeBlock(progressRef.current, index, blockId));
  };
  const doRemoveBlock = (index: number) => {
    const next = removeBlock(progressRef.current, index);
    if (next === progressRef.current) return;
    updateProgress(next);
    if (reclaimCountRef.current < 3) {
      reclaimCountRef.current += 1;
      speak('煤收回来了。', { interrupt: true });
    }
  };

  const doLightStar = () => {
    const next = lightStar(progressRef.current);
    if (next === progressRef.current) return;
    updateProgress(next);
    // 星座集齐 = 连线亮起 + 一句语音，无其他奖励（评审表 C）
    let acc = 0;
    for (const pat of SKY_PATTERNS) {
      acc += pat.stars;
      if (next.rewards.skyStars === acc) { speak(VOICE.constellation(pat.name), { interrupt: true }); return; }
    }
    speak(VOICE.starLit, { interrupt: true });
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
            onOpenStarChart={openStarChart}
            onOpenSettings={openSettings}
            onOpenSteve={openSteve}
            onWelcome={(line) => speak(line, { interrupt: true })}
          />
        )}
        {screen === 'steve' && (
          <SteveScreen
            progress={progress}
            onBack={exitToMap}
            onCraft={doCraft}
            onToggleWear={doToggleWear}
            onTrade={doTrade}
            onLightStar={doLightStar}
            onPlaceBlock={doPlaceBlock}
            onRemoveBlock={doRemoveBlock}
            onSpeak={(line) => speak(line, { interrupt: true })}
          />
        )}
        {screen === 'starchart' && (
          <StarChart
            progress={progress}
            onStartSession={startTimesTable}
            onBack={exitToMap}
            onSpeak={(line) => speak(line, { interrupt: true })}
          />
        )}
        {screen === 'quiz' && session && (
          <Quiz
            session={session}
            showBlocks={
              session.mode === 'timestable'
                ? true // 星图：阵列教具恒显（spec §5，missing 变体自身不带 blocksPlan）
                : session.mode === 'timed'
                ? progress.settings.showBlocksTimed
                : progress.settings.showBlocks
            }
            timeLeftMs={countdown.displayMs}
            timeMaxMs={TIMED_MAX_MS}
            onAnswer={answer}
            onExit={onQuizExit}
            onReplay={replayTts}
            onHint={hintTts}
            onContinueReveal={continueFromReveal}
          />
        )}
        {/* 结算屏对三种 mode 穷举，无静默空屏。 */}
        {screen === 'result' && session && (
          session.mode === 'campaign' ? (
            <Result
              equipped={progress.rewards.equipped}
              gains={progress.settings.steveRaise ? session.resultGains : undefined}
              variant="campaign"
              level={session.level!}
              stars={session.resultStars ?? starsFor(session.wrongTotal)}
              onReplaySub={replaySubTts}
              onBackToMap={exitToMap}
              onNextLevel={session.level! < 60 ? () => startLevel(session.level! + 1) : undefined}
            />
          ) : session.mode === 'endless' ? (
            <Result
              equipped={progress.rewards.equipped}
              gains={progress.settings.steveRaise ? session.resultGains : undefined}
              variant="endless"
              answered={session.correctCount}
              runBestStreak={session.runBestStreak}
              historyBestStreak={progress.endless.bestStreak}
              broke={!!session.resultBroke}
              onBackToMap={exitToMap}
            />
          ) : session.mode === 'timestable' ? (
            <Result
              equipped={progress.rewards.equipped}
              gains={progress.settings.steveRaise ? session.resultGains : undefined}
              variant="timestable"
              answered={session.resultTimes?.correct ?? session.correctCount}
              newLit={session.resultTimes?.newLit ?? 0}
              lit={session.resultTimes?.lit ?? 0}
              onBackToStarChart={backToStarChart}
              onBackToMap={exitToMap}
              onReplaySub={replaySubTts}
            />
          ) : (
            <Result
              equipped={progress.rewards.equipped}
              gains={progress.settings.steveRaise ? session.resultGains : undefined}
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
            weekly={progress.weekly}
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
