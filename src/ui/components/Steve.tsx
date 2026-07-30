import { steveSrc, type StevePose } from './steveAssets';

export type { StevePose };

// 史蒂夫。精灵是 16×32 左右的像素图，靠 CSS 放大到展示尺寸——
// 必须 image-rendering: pixelated（在 .mn-stage 上统一开启）。
//
// ⚠️ 缩放与漂浮动画必须分处两层元素：二者都写 transform，
//    同层时 CSS 动画会覆盖内联的 scale（结算屏 scale=1.15 会失效）。
//
// alt=""：角色是装饰性的，情绪信息已由同屏文案表达，
// 加 alt 会让读屏器重复播报。
export function Steve({ pose = 'idle', scale = 1 }: { pose?: StevePose; scale?: number }) {
  return (
    <div class="mn-steve" style={{ transform: `scale(${scale})` }}>
      <img class="mn-steve-img" src={steveSrc(pose)} alt="" />
    </div>
  );
}
