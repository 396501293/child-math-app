// 限时模式顶栏变体（题库设计 §2.2 / §7-4）：琥珀时间条。
// dumb 组件：timeLeftMs 由 App 每帧（节流后）传入；宽度 = timeLeft / maxMs。
// 答对 +8s 时宽度增大，靠 CSS transition 形成回弹动画；剩余 ≤10s 变珊瑚红（无音效）。
export function TimerBar({ timeLeftMs, maxMs = 90_000 }: { timeLeftMs: number; maxMs?: number }) {
  const frac = Math.max(0, Math.min(1, timeLeftMs / maxMs));
  const low = timeLeftMs <= 10_000;
  const secs = Math.max(0, Math.ceil(timeLeftMs / 1000));
  return (
    <div class="mn-timerbar">
      <div class="mn-timerbar-track">
        <div class={'mn-timerbar-fill' + (low ? ' is-low' : '')} style={{ width: `${frac * 100}%` }} />
      </div>
      <div class={'mn-timerbar-secs' + (low ? ' is-low' : '')}>{secs}s</div>
    </div>
  );
}
