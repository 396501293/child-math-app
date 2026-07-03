// 无尽模式顶栏变体（题库设计 §2.1 / §7-3）：连对 🔥×N + 航行距离小船。
// dumb 组件：streak（当前连对）与 voyage（本轮答对数）由 App 传入。
// 小船沿虚线前进，每答对一格，20 格循环（frac 用 %20 归一，到 20 回到起点）。
export function StreakBar({ streak, voyage }: { streak: number; voyage: number }) {
  const frac = (voyage % 20) / 19; // 0..1 沿虚线；每 20 题一个循环
  return (
    <div class="mn-streakbar">
      {/* streak 为 0 时弱化（is-dim）—— 尚未起连对不喧宾夺主 */}
      <div class={'mn-streak-fire' + (streak === 0 ? ' is-dim' : '')}>🔥 ×{streak}</div>
      <div class="mn-voyage">
        <div class="mn-voyage-track">
          <div class="mn-voyage-line" />
          <div class="mn-voyage-boat" style={{ left: `${frac * 100}%` }}>⛵</div>
        </div>
      </div>
      <div class="mn-voyage-count">航行 {voyage}</div>
    </div>
  );
}
