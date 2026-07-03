import { currentQuestion, type Session } from '../App';
import { QuestionRow } from '../components/QuestionRow';
import { Blocks } from '../components/Blocks';
import { Options } from '../components/Options';
import { FeedbackOverlay } from '../components/FeedbackOverlay';
import { StreakBar } from '../components/StreakBar';
import { TimerBar } from '../components/TimerBar';

interface QuizProps {
  session: Session;
  showBlocks: boolean; // 主线/无尽读 settings.showBlocks；限时读 showBlocksTimed
  timeLeftMs: number; // 限时模式当前剩余时间（App 每帧节流传入）
  timeMaxMs: number; // 时间条满值（90s）
  onAnswer: (value: number) => void;
  onExit: () => void; // campaign/timed 中途退出=放弃本轮；endless=结束本轮进结算
  onReplay: () => void; // 重播读题（Task 13 接 TTS）
}

// 答题屏。dumb 组件：题目 / 教具 / 选项 / 反馈全部由 session 与回调驱动。
// 顶栏三变体：campaign=进度条+n/N；endless=StreakBar（🔥连对+航行小船）；timed=TimerBar。
export function Quiz({ session, showBlocks, timeLeftMs, timeMaxMs, onAnswer, onExit, onReplay }: QuizProps) {
  const campaign = session.mode === 'campaign';
  const q = currentQuestion(session);
  const total = campaign ? session.questions!.length : 0;
  const pct = campaign && total > 0 ? Math.round((session.qIndex / total) * 100) : 0;
  // 题面变化即重挂载 Blocks，重置教具交互态。
  const blockKey = `${session.qIndex}:${q.kind}:${q.operands.join('.')}:${q.ops.join('')}`;
  const exitLabel = session.mode === 'endless' ? '结束本轮' : '返回地图';

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
      <button class="mn-quiz-replay" onClick={onReplay} aria-label="重播读题">🔊</button>

      <QuestionRow q={q} />

      {q.blocksPlan && (
        <Blocks key={blockKey} plan={q.blocksPlan} hint={q.blocksHint ?? ''} show={showBlocks} onHintClick={onReplay} />
      )}

      <Options
        question={q}
        excluded={session.excluded}
        lastWrong={session.lastWrong}
        feedback={session.feedback}
        onPick={onAnswer}
      />

      {session.feedback && <FeedbackOverlay variant={session.feedback} />}
    </div>
  );
}
