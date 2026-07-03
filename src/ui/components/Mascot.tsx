import type { JSX } from 'preact';

export type MascotPose = 'idle' | 'happy' | 'cheer';

// 姿态只微调嘴形（眼睛保持稳定）——琥珀圆角方脸吉祥物，见 README §Assets。
const MOUTHS: Record<MascotPose, JSX.CSSProperties> = {
  idle: { width: 24, height: 10, bottom: 14, left: 30, borderRadius: '0 0 10px 10px' },
  happy: { width: 30, height: 14, bottom: 12, left: 27, borderRadius: '0 0 15px 15px' },
  cheer: { width: 22, height: 20, bottom: 12, left: 31, borderRadius: '50%' },
};

export function Mascot({ pose = 'idle', scale = 1 }: { pose?: MascotPose; scale?: number }) {
  return (
    <div class="mn-mascot" style={{ transform: `scale(${scale})` }}>
      <div class="mn-mascot-halo">
        <div class="mn-mascot-face">
          <div class="mn-mascot-eye" style={{ left: 15 }} />
          <div class="mn-mascot-eye" style={{ right: 15 }} />
          <div class="mn-mascot-hi" style={{ left: 20 }} />
          <div class="mn-mascot-hi" style={{ right: 20 }} />
          <div class="mn-mascot-mouth" style={MOUTHS[pose]} />
        </div>
      </div>
    </div>
  );
}
