// 史蒂夫像素精灵生成器（手写网格 → PNG）。
//
// 为什么手写而不是让文生图出：试过两轮，AI 版有三个治不好的毛病——
// 衬衫出现杂色噪点、手臂带渐变阴影（像素画不该有）、姿势之间体型漂移
// （宽度从 25 到 47 乱跳，切换时角色会跳动）。
// 而史蒂夫本来就是一堆纯色矩形，直接写网格反而更准，且五个姿势
// 天然像素级一致——同一套头/躯干/腿，只换手臂位置。
//
// 产物每张约 260 字节。运行：node scripts/gen-steve.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets');

// Minecraft 经典配色
const C = {
  '.': null,
  H: [0x2b, 0x19, 0x0e], // 头发
  S: [0xb5, 0x88, 0x6b], // 皮肤
  s: [0x9c, 0x73, 0x59], // 皮肤暗面
  W: [0xff, 0xff, 0xff], // 眼白
  B: [0x36, 0x3c, 0xb4], // 瞳色
  M: [0x4a, 0x2e, 0x1e], // 嘴 / 胡
  C: [0x00, 0xaf, 0xaf], // 衬衫
  c: [0x00, 0x8c, 0x8c], // 衬衫暗面
  P: [0x3a, 0x3a, 0xa8], // 裤子
  p: [0x2e, 0x2e, 0x8a], // 裤子暗面
  O: [0x53, 0x53, 0x53], // 鞋
};

const HEAD = ['HHHHHHHH', 'HHHHHHHH', 'HSSSSSSH', 'HWBSSBWH', 'HSSSSSSH', '', 'HSSSSSSH', '.SSSSSS.'];
// 嘴随情绪换，其余七行全姿势共用
const MOUTH = { flat: 'HSMMMMSH', smile: 'HSMSSMSH', open: 'HSMMMMSH', oops: 'HSSMMSSH' };
const POSE_MOUTH = { idle: 'flat', wave: 'smile', happy: 'smile', cheer: 'open', oops: 'oops' };

const rep = (row, n) => Array(n).fill(row);
const TORSO = [...rep('CCCCCCCC', 3), ...rep('CCCcCCCC', 6), ...rep('CCCCCCCC', 3)];
// 两条腿各 4 宽，中间留 1 列缝——连成一块会像裙子
const LEGS = [...rep('PPP.PPPP', 10), ...rep('OOO.OOOO', 2)];
const ARM = [...rep('SSSS', 2), ...rep('SSsS', 8), ...rep('SSSS', 2)];

const W = 24, H = 40; // 上方留 8 行给举过头顶的手臂

function build(pose) {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const put = (rows, x0, y0) =>
    rows.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch !== '.') g[y0 + dy][x0 + dx] = ch; }));

  const head = [...HEAD];
  head[5] = MOUTH[POSE_MOUTH[pose]];
  put(head, 8, 8);
  put(TORSO, 8, 16);
  put(LEGS, 8, 28);

  if (pose === 'idle') {                    // 双手自然垂下
    put(ARM, 4, 16); put(ARM, 16, 16);
  } else if (pose === 'wave') {             // 右手举过头顶打招呼
    put(ARM, 4, 16); put(ARM, 16, 6);
  } else if (pose === 'happy') {            // 双手向外下方张开
    put(ARM, 3, 18); put(ARM, 17, 18);
  } else if (pose === 'cheer') {            // 双手笔直举过头顶
    put(ARM, 4, 4); put(ARM, 16, 4);
  } else if (pose === 'oops') {             // 右手弯到头顶（L 形，必须与肩相连）
    put(ARM, 4, 16);
    put(rep('SSSS', 11), 16, 6);            // 竖段：从肩贴头右侧向上
    put(rep('SSSSSSS', 2), 13, 6);          // 横段：搭到头顶，与竖段相接
  }
  return g;
}

// 裁到内容边界后输出——各姿势宽度不同，运行时按底边对齐即可
function toPng(g) {
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] !== '.') {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const w = x1 - x0 + 1, h = y1 - y0 + 1;
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const col = C[g[y0 + y][x0 + x]];
    const o = (y * w + x) * 4;
    if (col) { buf[o] = col[0]; buf[o + 1] = col[1]; buf[o + 2] = col[2]; buf[o + 3] = 255; }
  }
  return { buf, w, h };
}

await mkdir(OUT, { recursive: true });
for (const pose of ['idle', 'wave', 'happy', 'cheer', 'oops']) {
  const { buf, w, h } = toPng(build(pose));
  const png = await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .png({ palette: true, effort: 10 })
    .toBuffer();
  await writeFile(join(OUT, `steve-${pose}.png`), png);
  console.log(`steve-${pose}.png  ${w}×${h}  ${png.length}B`);
}
