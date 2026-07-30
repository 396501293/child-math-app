import cheer from '../../assets/steve-cheer.png';
import happy from '../../assets/steve-happy.png';
import idle from '../../assets/steve-idle.png';
import oops from '../../assets/steve-oops.png';
import wave from '../../assets/steve-wave.png';

// 姿势→精灵映射。刻意不含 JSX，好让本仓库的纯逻辑测试环境测得着
// （见 tests/ui/steveAssets.test.ts）。新增姿势时测试会强制配齐精灵。
// 精灵由 scripts/gen-steve.mjs 手写网格生成，每张约 220B。
export const STEVE_POSES = ['idle', 'wave', 'happy', 'cheer', 'oops'] as const;
export type StevePose = (typeof STEVE_POSES)[number];

const SRC: Record<StevePose, string> = { idle, wave, happy, cheer, oops };

export const steveSrc = (pose: StevePose): string => SRC[pose];
