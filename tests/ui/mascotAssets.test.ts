import { expect, test } from 'vitest';
import { ICO_NAMES, icoSrc, type IcoName } from '../../src/ui/components/icoAssets';
import { MASCOT_POSES, mascotSrc, type MascotPose } from '../../src/ui/components/mascotAssets';

// 姿势→素材的映射是纯数据，刻意从组件里分离出来，
// 这样在本仓库的纯逻辑测试环境（无 jsdom/无组件渲染）里也测得着：
// 漏掉一个姿势会在测试时立刻暴露，而不是运行时渲染出一张碎图。

test('每个姿势都有对应素材', () => {
  for (const pose of MASCOT_POSES) {
    expect(mascotSrc(pose), `姿势 ${pose} 缺素材`).toBeTruthy();
  }
});

test('姿势清单覆盖全部调用点用到的姿势', () => {
  // 地图屏用 wave，结算屏按星级/破纪录用 happy 与 cheer，idle 为兜底默认值
  const used: MascotPose[] = ['idle', 'happy', 'wave', 'cheer'];
  for (const pose of used) expect(MASCOT_POSES).toContain(pose);
});

test('不同姿势指向不同素材', () => {
  const srcs = MASCOT_POSES.map(mascotSrc);
  expect(new Set(srcs).size).toBe(MASCOT_POSES.length);
});

test('每个行内图标都有对应素材且互不重复', () => {
  for (const name of ICO_NAMES) {
    expect(icoSrc(name), `图标 ${name} 缺素材`).toBeTruthy();
  }
  expect(new Set(ICO_NAMES.map(icoSrc)).size).toBe(ICO_NAMES.length);
});

test('图标清单覆盖全部被替换掉的 emoji', () => {
  // 🔊🔒⚙🎉✨🔥⛵🔄 —— 少一个就意味着某处还留着 emoji
  const required: IcoName[] = ['sound', 'lock', 'gear', 'party', 'sparkle', 'fire', 'boat', 'rotate'];
  for (const n of required) expect(ICO_NAMES).toContain(n);
});
