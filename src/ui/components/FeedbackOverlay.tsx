// 答对/答错的全屏反馈遮罩 + 居中卡片（pop 入场）。遮罩同时挡住选项点击。
export function FeedbackOverlay({ variant }: { variant: 'right' | 'wrong' }) {
  const right = variant === 'right';
  return (
    <div class="mn-feedback-mask">
      <div class={'mn-feedback-card ' + (right ? 'mn-feedback-card--right' : 'mn-feedback-card--wrong')}>
        {right ? '太棒了！ ★' : '再试一次！'}
      </div>
    </div>
  );
}
