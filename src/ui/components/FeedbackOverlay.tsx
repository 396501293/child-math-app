// 答对/答错的全屏反馈遮罩 + 居中卡片（pop 入场）。遮罩同时挡住选项点击。
// right-lite：连续答对的轻量档——透明拦截层，无卡片无文字。
// ⚠️ 即便无视觉也必须渲染遮罩：结算时序依赖反馈期挡住返回键
//（见 finishTimesTable 注释），去掉遮罩会让退出时点数不一致。
export function FeedbackOverlay({ variant }: { variant: 'right' | 'right-lite' | 'wrong' }) {
  if (variant === 'right-lite') return <div class="mn-feedback-mask mn-feedback-mask--lite" />;
  const right = variant === 'right';
  return (
    <div class="mn-feedback-mask">
      <div class={'mn-feedback-card ' + (right ? 'mn-feedback-card--right' : 'mn-feedback-card--wrong')}>
        {right ? '太棒了！ ★' : '再试一次！'}
      </div>
    </div>
  );
}
