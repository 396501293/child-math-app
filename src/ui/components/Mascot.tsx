import { mascotSrc, type MascotPose } from './mascotAssets';

export type { MascotPose };

// 吉祥物。原为 CSS 几何拼装（halo/face/eye/hi/mouth 五层 div），
// 动森化后改用手绘素材，姿势→素材映射见 ./mascotAssets。
//
// ⚠️ 缩放与漂浮动画必须分处两层元素：二者都写 transform，
//    同层时 CSS 动画会覆盖内联的 scale（结算屏 scale=1.15 会失效）。
//
// alt="" 是刻意的：吉祥物是装饰性的，情绪信息已由同屏文案表达，
// 给它加 alt 会让读屏器重复播报。
export function Mascot({ pose = 'idle', scale = 1 }: { pose?: MascotPose; scale?: number }) {
  return (
    <div class="mn-mascot" style={{ transform: `scale(${scale})` }}>
      <img class="mn-mascot-img" src={mascotSrc(pose)} alt="" />
    </div>
  );
}
