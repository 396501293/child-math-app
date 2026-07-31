// 史蒂夫像素精灵生成器（手写网格 → PNG）+ 装备/配件叠加层 + 姿势偏移 manifest。
//
// 为什么手写而不是文生图：AI 版有三个治不好的毛病——衬衫杂色噪点、
// 手臂渐变阴影、姿势间体型漂移。史蒂夫本就是一堆纯色矩形，网格更准。
//
// 混搭渲染前提（spec §7）：头/躯干/腿在 24×40 画布坐标恒定
// （8,8 / 8,16 / 8,28，五姿势同），装备不覆盖手臂——所以一套装备
// 叠加层适配全部姿势。精灵按内容 bbox 裁剪，叠加定位需减姿势偏移，
// 偏移写入生成的 src/ui/components/steveMeta.ts（纯数据，单测校验）。
//
// 运行：node scripts/gen-steve.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'assets');
const META_OUT = join(ROOT, 'src', 'ui', 'components', 'steveMeta.ts');

// ── 调色板 ──
const C = {
  '.': null,
  H: [0x33, 0x22, 0x11], // 头发
  S: [0xb5, 0x8d, 0x6c], // 皮肤
  s: [0x9a, 0x76, 0x59], // 皮肤暗面 / 鼻
  W: [0xff, 0xff, 0xff], // 眼白
  B: [0x4b, 0x3d, 0xa8], // 瞳色
  M: [0x6b, 0x4a, 0x2c], // 络腮胡
  C: [0x27, 0xbd, 0xbd], // 衬衫
  c: [0x14, 0x8c, 0x8c], // 衬衫暗面
  P: [0x3d, 0x3d, 0xac], // 裤子
  p: [0x30, 0x30, 0x8c], // 裤子暗面
  O: [0x4a, 0x4a, 0x52], // 鞋
  // 装备四阶（亮/暗）
  L: [0x8a, 0x5a, 0x2b], l: [0x6b, 0x45, 0x20], // 皮革
  I: [0xc9, 0xc9, 0xc9], i: [0x8f, 0x8f, 0x8f], // 铁
  G: [0xf5, 0xcf, 0x2a], g: [0xc8, 0xa2, 0x06], // 金
  D: [0x8f, 0xf0, 0xe2], d: [0x4f, 0xc0, 0xb0], // 钻石（刻意调浅：#4fd9c7 与衬衫青撞色，穿没穿胸甲肉眼难分）
  // 配件用色
  N: [0xa8, 0x76, 0x44], n: [0x6b, 0x48, 0x24], // 木
  R: [0xd8, 0x5a, 0x3a], // 火橙 / 花瓣
  A: [0xe8, 0xb4, 0x3c], // 琥珀
  E: [0x3f, 0xbf, 0x5a], // 绿
  Y: [0xf0, 0xd8, 0x60], // 亮黄（小鸡）
  K: [0x8a, 0x8a, 0x92], // 灰（小猫）
  F: [0xe8, 0x6a, 0x50], // 红（鹦鹉）
};

const HEAD = [
  'HHHHHHHH',
  'HHHHHHHH',
  'HHHHHHHH',
  'HSSSSSSH',
  'HWBSSBWH',   // 眼
  'HSSssSSH',   // 鼻
  'HSMMMMSH',   // 胡（只占一行——两行会让头在小尺寸读成一坨深色）
  '.SSSSSS.',
];
const MOUTH = { flat: 'HSMMMMSH', smile: 'HSMSSMSH', open: 'HSMOOMSH', oops: 'HSSMMSSH' };
const POSE_MOUTH = { idle: 'flat', wave: 'smile', happy: 'smile', cheer: 'open', oops: 'oops' };
const POSES = ['idle', 'wave', 'happy', 'cheer', 'oops'];

const rep = (row, n) => Array(n).fill(row);
const TORSO = rep('CCCCCCCc', 12);
// 两条腿各 4 宽，中间留 1 列缝——连成一块会像裙子
const LEGS = [...rep('PPP.PPPP', 10), ...rep('OOO.OOOO', 2)];
// 短袖：上 4 行是青色袖子，下面才是皮肤
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

  if (pose === 'idle') { put(ARM, 4, 16); put(ARM, 16, 16); }
  else if (pose === 'wave') { put(ARM, 4, 16); put(ARM, 16, 6); }
  else if (pose === 'happy') { put(ARM, 3, 18); put(ARM, 17, 18); }
  else if (pose === 'cheer') { put(ARM, 4, 4); put(ARM, 16, 4); }
  else if (pose === 'oops') {
    put(ARM, 4, 16);
    put(rep('SSSS', 11), 16, 6);            // 竖段：从肩贴头右侧向上
    put(rep('SSSSSSS', 2), 13, 6);          // 横段：搭到头顶，与竖段相接
  }
  return g;
}

// ── 装备叠加层（画布坐标恒定，适配全姿势；spec §7）──
// helm 盖 y8–11（眼睛 y12 保持可见）；chest 盖躯干 y16–27；
// legs 盖 y28–35；boots 盖 y36–39（裤脚 + 鞋）。腿部件保留两腿间缝。
function armorGrid(tier, slot) {
  const [a, b] = { leather: ['L', 'l'], iron: ['I', 'i'], gold: ['G', 'g'], diamond: ['D', 'd'] }[tier];
  const solid = a.repeat(7) + b; // 右缘压暗一列做体积
  const legRow = `${a}${a}${b}.${a}${a}${a}${b}`;
  if (slot === 'helm') return { x: 8, y: 8, rows: [...rep(solid, 3), `${a}......${b}`] };
  if (slot === 'chest') return { x: 8, y: 16, rows: rep(solid, 12) };
  if (slot === 'legs') return { x: 8, y: 28, rows: rep(legRow, 8) };
  if (slot === 'boots') return { x: 8, y: 36, rows: rep(legRow, 4) };
  throw new Error(slot);
}

// ── 配件（小网格）──
const ACC_GRIDS = {
  'ac-torch': ['.R.', 'RAR', '.N.', '.N.', '.N.'],
  'ac-flowerpot': ['R..R', '.EE.', '.EE.', 'NNNN', '.NN.'],
  'ac-pickaxe': ['.IIII.', 'I....I', '..NN..', '..NN..', '..NN..'],
  'ac-rod': ['....N', '...N.', '..N..', '.N...', 'A....'],
  'ac-lantern': ['.NNN.', 'NAAAN', 'NAAAN', '.NNN.'],
  'ac-cake': ['RRRRR', 'WWWWW', 'NNNNN'],
  'ac-banner': ['NCCC', 'NCCC', 'NCCC', 'NCcC', 'N.C.', 'N...'],
  'ac-shield': ['NNNNN', 'NCCCN', 'NCCCN', '.NNN.', '..N..'],
  'ac-chick': ['.YY.', 'YYYY', '.AA.'],
  'ac-dog': ['N..N', 'NNNN', 'NNNN', 'N..N'],
  'ac-parrot': ['.FF.', 'FFEF', '.FF.', '.AA.'],
  'ac-cat': ['K..K', 'KKKK', 'KKKK', 'K..K'],
};
// 锚点（画布坐标）：hand 右手侧 / feet 左脚边 / shoulder 右肩上 / side 身右
const ACC_ANCHORS = {
  hand: { x: 19, y: 21 },
  feet: { x: 2, y: 34 },
  shoulder: { x: 17, y: 12 },
  side: { x: 21, y: 24 },
};
const ACC_ANCHOR_OF = {
  'ac-torch': 'hand', 'ac-pickaxe': 'hand', 'ac-rod': 'hand', 'ac-shield': 'hand',
  'ac-flowerpot': 'feet', 'ac-lantern': 'feet', 'ac-cake': 'feet',
  'ac-chick': 'feet', 'ac-dog': 'feet', 'ac-cat': 'feet',
  'ac-parrot': 'shoulder', 'ac-banner': 'side',
};

// ── 输出 ──
async function gridToPng(rows, file) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const buf = Buffer.alloc(w * h * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    const col = C[ch];
    if (col) { const o = (y * w + x) * 4; buf[o] = col[0]; buf[o + 1] = col[1]; buf[o + 2] = col[2]; buf[o + 3] = 255; }
  }));
  const png = await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .png({ palette: true, effort: 10 }).toBuffer();
  await writeFile(join(OUT, file), png);
  return { w, h, bytes: png.length };
}

await mkdir(OUT, { recursive: true });
const poseMeta = {};
for (const pose of POSES) {
  const g = build(pose);
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x] !== '.') {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const rows = [];
  for (let y = y0; y <= y1; y++) rows.push(g[y].slice(x0, x1 + 1).join(''));
  const { w, h, bytes } = await gridToPng(rows, `steve-${pose}.png`);
  poseMeta[pose] = { x0, y0, w, h };
  console.log(`steve-${pose}.png  ${w}×${h}  ${bytes}B`);
}

const pieceMeta = {};
for (const tier of ['leather', 'iron', 'gold', 'diamond']) {
  for (const slot of ['boots', 'helm', 'legs', 'chest']) {
    const id = `eq-${tier}-${slot}`;
    const { x, y, rows } = armorGrid(tier, slot);
    const { w, h, bytes } = await gridToPng(rows, `${id}.png`);
    pieceMeta[id] = { x, y, w, h };
    console.log(`${id}.png  ${w}×${h}  ${bytes}B`);
  }
}

const accMeta = {};
for (const [id, rows] of Object.entries(ACC_GRIDS)) {
  const { w, h, bytes } = await gridToPng(rows, `${id}.png`);
  accMeta[id] = { anchor: ACC_ANCHOR_OF[id], w, h };
  console.log(`${id}.png  ${w}×${h}  ${bytes}B`);
}

// ── 生成 steveMeta.ts（静态资产导入让 Vite 内容哈希生效）──
const eqIds = Object.keys(pieceMeta);
const accIds = Object.keys(accMeta);
const varName = (id) => id.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const meta = [
  '// AUTO-GENERATED by scripts/gen-steve.mjs — 手改无效，改生成器后重跑。',
  '// 姿势偏移：精灵按内容 bbox 裁剪，装备叠加层的画布坐标需减去该偏移。',
  ...POSES.map((p) => `import steve_${p} from '../../assets/steve-${p}.png';`),
  ...eqIds.map((id) => `import ${varName(id)} from '../../assets/${id}.png';`),
  ...accIds.map((id) => `import ${varName(id)} from '../../assets/${id}.png';`),
  '',
  'export interface PoseMeta { x0: number; y0: number; w: number; h: number }',
  `export const POSE_META: Record<string, PoseMeta> = ${JSON.stringify(poseMeta)};`,
  `export const POSE_SRC: Record<string, string> = { ${POSES.map((p) => `${p}: steve_${p}`).join(', ')} };`,
  `export const PIECE_META: Record<string, { x: number; y: number; w: number; h: number }> = ${JSON.stringify(pieceMeta)};`,
  `export const PIECE_SRC: Record<string, string> = { ${eqIds.map((id) => `'${id}': ${varName(id)}`).join(', ')} };`,
  `export const ACC_META: Record<string, { anchor: string; w: number; h: number }> = ${JSON.stringify(accMeta)};`,
  `export const ACC_SRC: Record<string, string> = { ${accIds.map((id) => `'${id}': ${varName(id)}`).join(', ')} };`,
  `export const ACC_ANCHORS: Record<string, { x: number; y: number }> = ${JSON.stringify(ACC_ANCHORS)};`,
  '',
].join('\n');
await writeFile(META_OUT, meta);
console.log('steveMeta.ts written');
