// 阵列点阵（a 行 × b 列）——纯展示，无交互。九九星图的记忆锚：把「三四十二」
// 锚到「3 排、每排 4 个」的图像。用于星图预览卡（小号）与答错揭示卡（大号）。
export function ArrayGrid({ rows, cols, cell = 20, gap = 5 }: {
  rows: number;
  cols: number;
  cell?: number;
  gap?: number;
}) {
  return (
    <div
      class="mn-arraygrid"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gap: `${gap}px` }}
    >
      {Array.from({ length: rows * cols }).map((_, i) => (
        <div key={i} class="mn-arraygrid-dot" style={{ width: `${cell}px`, height: `${cell}px` }} />
      ))}
    </div>
  );
}
