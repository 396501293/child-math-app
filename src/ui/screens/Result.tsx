import { Mascot } from '../components/Mascot';

// 结算屏（README §3 + 题库设计 §7-5）。dumb 组件：所有数值由 App 计算后经 props 传入。
// 三种变体：campaign（星级）/ endless（本轮答对 + 连对纪录）/ timed（时间到 + 个人最佳）。
type ResultProps =
  | { variant: 'campaign'; level: number; stars: 1 | 2 | 3; onBackToMap: () => void; onNextLevel?: () => void }
  | { variant: 'endless'; answered: number; runBestStreak: number; historyBestStreak: number; broke: boolean; onBackToMap: () => void }
  | { variant: 'timed'; answered: number; bestCount: number; broke: boolean; onBackToMap: () => void };

// campaign 副文案常量表（按星级）。App 结算时读同一份文案朗读（Task 13）。
export const CAMPAIGN_SUB: Record<1 | 2 | 3, string> = {
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

export function Result(props: ResultProps) {
  if (props.variant === 'campaign') {
    const { level, stars, onBackToMap, onNextLevel } = props;
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

  if (props.variant === 'endless') {
    const { answered, runBestStreak, historyBestStreak, broke, onBackToMap } = props;
    return (
      <div class="mn-result">
        <div class="mn-result-mascot">
          <Mascot pose={broke ? 'cheer' : 'happy'} scale={1.15} />
        </div>
        <div class="mn-result-title">本轮答对 {answered} 题！</div>
        {broke && <div class="mn-result-record">🎉 新纪录！</div>}
        <div class="mn-result-stats">
          <div class="mn-result-stat">
            <span class="mn-result-stat-num">🔥 {runBestStreak}</span>
            <span class="mn-result-stat-label">本轮最高连对</span>
          </div>
          <div class="mn-result-stat">
            <span class="mn-result-stat-num">{historyBestStreak}</span>
            <span class="mn-result-stat-label">历史最高连对</span>
          </div>
        </div>
        <div class="mn-result-actions">
          <button class="mn-result-btn mn-result-btn--next" onClick={onBackToMap}>回地图</button>
        </div>
      </div>
    );
  }

  // props.variant === 'timed'
  const { answered, bestCount, broke, onBackToMap } = props;
  return (
    <div class="mn-result">
      <div class="mn-result-mascot">
        <Mascot pose={broke ? 'cheer' : 'happy'} scale={1.15} />
      </div>
      <div class="mn-result-title">时间到！你答对了 {answered} 题！</div>
      {broke && <div class="mn-result-record">🎉 新纪录！</div>}
      <div class="mn-result-stats">
        <div class="mn-result-stat">
          <span class="mn-result-stat-num">{bestCount}</span>
          <span class="mn-result-stat-label">个人最佳</span>
        </div>
      </div>
      <div class="mn-result-actions">
        <button class="mn-result-btn mn-result-btn--next" onClick={onBackToMap}>回地图</button>
      </div>
    </div>
  );
}
