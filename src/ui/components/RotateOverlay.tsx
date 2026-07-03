// 竖屏时的全屏提示遮罩——本 App 仅横屏（README §适配）。
export function RotateOverlay() {
  return (
    <div class="mn-rotate">
      <div class="mn-rotate-icon">🔄</div>
      <div class="mn-rotate-text">请把 iPad 横过来</div>
    </div>
  );
}
