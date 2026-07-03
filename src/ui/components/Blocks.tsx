import { useState } from 'preact/hooks';
import type { BlocksPlan } from '../../core/types';

interface BlocksProps {
  plan: BlocksPlan;
  hint: string;
  show: boolean; // progress.settings.showBlocks / showBlocksTimed
  onHintClick: () => void; // Task 13 接 blocksHint 语音；现在与重播共用 stub
}

interface Cell {
  cls: string;
  mark: string;
  badge?: boolean; // keep-mark 的「留」角标
  onTap?: () => void;
}

// 交互态本地保存（每题通过 key 重挂载重置）。组件不含题型知识，只按 plan.type 渲染。
type Toggles = Record<number, boolean>;

function buildCells(plan: BlocksPlan, on: Toggles, toggle: (i: number) => void): Cell[] {
  const cells: Cell[] = [];
  switch (plan.type) {
    case 'two-group': {
      for (let i = 0; i < plan.a; i++) {
        const dim = !!on[i];
        cells.push({ cls: 'mn-block mn-block--teal' + (dim ? ' mn-block--dim' : ''), mark: dim ? '·' : '', onTap: () => toggle(i) });
      }
      for (let i = 0; i < plan.b; i++) {
        const k = plan.a + i;
        const dim = !!on[k];
        cells.push({ cls: 'mn-block mn-block--amber' + (dim ? ' mn-block--dim' : ''), mark: dim ? '·' : '', onTap: () => toggle(k) });
      }
      break;
    }
    case 'divide-out': {
      for (let i = 0; i < plan.total; i++) {
        const x = !!on[i];
        cells.push({ cls: 'mn-block ' + (x ? 'mn-block--cross' : 'mn-block--teal'), mark: x ? '✕' : '', onTap: () => toggle(i) });
      }
      break;
    }
    case 'fill-slot': {
      // 配色由 filledFirst 驱动（题库设计 §5）：true（a+?=c）实心青绿、空槽填琥珀；false（?+b=c）实心琥珀、空槽填青绿。
      const solidCls = plan.filledFirst ? 'mn-block--teal' : 'mn-block--amber';
      const slotCls = plan.filledFirst ? '' : ' mn-block--slot-teal';
      const solid = () => {
        for (let i = 0; i < plan.filled; i++) cells.push({ cls: `mn-block ${solidCls} mn-block--static`, mark: '' });
      };
      const slots = () => {
        for (let i = 0; i < plan.empty; i++) {
          const f = !!on[i];
          cells.push({ cls: 'mn-block ' + (f ? 'mn-block--slot-filled' : 'mn-block--slot-empty') + slotCls, mark: '', onTap: () => toggle(i) });
        }
      };
      if (plan.filledFirst) { solid(); slots(); } else { slots(); solid(); }
      break;
    }
    case 'keep-mark': {
      for (let i = 0; i < plan.total; i++) {
        if (i < plan.keep) {
          cells.push({ cls: 'mn-block mn-block--teal mn-block--static', mark: '', badge: true });
        } else {
          const x = !!on[i];
          cells.push({ cls: 'mn-block ' + (x ? 'mn-block--cross' : 'mn-block--teal'), mark: x ? '✕' : '', onTap: () => toggle(i) });
        }
      }
      break;
    }
    case 'three-group': {
      const colors = ['mn-block--teal', 'mn-block--amber', 'mn-block--white'];
      let idx = 0;
      plan.groups.forEach((count, g) => {
        for (let i = 0; i < count; i++) {
          const k = idx++;
          const dim = !!on[k];
          cells.push({ cls: 'mn-block ' + colors[g] + (dim ? ' mn-block--dim' : ''), mark: dim ? '·' : '', onTap: () => toggle(k) });
        }
      });
      break;
    }
  }
  return cells;
}

export function Blocks({ plan, hint, show, onHintClick }: BlocksProps) {
  const [on, setOn] = useState<Toggles>({});
  if (!show) return null;
  const toggle = (i: number) => setOn((prev) => ({ ...prev, [i]: !prev[i] }));
  const cells = buildCells(plan, on, toggle);

  return (
    <div class="mn-blocks">
      <div class="mn-blocks-panel">
        {cells.map((c, i) => (
          <div key={i} class={c.cls} onClick={c.onTap}>
            {c.badge && <span class="mn-block-badge">留</span>}
            {c.mark}
          </div>
        ))}
      </div>
      <div class="mn-blocks-hint" onClick={onHintClick}>🔊 {hint}</div>
    </div>
  );
}
