import type { Session } from '../App';
import { QuestionRow } from '../components/QuestionRow';
import { Blocks } from '../components/Blocks';
import { Options } from '../components/Options';
import { FeedbackOverlay } from '../components/FeedbackOverlay';

interface QuizProps {
  session: Session;
  showBlocks: boolean; // 主线读 settings.showBlocks；限时读 showBlocksTimed
  onAnswer: (value: number) => void;
  onExit: () => void; // 关卡中途退出 = 放弃本关，无结算
  onReplay: () => void; // 重播读题（Task 13 接 TTS）
}

// 答题屏。dumb 组件：题目 / 教具 / 选项 / 反馈全部由 session 与回调驱动。
// 顶栏主线变体：返回 + 进度条 + n/N + 重播；模式变体（无尽/限时）暂只留返回 + 重播（Task 12 补 streak/timer）。
export function Quiz({ session, showBlocks, onAnswer, onExit, onReplay }: QuizProps) {
  const campaign = session.mode === 'campaign';
  const q = campaign ? session.questions![session.qIndex] : session.current!;
  const total = campaign ? session.questions!.length : 0;
  const pct = campaign && total > 0 ? Math.round((session.qIndex / total) * 100) : 0;
  // 题面变化即重挂载 Blocks，重置教具交互态。
  const blockKey = `${session.qIndex}:${q.kind}:${q.operands.join('.')}:${q.ops.join('')}`;

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <button class="mn-quiz-back" onClick={onExit} aria-label="返回地图">←</button>
      {campaign && (
        <>
          <div class="mn-quiz-progress">
            <div class="mn-quiz-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div class="mn-quiz-count">{session.qIndex + 1}/{total}</div>
        </>
      )}
      <button class="mn-quiz-replay" onClick={onReplay} aria-label="重播读题">🔊</button>

      <QuestionRow q={q} />

      {q.blocksPlan && (
        <Blocks key={blockKey} plan={q.blocksPlan} hint={q.blocksHint ?? ''} show={showBlocks} onHintClick={onReplay} />
      )}

      <Options question={q} excluded={session.excluded} feedback={session.feedback} onPick={onAnswer} />

      {session.feedback && <FeedbackOverlay variant={session.feedback} />}
    </div>
  );
}
