import type { EquipSlot, EquipTier, OreKind, TradeKind } from './types';

// 目录常量。数值权威：docs/edu-pm-reviews/2026-07-30-steve-raise-review.md §数值规范表。
// 改任何一个数前先读该文档的 §G 调参判据——数值不是拍脑袋来的。

export interface EquipItem {
  id: string;
  tier: EquipTier;
  slot: EquipSlot;
  material: OreKind;
  cost: number;
  name: string; // 中文名（TTS 与界面共用）
}

export interface AccessoryItem {
  id: string;
  anchor: 'hand' | 'feet' | 'shoulder' | 'side';
  material: OreKind;
  cost: number;
  name: string;
}

export const TIER_ORDER: EquipTier[] = ['leather', 'iron', 'gold', 'diamond'];
export const SLOT_ORDER: EquipSlot[] = ['boots', 'helm', 'legs', 'chest'];

const TIER_CN: Record<EquipTier, string> = { leather: '皮革', iron: '铁', gold: '金', diamond: '钻石' };
const SLOT_CN: Record<EquipSlot, string> = { boots: '靴', helm: '盔', legs: '护腿', chest: '胸甲' };
const TIER_MATERIAL: Record<EquipTier, OreKind> = { leather: 'coal', iron: 'iron', gold: 'gold', diamond: 'diamond' };
// 件价（靴/盔/腿/胸），评审表 A。皮革靴 3 煤是弱孩子首会话闭环的红线价。
const TIER_COSTS: Record<EquipTier, [number, number, number, number]> = {
  leather: [3, 6, 9, 12],
  iron: [5, 8, 12, 15],
  gold: [3, 5, 7, 9],
  diamond: [2, 2, 3, 5],
};

export const EQUIPMENT: EquipItem[] = TIER_ORDER.flatMap((tier) =>
  SLOT_ORDER.map((slot, i) => ({
    id: `eq-${tier}-${slot}`,
    tier,
    slot,
    material: TIER_MATERIAL[tier],
    cost: TIER_COSTS[tier][i],
    name: `${TIER_CN[tier]}${SLOT_CN[slot]}`,
  })),
);

// 配件（评审表 B）：只用可再生矿为主，永不占用装备阶关键矿的大头。
// 无武器类（镐/竿/盾是工具与防具，不上刀剑）。
export const ACCESSORIES: AccessoryItem[] = [
  { id: 'ac-torch', anchor: 'hand', material: 'coal', cost: 5, name: '火把' },
  { id: 'ac-flowerpot', anchor: 'feet', material: 'coal', cost: 6, name: '花盆' },
  { id: 'ac-pickaxe', anchor: 'hand', material: 'coal', cost: 8, name: '木镐' },
  { id: 'ac-rod', anchor: 'hand', material: 'coal', cost: 8, name: '钓鱼竿' },
  { id: 'ac-lantern', anchor: 'feet', material: 'coal', cost: 10, name: '灯笼' },
  { id: 'ac-cake', anchor: 'feet', material: 'coal', cost: 12, name: '蛋糕' },
  { id: 'ac-banner', anchor: 'side', material: 'coal', cost: 12, name: '旗帜' },
  { id: 'ac-shield', anchor: 'hand', material: 'coal', cost: 15, name: '盾牌' },
  { id: 'ac-chick', anchor: 'feet', material: 'iron', cost: 4, name: '小鸡' },
  { id: 'ac-dog', anchor: 'feet', material: 'iron', cost: 6, name: '小狗' },
  { id: 'ac-parrot', anchor: 'shoulder', material: 'emerald', cost: 2, name: '鹦鹉' },
  { id: 'ac-cat', anchor: 'feet', material: 'emerald', cost: 3, name: '小猫' },
];

// 星空（评审表 C）：只收煤、固定价；图样按序点亮，45 星之后自由点星。
export const STAR_PRICE_COAL = 10;
export const SKY_PATTERNS: { id: string; name: string; stars: number }[] = [
  { id: 'sky-boat', name: '小船座', stars: 7 },
  { id: 'sky-dipper', name: '北斗座', stars: 7 },
  { id: 'sky-lighthouse', name: '灯塔座', stars: 9 },
  { id: 'sky-moon', name: '月亮座', stars: 10 },
  { id: 'sky-whale', name: '鲸鱼座', stars: 12 },
];

// 兑换（评审表 E）：4:1 只向上。3:1 是唯一调参备用旋钮。
export const TRADE_CHAIN: { kind: TradeKind; from: OreKind; to: OreKind; rate: number }[] = [
  { kind: 'coalToIron', from: 'coal', to: 'iron', rate: 4 },
  { kind: 'ironToGold', from: 'iron', to: 'gold', rate: 4 },
  { kind: 'goldToDiamond', from: 'gold', to: 'diamond', rate: 4 },
  { kind: 'diamondToEmerald', from: 'diamond', to: 'emerald', rate: 4 },
];

export const CATALOG_BY_ID: Record<string, EquipItem | AccessoryItem> = Object.fromEntries(
  [...EQUIPMENT, ...ACCESSORIES].map((x) => [x.id, x]),
);
