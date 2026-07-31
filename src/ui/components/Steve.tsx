import type { RewardsSlice } from '../../core/types';
import { PET_IDS } from '../../core/rewardsCatalog';
import { steveSrc, type StevePose } from './steveAssets';
import { ACC_ANCHORS, ACC_META, ACC_SRC, PIECE_META, PIECE_SRC, POSE_META } from './steveMeta';

export type { StevePose };

// 史蒂夫。基础精灵 + 装备/配件叠加层（spec §7）：
// 头/躯干/腿画布坐标恒定，一套叠加层适配全部姿势；
// 定位 = 画布坐标 − 姿势裁剪偏移（POSE_META），全部整数倍放大。
//
// ⚠️ 缩放（外层）与漂浮动画（内层 box）必须分处两层：二者都写 transform，
//    同层时 CSS 动画会覆盖内联 scale。
// alt=""：角色是装饰性的，情绪信息由同屏文案表达。
const K = 4; // 整数放大倍率——非整数会让点阵落在半像素上糊掉

export function Steve({
  pose = 'idle',
  scale = 1,
  equipped,
}: {
  pose?: StevePose;
  scale?: number;
  equipped?: RewardsSlice['equipped'];
}) {
  const pm = POSE_META[pose];
  const pieces = equipped
    ? ([equipped.boots, equipped.helm, equipped.legs, equipped.chest].filter(Boolean) as string[])
    : [];
  // 过滤宠物：它们住家园（Pet 层负责渲染），不贴身——兼容旧存档里
  // craft 曾把宠物写进 accessories 的情况。
  const accs = (equipped?.accessories ?? []).filter((id) => !PET_IDS.includes(id));
  return (
    <div class="mn-steve" style={{ transform: `scale(${scale})` }}>
      <div class="mn-steve-box" style={{ width: pm.w * K, height: pm.h * K }}>
        <img class="mn-steve-img" src={steveSrc(pose)} alt="" />
        {pieces.map((id) => {
          const m = PIECE_META[id];
          return (
            <img
              key={id}
              class="mn-steve-layer"
              src={PIECE_SRC[id]}
              alt=""
              style={{ left: (m.x - pm.x0) * K, top: (m.y - pm.y0) * K, width: m.w * K, height: m.h * K }}
            />
          );
        })}
        {accs.map((id) => {
          const m = ACC_META[id];
          const a = ACC_ANCHORS[m.anchor];
          return (
            <img
              key={id}
              class="mn-steve-layer"
              src={ACC_SRC[id]}
              alt=""
              style={{ left: (a.x - pm.x0) * K, top: (a.y - pm.y0) * K, width: m.w * K, height: m.h * K }}
            />
          );
        })}
      </div>
    </div>
  );
}
