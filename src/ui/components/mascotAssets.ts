import cheer from '../../assets/mascot-cheer.webp';
import happy from '../../assets/mascot-happy.webp';
import idle from '../../assets/mascot-idle.webp';
import oops from '../../assets/mascot-oops.webp';
import wave from '../../assets/mascot-wave.webp';

// 姿势→素材映射。刻意不含 JSX，好让本仓库的纯逻辑测试环境测得到
// （见 tests/ui/mascotAssets.test.ts）。新增姿势时测试会强制配齐素材。
export const MASCOT_POSES = ['idle', 'happy', 'wave', 'cheer', 'oops'] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

const SRC: Record<MascotPose, string> = { idle, happy, wave, cheer, oops };

export const mascotSrc = (pose: MascotPose): string => SRC[pose];
