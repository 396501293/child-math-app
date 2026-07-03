import { Mascot } from '../components/Mascot';

// 结算屏（README §3）。dumb 组件：所有数值由 App 计算后经 props 传入，本组件只渲染。
// 目前实现 campaign 变体；endless/timed 变体（不同标题/统计/按钮）于 Task 12 slot in——
// 届时可加 `variant` prop 分支标题与副文案，星级/按钮结构复用本文件。

interface ResultProps {
  level: number;
  stars: 1 | 2 | 3;
  onBackToMap: () => void;
  onNextLevel?: () => void; // level 45 无下一关时为 undefined
}

// 副文案常量表（按星级）。
const CAMPAIGN_SUB: Record<1 | 2 | 3, string> = {
  3: '太厉害了，一次全对！',
  2: '很棒，继续加油！',
  1: '完成啦，再练一遍更棒！',
};

// 下一关按钮文案：跨章（第 15/30 关）显示进入下一章，其余为「下一关」。行为一致。
function nextLabel(level: number): string {
  if (level === 15) return '进入第二章 ▶';
  if (level === 30) return '进入第三章 ▶';
  return '下一关 ▶';
}

export function Result({ level, stars, onBackToMap, onNextLevel }: ResultProps) {
  const starStr = '★★★'.slice(0, stars) + '☆☆☆'.slice(0, 3 - stars);
  const pose = stars === 3 ? 'cheer' : 'happy';

  return (
    <div class="mn-result">
      <div class="mn-result-mascot">
        <Mascot pose={pose} scale={1.15} />
      </div>
      <div class="mn-result-title">第 {level} 关完成！</div>
      <div class="mn-result-stars">{starStr}</div>
      <div class="mn-result-sub">
        {CAMPAIGN_SUB[stars]}
        {/* 🔊 Task 13 接 TTS，此处仅占位不发声 */}
        <span class="mn-result-sub-tts" aria-hidden="true">🔊</span>
      </div>
      <div class="mn-result-actions">
        <button class="mn-result-btn mn-result-btn--ghost" onClick={onBackToMap}>回地图</button>
        {onNextLevel && (
          <button class="mn-result-btn mn-result-btn--next" onClick={onNextLevel}>
            {nextLabel(level)}
          </button>
        )}
      </div>
    </div>
  );
}
