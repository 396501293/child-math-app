import { useEffect, useRef, useState } from 'preact/hooks';
import type { Progress } from '../../core/types';

interface SettingsModalProps {
  settings: Progress['settings'];
  weekly: Progress['weekly'];
  insight: Progress['insight'];
  onUpdateSettings: (patch: Partial<Progress['settings']>) => void;
  onResetProgress: () => void;
  onUnlockAll: () => void;
  onClose: () => void;
}

// 家长设置面板（spec §5「家长设置」/ 题库设计 §六）。齿轮长按 1.5s 打开（长按逻辑在 Map）。
// 面向家长：字号偏小（20–24px）。所有改动即时经 onUpdateSettings 持久化。
function Toggle({ on, label, onToggle }: { on: boolean; label: string; onToggle: () => void }) {
  return (
    <div class="mn-set-row">
      <span class="mn-set-label">{label}</span>
      <button
        class={'mn-toggle' + (on ? ' is-on' : '')}
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={onToggle}
      >
        <span class="mn-toggle-knob" />
      </button>
    </div>
  );
}

export function SettingsModal({ settings, weekly, insight, onUpdateSettings, onResetProgress, onUnlockAll, onClose }: SettingsModalProps) {
  // 观察清单（评审 M6 硬性交付）：折叠在设置内，家长按需展开
  const [showChecklist, setShowChecklist] = useState(false);
  // 家长小结完整版（审查 D2）：近 7 天分章正确率 + 最近错题，折叠展开
  const [showErrors, setShowErrors] = useState(false);
  const CH_LABEL: Record<string, string> = { 1: '第一章', 2: '第二章', 3: '第三章', 4: '第四章', 5: '第五章', tt: '九九星图' };
  const byChapter = new Map<string, { n: number; ok: number }>();
  for (const day of insight.days)
    for (const [ch, v] of Object.entries(day.ch)) {
      const cur = byChapter.get(ch) ?? { n: 0, ok: 0 };
      byChapter.set(ch, { n: cur.n + v.n, ok: cur.ok + v.ok });
    }
  const chRows = Object.keys(CH_LABEL)
    .filter((ch) => byChapter.has(ch))
    .map((ch) => ({ label: CH_LABEL[ch], ...byChapter.get(ch)! }));
  // 重置进度二次确认：首点变红提示，5s 内再点执行，超时还原。
  const [confirmReset, setConfirmReset] = useState(false);
  const resetTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  const clickReset = () => {
    if (!confirmReset) {
      setConfirmReset(true);
      resetTimer.current = window.setTimeout(() => setConfirmReset(false), 5000);
    } else {
      window.clearTimeout(resetTimer.current);
      onResetProgress();
    }
  };

  // 解锁全部关卡：与重置进度同款二次确认（首点变红，5s 内再点执行，超时还原）。
  const [confirmUnlock, setConfirmUnlock] = useState(false);
  const unlockTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(unlockTimer.current), []);

  const clickUnlock = () => {
    if (!confirmUnlock) {
      setConfirmUnlock(true);
      unlockTimer.current = window.setTimeout(() => setConfirmUnlock(false), 5000);
    } else {
      window.clearTimeout(unlockTimer.current);
      onUnlockAll();
    }
  };

  const qc = settings.questionCount;
  const setCount = (n: number) => onUpdateSettings({ questionCount: Math.min(10, Math.max(3, n)) });

  return (
    <div class="mn-set-mask" onClick={onClose}>
      {/* 阻止冒泡：点卡片内部不关闭 */}
      <div class="mn-set-card" onClick={(e) => e.stopPropagation()}>
        <button class="mn-set-close" onClick={onClose} aria-label="关闭设置">✕</button>
        <div class="mn-ribbon mn-set-title">家长设置</div>

        {/* 每关题数（仅主线）3–10 步进 */}
        <div class="mn-set-row">
          <span class="mn-set-label">每关题数</span>
          <div class="mn-stepper">
            <button class="mn-step-btn" disabled={qc <= 3} onClick={() => setCount(qc - 1)} aria-label="减少题数">−</button>
            <span class="mn-step-num">{qc}</span>
            <button class="mn-step-btn" disabled={qc >= 10} onClick={() => setCount(qc + 1)} aria-label="增加题数">＋</button>
          </div>
        </div>

        <Toggle
          label="困难模式（加法改缺数）"
          on={settings.hardMode}
          onToggle={() => onUpdateSettings({ hardMode: !settings.hardMode })}
        />
        <Toggle
          label="显示计数块（主线 / 无尽）"
          on={settings.showBlocks}
          onToggle={() => onUpdateSettings({ showBlocks: !settings.showBlocks })}
        />
        <Toggle
          label="显示计数块（星光冲刺）"
          on={settings.showBlocksTimed}
          onToggle={() => onUpdateSettings({ showBlocksTimed: !settings.showBlocksTimed })}
        />
        {/* 史蒂夫养成开关（评审 M6）：关 = 隐藏入口与计数；
            史蒂夫保持当前装扮——扒衣服等于没收，禁止。 */}
        <Toggle
          label="史蒂夫养成"
          on={settings.steveRaise}
          onToggle={() => onUpdateSettings({ steveRaise: !settings.steveRaise })}
        />

        {/* 每周小结（P0-2-lite）：观察清单的关键指标 */}
        <div class="mn-set-week">
          本周答题 {weekly.answered} 题
          {weekly.answered > 0 && ` · 首答正确率 ${Math.round((weekly.firstTry / weekly.answered) * 100)}%`}
        </div>

        {/* 近 7 天分章首答正确率（审查 D2）：回答「他卡在哪一类题」 */}
        {chRows.length > 0 && (
          <div class="mn-set-insight">
            {chRows.map((r) => (
              <div key={r.label} class="mn-set-insight-row">
                {r.label} 首答正确率 {Math.round((r.ok / r.n) * 100)}%（{r.n} 题 / 近 7 天）
              </div>
            ))}
          </div>
        )}
        {insight.errors.length > 0 && (
          <>
            <button class="mn-set-checklist-toggle" onClick={() => setShowErrors(!showErrors)}>
              {showErrors ? '收起最近错题 ▲' : `最近错题（${insight.errors.length}）▼`}
            </button>
            {showErrors && (
              <div class="mn-set-errlog">
                {[...insight.errors].reverse().map((e, i) => (
                  <div key={i} class="mn-set-errlog-row">
                    {e.text}　孩子选了 {e.picked}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <button class="mn-set-checklist-toggle" onClick={() => setShowChecklist(!showChecklist)}>
          {showChecklist ? '收起观察清单 ▲' : '查看观察清单 ▼'}
        </button>
        {showChecklist && (
          <div class="mn-set-checklist">
            <p>出现下列任一，先关掉养成两周（史蒂夫会保持装扮）：</p>
            <p>1. 做题前先问「这关给几块矿」，再决定玩不玩；</p>
            <p>2. 答题明显变快变糙——首答正确率下降，或催着跳过计数块和朗读；</p>
            <p>3. 每次大半时间停在养成屏，本周答题量连着往下走；</p>
            <p>4. 因为「还做不了下一件」发脾气，或用不做题威胁要装备；</p>
            <p>5. 答题中途反复退回养成屏——先看退出位置：若都卡在同一类新题型，是难度问题，别急着关养成；</p>
            <p>6. 一边把煤全点了星空、一边抱怨装备升不了级——陪他看一遍工作台的换材料说明。</p>
            <p>健康信号（放心）：给装备编故事、主动展示、指认星座；换装在会话头尾且答题量不降；练习模式玩得更多。每两周对照一次即可。</p>
          </div>
        )}

        <button
          class={'mn-set-reset' + (confirmUnlock ? ' is-confirm' : '')}
          onClick={clickUnlock}
        >
          {confirmUnlock ? '再点一次确认解锁' : '解锁全部关卡'}
        </button>

        <button
          class={'mn-set-reset' + (confirmReset ? ' is-confirm' : '')}
          onClick={clickReset}
        >
          {confirmReset ? '再点一次确认重置' : '重置进度'}
        </button>
        {/* 评审硬要求：重置会连带清掉派生的养成数据，必须明说 */}
        {confirmReset && (
          <div class="mn-set-reset-warn">史蒂夫的家、装备和你点亮的星星都会一起消失</div>
        )}
      </div>
    </div>
  );
}
