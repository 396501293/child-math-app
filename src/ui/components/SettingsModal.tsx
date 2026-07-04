import { useEffect, useRef, useState } from 'preact/hooks';
import type { Progress } from '../../core/types';

interface SettingsModalProps {
  settings: Progress['settings'];
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

export function SettingsModal({ settings, onUpdateSettings, onResetProgress, onUnlockAll, onClose }: SettingsModalProps) {
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
        <div class="mn-set-title">家长设置</div>

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
      </div>
    </div>
  );
}
