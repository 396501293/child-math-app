import { expect, test } from 'vitest';
import { STEVE_POSES } from '../../src/ui/components/steveAssets';
import { ACCESSORIES, EQUIPMENT } from '../../src/core/rewardsCatalog';
import {
  ACC_ANCHORS,
  ACC_META,
  ACC_SRC,
  PIECE_META,
  PIECE_SRC,
  POSE_META,
  POSE_SRC,
} from '../../src/ui/components/steveMeta';

// steveMeta.ts 是生成的纯数据（scripts/gen-steve.mjs）。这里校验：
// 目录（经济）与素材（渲染）永远同步——目录加了件而生成器没跑，
// 测试立刻红，而不是运行时渲染出一个隐形装备。

test('manifest 覆盖全部姿势', () => {
  for (const pose of STEVE_POSES) {
    expect(POSE_META[pose], `姿势 ${pose} 缺偏移`).toBeTruthy();
    expect(POSE_SRC[pose], `姿势 ${pose} 缺精灵`).toBeTruthy();
  }
});

test('每件装备都有叠加素材与定位', () => {
  for (const e of EQUIPMENT) {
    expect(PIECE_SRC[e.id], `${e.id} 缺素材`).toBeTruthy();
    expect(PIECE_META[e.id], `${e.id} 缺定位`).toBeTruthy();
  }
});

test('每个配件都有素材，且锚点与目录一致', () => {
  for (const a of ACCESSORIES) {
    expect(ACC_SRC[a.id], `${a.id} 缺素材`).toBeTruthy();
    expect(ACC_META[a.id]?.anchor, `${a.id} 锚点`).toBe(a.anchor);
    expect(ACC_ANCHORS[a.anchor], `锚点 ${a.anchor} 缺坐标`).toBeTruthy();
  }
});

test('装备叠加层全部落在姿势画布内（24×40，减偏移后不越界）', () => {
  for (const e of EQUIPMENT) {
    const m = PIECE_META[e.id];
    for (const pose of STEVE_POSES) {
      const pm = POSE_META[pose];
      expect(m.x - pm.x0, `${e.id}@${pose} 左越界`).toBeGreaterThanOrEqual(0);
      expect(m.y - pm.y0, `${e.id}@${pose} 上越界`).toBeGreaterThanOrEqual(0);
      expect(m.x - pm.x0 + m.w, `${e.id}@${pose} 右越界`).toBeLessThanOrEqual(pm.w);
      expect(m.y - pm.y0 + m.h, `${e.id}@${pose} 下越界`).toBeLessThanOrEqual(pm.h);
    }
  }
});
