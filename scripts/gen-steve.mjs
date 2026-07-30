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

// Minecraft 经典配色（对着原版皮肤取的，不是凭印象）
const C = {
  '.': null,
  H: [0x33, 0x22, 0x11], // 头发
  S: [0xb5, 0x8d, 0x6c], // 皮肤
  s: [0x9a, 0x76, 0x59], // 皮肤暗面 / 鼻
  W: [0xff, 0xff, 0xff], // 眼白
  B: [0x4b, 0x3d, 0xa8], // 瞳色（史蒂夫是蓝紫，不是纯蓝）
  M: [0x6b, 0x4a, 0x2c], // 络腮胡 —— 史蒂夫最标志性的特征
  C: [0x27, 0xbd, 0xbd], // 衬衫 / 短袖（史蒂夫的青比这更亮一档）
  c: [0x14, 0x8c, 0x8c], // 衬衫暗面
  P: [0x3d, 0x3d, 0xac], // 裤子
  p: [0x30, 0x30, 0x8c], // 裤子暗面
  O: [0x4a, 0x4a, 0x52], // 鞋
};

// 头 8×8。史蒂夫的脸靠三样东西被认出来：头发方块、蓝紫眼睛、
// **下半张脸那片络腮胡**。前一版漏了胡子和鼻子，所以谁都不像。
//   y0–2 头发满行；y3 只剩两侧鬓角；y4 眼；y5 鼻；y6–7 络腮胡
const HEAD = [
  'HHHHHHHH',
  'HHHHHHHH',
  'HHHHHHHH',
  'HSSSSSSH',
  'HWBSSBWH',   // 眼：外白内蓝紫
  'HSSssSSH',   // 鼻：中间两格暗肤色
  'HSMMMMSH',   // 胡：只占一行（占两行会让整个头在小尺寸下读成一坨深色，
                //     而真史蒂夫在远处是「深发 + 亮脸」的高对比）
  '.SSSSSS.',   // 下巴留亮肤色
];
// 情绪只改胡子中间那两格（张嘴 / 抿嘴），不动轮廓——保证五姿势是同一张脸
const MOUTH = {
  flat:  'HSMMMMSH',
  smile: 'HSMSSMSH',
  open:  'HSMOOMSH',
  oops:  'HSSMMSSH',
};
const POSE_MOUTH = { idle: 'flat', wave: 'smile', happy: 'smile', cheer: 'open', oops: 'oops' };

const rep = (row, n) => Array(n).fill(row);
// 衬衫：右侧一列压暗做体积，不要中间竖缝（那会读成拉链）
const TORSO = [...rep('CCCCCCCc', 12)];
// 两条腿各 4 宽，中间留 1 列缝——连成一块会像裙子；底部两行是鞋
const LEGS = [...rep('PPP.PPPP', 5), ...rep('PPp.pPPP', 5), ...rep('OOO.OOOO', 2)];
// 手臂：史蒂夫穿短袖 —— 上 4 行是青色袖子，下 8 行才是皮肤。
// 前一版整条画成皮肤，等于给他穿了无袖背心。
const ARM = [...rep('CCCC', 4), ...rep('SSsS', 7), ...rep('SSSS', 1)];

const W = 24, H = 40; // 上方留 8 行给举过头顶的手臂

function build(pose) {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const put = (rows, x0, y0) =>
    rows.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch !== '.') g[y0 + dy][x0 + dx] = ch; }));

  const head = [...HEAD];
  head[6] = MOUTH[POSE_MOUTH[pose]]; // 索引 6 = 胡子行；写成 5 会盖掉鼻子并让胡子变两行
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
