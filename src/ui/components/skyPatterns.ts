// 夜空星座图样（评审表 C：小船7/北斗7/灯塔9/月亮10/鲸鱼12 = 45 星）。
// 坐标为 1024×768 舞台坐标，全部落在地图屏顶部天空带（面板上方）。
// 点亮顺序 = 图样序 × 图样内序；skyStars 是全局累计数。
// 集齐一个图样 → 连线常驻 + 一句语音，无其他奖励。

export interface SkyPattern {
  id: string;
  name: string;
  stars: { x: number; y: number }[];
  lines: [number, number][]; // 图样内索引对；集齐后绘制
}

export const SKY_LAYOUT: SkyPattern[] = [
  {
    id: 'sky-boat',
    name: '小船座',
    // 船壳弧线 + 桅杆
    stars: [
      { x: 80, y: 96 }, { x: 108, y: 108 }, { x: 140, y: 110 }, { x: 170, y: 100 },
      { x: 126, y: 84 }, { x: 126, y: 56 }, { x: 148, y: 68 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [1, 4], [4, 5], [5, 6]],
  },
  {
    id: 'sky-dipper',
    name: '北斗座',
    stars: [
      { x: 250, y: 60 }, { x: 288, y: 52 }, { x: 326, y: 58 }, { x: 356, y: 76 },
      { x: 394, y: 82 }, { x: 396, y: 112 }, { x: 356, y: 108 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  {
    id: 'sky-lighthouse',
    name: '灯塔座',
    stars: [
      { x: 496, y: 40 }, { x: 480, y: 58 }, { x: 512, y: 58 }, { x: 484, y: 84 },
      { x: 508, y: 84 }, { x: 480, y: 110 }, { x: 512, y: 110 }, { x: 462, y: 46 }, { x: 530, y: 46 },
    ],
    lines: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [7, 0], [0, 8]],
  },
  {
    id: 'sky-moon',
    name: '月亮座',
    stars: [
      { x: 640, y: 44 }, { x: 620, y: 62 }, { x: 612, y: 84 }, { x: 620, y: 106 },
      { x: 640, y: 122 }, { x: 664, y: 118 }, { x: 646, y: 104 }, { x: 638, y: 84 },
      { x: 646, y: 64 }, { x: 664, y: 50 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 9], [9, 0]],
  },
  {
    id: 'sky-whale',
    name: '鲸鱼座',
    stars: [
      { x: 760, y: 90 }, { x: 796, y: 76 }, { x: 836, y: 70 }, { x: 876, y: 76 },
      { x: 908, y: 92 }, { x: 936, y: 78 }, { x: 952, y: 56 }, { x: 962, y: 84 },
      { x: 908, y: 112 }, { x: 868, y: 118 }, { x: 820, y: 116 }, { x: 782, y: 108 },
    ],
    lines: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [5, 7], [4, 8], [8, 9], [9, 10], [10, 11], [11, 0]],
  },
  // ── 第五章 +2 座（规范 §8.3）：落在原自由星空隙带 3/4，接鲸鱼座之后按序点亮 ──
  {
    id: 'sky-blaze',
    name: '烈焰座',
    // 火焰轮廓（灯塔—月亮之间空隙带）
    stars: [
      { x: 556, y: 116 }, { x: 588, y: 116 }, { x: 548, y: 92 }, { x: 572, y: 100 },
      { x: 596, y: 92 }, { x: 556, y: 68 }, { x: 588, y: 64 }, { x: 572, y: 46 },
    ],
    lines: [[0, 2], [2, 5], [5, 7], [7, 6], [6, 4], [4, 1], [1, 3], [3, 0]],
  },
  {
    id: 'sky-bastion',
    name: '堡垒座',
    // 双塔城墙（月亮—鲸鱼之间空隙带）
    stars: [
      { x: 676, y: 120 }, { x: 748, y: 120 }, { x: 676, y: 88 }, { x: 748, y: 88 },
      { x: 676, y: 58 }, { x: 692, y: 58 }, { x: 732, y: 58 }, { x: 748, y: 58 },
      { x: 692, y: 88 }, { x: 732, y: 88 }, { x: 712, y: 70 },
    ],
    lines: [[0, 2], [2, 4], [4, 5], [5, 8], [8, 10], [10, 9], [9, 6], [6, 7], [7, 3], [3, 1], [1, 0]],
  },
];

export const PATTERN_STAR_TOTAL = SKY_LAYOUT.reduce((s, p) => s + p.stars.length, 0); // 45

// 自由点星（第 46 颗起，审查 D1）：坐标由星序号确定性派生，散布在图样间的
// 4 条空隙带（x 区间与所有图样零重叠，天然不撞星）。仍是同一 skyStars 计数——
// 铁则：不得分裂出第二种星。
const FREE_BANDS = [
  { x0: 184, w: 58 }, // 小船—北斗之间
  { x0: 404, w: 52 }, // 北斗—灯塔之间（带 3/4 已让给烈焰座/堡垒座）
];

export function freeStarPositions(skyStars: number): { x: number; y: number }[] {
  const n = Math.max(0, skyStars - PATTERN_STAR_TOTAL);
  const out: { x: number; y: number }[] = [];
  for (let k = 0; k < n; k++) {
    const band = FREE_BANDS[k % FREE_BANDS.length];
    const j = Math.floor(k / FREE_BANDS.length);
    out.push({
      x: band.x0 + ((j * 37 + k * 11) % band.w),
      y: 44 + ((j * 53 + (k % FREE_BANDS.length) * 19) % 80),
    });
  }
  return out;
}

// skyStars（全局累计）→ 每个图样的点亮数与是否集齐
export function skyState(skyStars: number): { pattern: SkyPattern; lit: number; complete: boolean }[] {
  let left = skyStars;
  return SKY_LAYOUT.map((pattern) => {
    const lit = Math.min(left, pattern.stars.length);
    left -= lit;
    return { pattern, lit, complete: lit === pattern.stars.length };
  });
}
