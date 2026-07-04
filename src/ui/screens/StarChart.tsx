import { useState } from 'preact/hooks';
import type { Progress } from '../../core/types';
import { activeFacts, allFacts, factKey, koujue, learnedTables, type Fact } from '../../core/timesTable';
import { ArrayGrid } from '../components/ArrayGrid';

interface StarChartProps {
  progress: Progress;
  onStartSession: () => void;      // 「开始练习」→ App.startTimesTable
  onBack: () => void;              // 「回地图」
  onSpeak: (line: string) => void; // 点格念口诀（App 持有 speak）
}

// 9×9 星图盘（含 1 行 + 1 列表头 = 10×10）。格状态色由掌握度 s 驱动；×1 行列预点亮；
// 未学表格更暗、表头带 🔒（仍可点预览听口诀、看阵列，spec §5）。点格 → 右侧弹卡 + 念口诀。
export function StarChart({ progress, onStartSession, onBack, onSpeak }: StarChartProps) {
  const L = learnedTables(progress);
  const facts = progress.timesTable.facts;
  // 已点亮 = 36 条核心口诀（2≤a≤b≤9）中 s===3 的数量（×1 预点亮不计入）。
  const lit = allFacts().filter((f) => (facts[f.key]?.s ?? 0) === 3).length;
  const canStart = activeFacts(progress).length > 0;

  const [sel, setSel] = useState<Fact | null>(null);

  const headerLocked = (t: number): boolean => t >= 2 && !L.has(t);

  // 表体格样式：×1 → free（预点亮）；未学（a、b 均未学）→ locked（更暗）；否则按 s 上色。
  const bodyClass = (r: number, c: number): string => {
    if (r === 1 || c === 1) return 'mn-sc-cell mn-sc-cell--free';
    const a = Math.min(r, c);
    const b = Math.max(r, c);
    if (!L.has(a) && !L.has(b)) return 'mn-sc-cell mn-sc-cell--locked';
    const s = facts[factKey(a, b)]?.s ?? 0;
    return 'mn-sc-cell mn-sc-cell--s' + s;
  };

  const tapCell = (r: number, c: number) => {
    const fact: Fact = { a: Math.min(r, c), b: Math.max(r, c), key: factKey(r, c) };
    setSel(fact);
    onSpeak(koujue(fact.a, fact.b));
  };

  const nums = [1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <>
      {/* ─── 顶栏 ─── */}
      <div style={{ position: 'absolute', top: 32, left: 40, right: 40, display: 'flex', alignItems: 'center', gap: 20 }}>
        <div style={{ fontSize: 38, fontWeight: 900, color: 'var(--color-white-100)' }}>九九星图</div>
        <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--color-white-55)' }}>点亮全部 36 句口诀</div>
      </div>

      {/* ─── 星图盘（左） ─── */}
      <div class="mn-sc-grid">
        <div class="mn-sc-corner">×</div>
        {nums.map((c) => (
          <div key={`h${c}`} class={headerLocked(c) ? 'mn-sc-head is-locked' : 'mn-sc-head'}>
            {headerLocked(c) ? '🔒' : c}
          </div>
        ))}
        {nums.map((r) => [
          <div key={`v${r}`} class={headerLocked(r) ? 'mn-sc-head is-locked' : 'mn-sc-head'}>
            {headerLocked(r) ? '🔒' : r}
          </div>,
          ...nums.map((c) => {
            const isSel = !!sel && sel.a === Math.min(r, c) && sel.b === Math.max(r, c);
            return (
              <div
                key={`${r}-${c}`}
                class={bodyClass(r, c) + (isSel ? ' is-sel' : '')}
                onClick={() => tapCell(r, c)}
              >
                {r * c}
              </div>
            );
          }),
        ])}
      </div>

      {/* ─── 右面板 ─── */}
      <div style={{ position: 'absolute', top: 130, left: 664, width: 280, bottom: 44, display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div class="mn-sc-counter">✨ 已点亮 {lit} / 36</div>

        {/* 点格弹卡（听口诀 + 看阵列）。keyed 于 fact → 每次选格重挂载，口诀 pop 复现。 */}
        <div class="mn-sc-card">
          {sel ? (
            <div key={sel.key} class="mn-sc-card-inner">
              <div class="mn-sc-card-eq">{sel.a} × {sel.b} = {sel.a * sel.b}</div>
              <div class="mn-sc-card-koujue">{koujue(sel.a, sel.b)}</div>
              <ArrayGrid rows={sel.a} cols={sel.b} cell={16} gap={4} />
              <div class="mn-sc-card-tts" role="button" aria-label="重播口诀" onClick={() => onSpeak(koujue(sel.a, sel.b))}>🔊 再听一次</div>
            </div>
          ) : (
            <div class="mn-sc-card-hint">点一个格子<br />听口诀 · 看阵列</div>
          )}
        </div>

        <button class={canStart ? 'mn-cta' : 'mn-cta is-disabled'} disabled={!canStart} onClick={canStart ? onStartSession : undefined}>
          开始练习 ▶
        </button>
        {!canStart && <div class="mn-sc-hint">先在地图上学习乘法表</div>}
        <button class="mn-mode-btn" onClick={onBack}>回地图</button>
      </div>
    </>
  );
}
