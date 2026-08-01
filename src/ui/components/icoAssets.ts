import boat from '../../assets/ico-boat.png';
import fire from '../../assets/ico-fire.png';
import gear from '../../assets/ico-gear.png';
import lock from '../../assets/ico-lock.png';
import party from '../../assets/ico-party.png';
import pickaxe from '../../assets/ico-pickaxe.png';
import rotate from '../../assets/ico-rotate.png';
import sound from '../../assets/ico-sound.png';
import sparkle from '../../assets/ico-sparkle.png';

// 行内小图标：替代原先的彩色 emoji（🔊🔒⚙🎉✨🔥⛵🔄）。
// emoji 走系统字体渲染，与像素风冲突，且各平台字形不一致。
// 精灵由 scripts/gen-ico.mjs 手写网格生成，每张约 160B——
// 这些图标最小渲染到 17px，文生图产物在这个尺寸必糊。
//
// 与 steveAssets 同样刻意不含 JSX，好让纯逻辑测试环境测得着映射完整性。
export const ICO_NAMES = ['sound', 'lock', 'gear', 'party', 'sparkle', 'fire', 'boat', 'rotate', 'pickaxe'] as const;
export type IcoName = (typeof ICO_NAMES)[number];

const SRC: Record<IcoName, string> = { sound, lock, gear, party, sparkle, fire, boat, rotate, pickaxe };

export const icoSrc = (name: IcoName): string => SRC[name];
