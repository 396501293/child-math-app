import coal from '../../assets/ico-ore-coal.png';
import diamond from '../../assets/ico-ore-diamond.png';
import emerald from '../../assets/ico-ore-emerald.png';
import gold from '../../assets/ico-ore-gold.png';
import iron from '../../assets/ico-ore-iron.png';
import type { OreKind } from '../../core/types';

// 五矿图标（scripts/gen-ico.mjs 生成）。中文名与 TTS 来源说明同表维护——
// 措辞纪律：矿石一律称「材料」，来源句式是「记录」不是「奖励」（M2）。
export const ORE_SRC: Record<OreKind, string> = { coal, iron, gold, diamond, emerald };
export const ORE_CN: Record<OreKind, string> = {
  coal: '煤', iron: '铁', gold: '金', diamond: '钻石', emerald: '绿宝石',
};
export const ORE_SOURCE_LINE: Record<OreKind, string> = {
  coal: '煤：每走完一关，挖到一块；多练习也会有。',
  iron: '铁：仔细做题，两星三星都会有。',
  gold: '金：练习做得多，金子就多。',
  diamond: '钻石：走得很远的时候，会挖到钻石。',
  emerald: '绿宝石：口诀背下来、连对很多题，就会出现。',
};
