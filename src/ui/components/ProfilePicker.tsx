import { Steve } from './Steve';
import { peekProfile, profileMeta } from '../../core/storage';

// 选人屏（审查 D3 多档案）：≥2 档案时启动展示。头像 = 各档案史蒂夫的当前装扮
// （评审 M6 精神：装扮是孩子的身份表达，天然的「这是我的」标识）。
// 无文字输入——4 岁孩子认装扮和进度数字比认名字可靠。

const LABELS = ['船员一号', '船员二号', '船员三号'];

export function ProfilePicker({ onPick }: { onPick: (i: number) => void }) {
  const { count } = profileMeta();
  return (
    <div class="mn-profile-mask">
      <div class="mn-ribbon mn-profile-title">今晚谁来夜航？</div>
      <div class="mn-profile-cards">
        {Array.from({ length: count }, (_, i) => {
          const peek = peekProfile(i);
          return (
            <button key={i} class="mn-panel mn-profile-card" onClick={() => onPick(i)}>
              <Steve pose="wave" equipped={peek?.equipped ?? { boots: null, helm: null, legs: null, chest: null, accessories: [] }} />
              <div class="mn-profile-name">{LABELS[i]}</div>
              <div class="mn-profile-sub">
                {peek ? `第 ${Math.min(peek.starred + 1, 75)} 关 · ★ ${peek.starred}` : '新船员'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
