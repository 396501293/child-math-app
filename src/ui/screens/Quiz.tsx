import { currentQuestion, type Session } from '../session';
import { QuestionRow } from '../components/QuestionRow';
import { Blocks } from '../components/Blocks';
import { Options } from '../components/Options';
import { FeedbackOverlay } from '../components/FeedbackOverlay';
import { StreakBar } from '../components/StreakBar';
import { TimerBar } from '../components/TimerBar';
import { ArrayGrid } from '../components/ArrayGrid';

interface QuizProps {
  session: Session;
  showBlocks: boolean; // 主线/无尽读 settings.showBlocks；限时读 showBlocksTimed；星图恒显阵列
  timeLeftMs: number; // 限时模式当前剩余时间（App 每帧节流传入）
  timeMaxMs: number; // 时间条满值（90s）
  onAnswer: (value: number) => void;
  onExit: () => void; // campaign/timed=放弃本轮；endless=结束本轮进结算；timestable=提前结算
  onReplay: () => void; // 顶栏 🔊 重播读题（App speak(q.ttsText)）
  onHint: () => void; // 计数块提示行点击（App speak(q.blocksHint)）
  onContinueReveal: () => void; // 星图答错揭示阶段点击继续（App 推进到下一题）
}

// 答题屏。dumb 组件：题目 / 教具 / 选项 / 反馈全部由 session 与回调驱动。
// 顶栏四变体：campaign=进度条+n/N；endless=StreakBar；timed=TimerBar；timestable=n/总 + 已点亮 X/36。
export function Quiz({ session, showBlocks, timeLeftMs, timeMaxMs, onAnswer, onExit, onReplay, onHint, onContinueReveal }: QuizProps) {
  const campaign = session.mode === 'campaign';
  const q = currentQuestion(session);
  const total = campaign ? session.questions!.length : 0;
  const pct = campaign && total > 0 ? Math.round((session.qIndex / total) * 100) : 0;
  // 题面变化即重挂载 Blocks，重置教具交互态。
  const blockKey = `${session.qIndex}:${q.kind}:${q.operands.join('.')}:${q.ops.join('')}`;
  const exitLabel = session.mode === 'endless' || session.mode === 'timestable' ? '结束本轮' : '返回地图';
  const reveal = session.ttReveal ?? null;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <button class="mn-quiz-back" onClick={onExit} aria-label={exitLabel}>←</button>
      {campaign && (
        <>
          <div class="mn-quiz-progress">
            <div class="mn-quiz-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div class="mn-quiz-count">{session.qIndex + 1}/{total}</div>
        </>
      )}
      {session.mode === 'endless' && <StreakBar streak={session.streak} voyage={session.correctCount} />}
      {session.mode === 'timed' && <TimerBar timeLeftMs={timeLeftMs} maxMs={timeMaxMs} />}
      {session.mode === 'timestable' && (
        <div class="mn-tt-topbar">
          <span class="mn-tt-pill">第 {session.qIndex + 1} 题 / 共 {session.ttTotal ?? 0}</span>
          <span class="mn-tt-pill mn-tt-pill--lit">✨ 已点亮 {session.ttLit ?? 0}/36</span>
        </div>
      )}
      <button class="mn-quiz-replay" onClick={onReplay} aria-label="重播读题">🔊</button>

      <QuestionRow q={q} />

      {q.blocksPlan && (
        <Blocks key={blockKey} plan={q.blocksPlan} hint={q.blocksHint ?? ''} show={showBlocks} onHintClick={onHint} />
      )}

      <Options
        question={q}
        excluded={session.excluded}
        lastWrong={session.lastWrong}
        feedback={session.feedback}
        onPick={onAnswer}
      />

      {session.feedback && <FeedbackOverlay variant={session.feedback} />}

      {/* 星图答错揭示（spec 附录裁决 #3 补充）：口诀 + 阵列 + 念口诀；点一下继续到下一题。
          全屏遮罩天然挡住选项点击（选项在其下方，不可点）。 */}
      {reveal && (
        <div class="mn-tt-reveal-mask" onClick={onContinueReveal}>
          <div class="mn-tt-reveal-card">
            <div class="mn-tt-reveal-koujue">{reveal.koujue}</div>
            <div class="mn-tt-reveal-eq">{reveal.a} × {reveal.b} = {reveal.a * reveal.b}</div>
            <ArrayGrid rows={reveal.a} cols={reveal.b} cell={28} gap={6} />
            <div class="mn-tt-reveal-hint">点一下继续 ▶</div>
          </div>
        </div>
      )}
    </div>
  );
}
