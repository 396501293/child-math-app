import boat from '../../assets/ico-boat.webp';
import fire from '../../assets/ico-fire.webp';
import gear from '../../assets/ico-gear.webp';
import lock from '../../assets/ico-lock.webp';
import party from '../../assets/ico-party.webp';
import rotate from '../../assets/ico-rotate.webp';
import sound from '../../assets/ico-sound.webp';
import sparkle from '../../assets/ico-sparkle.webp';

// 行内小图标：替代原先的彩色 emoji（🔊🔒⚙🎉✨🔥⛵🔄）。
// emoji 走系统字体渲染，与手绘素材风格冲突，且各平台字形不一致。
//
// 与 steveAssets 同样刻意不含 JSX，好让纯逻辑测试环境测得着映射完整性。
export const ICO_NAMES = ['sound', 'lock', 'gear', 'party', 'sparkle', 'fire', 'boat', 'rotate'] as const;
export type IcoName = (typeof ICO_NAMES)[number];

const SRC: Record<IcoName, string> = { sound, lock, gear, party, sparkle, fire, boat, rotate };

export const icoSrc = (name: IcoName): string => SRC[name];
