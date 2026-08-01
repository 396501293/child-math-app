// 行内小图标的像素精灵（手写网格 → PNG）。
//
// 与 gen-steve.mjs 同源：这些图标最小渲染到 17px，任何文生图产物在这个
// 尺寸都会糊；而它们本身就是简单几何形，直接写网格既可控又极小（每张几百字节）。
//
// 名字与 src/ui/components/icoAssets.ts 的 ICO_NAMES 一一对应，
// 少一个会被 tests/ui/steveAssets.test.ts 拦下。
//
// 运行：node scripts/gen-ico.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets');

const C = {
  '.': null,
  D: [0x2a, 0x22, 0x1a], // 深轮廓
  W: [0xef, 0xe6, 0xd2], // 米白
  A: [0xe8, 0xb4, 0x3c], // 琥珀 / 金
  a: [0x9a, 0x70, 0x18], // 琥珀暗
  G: [0xb0, 0xb0, 0xb0], // 石灰
  g: [0x6a, 0x6a, 0x6a], // 石灰暗
  R: [0xd8, 0x5a, 0x3a], // 火橙
  r: [0xa8, 0x35, 0x20], // 火暗
  N: [0xa8, 0x76, 0x44], // 木
  E: [0x3f, 0xbf, 0x5a], // 绿宝石
  n: [0x6b, 0x48, 0x24], // 木暗
  C: [0x3d, 0xc8, 0xc8], // 青
};

// 16×16 网格。每行 16 字符，共 16 行。
const ICONS = {
  // 镐：收回工具（替代 ⛏ emoji——iOS 彩色字形与像素风冲突，审查 D5）。
  // 弧形镐头 + 斜插木柄，16px 下形体极简。
  pickaxe: [
    '................',
    '......ggggg.....',
    '....ggGGGGGgg...',
    '...gGGg....gGGg.',
    '..gGGg......gGGg',
    '..gGg........gGg',
    '..gG....NN....Gg',
    '..g....NNn......',
    '......NNn.......',
    '.....NNn........',
    '....NNn.........',
    '...NNn..........',
    '..NNn...........',
    '.NNn............',
    '................',
    '................',
  ],
  // 喇叭：左侧音箱 + 右侧三道声波（最小渲染 17px，形必须极简）
  sound: [
    '................',
    '................',
    '............A...',
    '..........A.A...',
    '.......WW.A.A.A.',
    '......WWW.A.A.A.',
    '..WWWWWW..A.A.A.',
    '..WWWWWW..A.A.A.',
    '..WWWWWW..A.A.A.',
    '..WWWWWW..A.A.A.',
    '......WWW.A.A.A.',
    '.......WW.A.A.A.',
    '..........A.A...',
    '............A...',
    '................',
    '................',
  ],
  // 挂锁：锁梁 + 锁体 + 钥匙孔
  lock: [
    '................',
    '.....gggg.......',
    '....g....g......',
    '....g....g......',
    '....g....g......',
    '..AAAAAAAAAA....',
    '..AAAAAAAAAA....',
    '..AAAAaaAAAA....',
    '..AAAAaaAAAA....',
    '..AAAAaAaAAA....',
    '..AAAAaAaAAA....',
    '..AAAAAAAAAA....',
    '..AAAAAAAAAA....',
    '................',
    '................',
    '................',
  ],
  // 齿轮：实心环 + 四组方齿（前一版齿太细，26px 下读成十字）
  gear: [
    '................',
    '.....GG..GG.....',
    '.....GG..GG.....',
    '..GGGGGGGGGGGG..',
    '..GGGGGGGGGGGG..',
    '.GGGGg....gGGGG.',
    'GGGGG......GGGGG',
    'GGGGG......GGGGG',
    '.GGGGg....gGGGG.',
    '..GGGGGGGGGGGG..',
    '..GGGGGGGGGGGG..',
    '.....GG..GG.....',
    '.....GG..GG.....',
    '................',
    '................',
    '................',
  ],
  // 奖杯（替代 🎉）：杯身 + 双耳 + 底座
  party: [
    '................',
    '..AAAAAAAAAA....',
    '.AAAAAAAAAAAA...',
    'A.AAAAAAAAAA.A..',
    'A.AAAAAAAAAA.A..',
    'A..AAAAAAAA..A..',
    'A..AAAAAAAA..A..',
    '.A..AAAAAA..A...',
    '.....AAAA.......',
    '.....aaaa.......',
    '.....aaaa.......',
    '...aaaaaaaa.....',
    '..aaaaaaaaaa....',
    '................',
    '................',
    '................',
  ],
  // 星芒：四角星 + 两颗小星
  sparkle: [
    '................',
    '.......A........',
    '.......A....A...',
    '......AAA..AAA..',
    '......AAA...A...',
    '.....AAAAA......',
    '..AAAAAAAAAA....',
    '.AAAAAAAAAAA....',
    '..AAAAAAAAAA....',
    '.....AAAAA......',
    '......AAA.......',
    '..A...AAA.......',
    '.AAA...A........',
    '..A....A........',
    '................',
    '................',
  ],
  // 火苗：外橙内亮
  fire: [
    '................',
    '.......R........',
    '......RR........',
    '.....RRRR.......',
    '....RRRRRR......',
    '....RRAARRR.....',
    '...RRRAAARR.....',
    '...RRAAAARR.....',
    '..RRRAAAARRR....',
    '..RRAAAAAARR....',
    '..RRAAAAAARR....',
    '..rRRAAAARRr....',
    '...rRRRRRRr.....',
    '....rrrrrr......',
    '................',
    '................',
  ],
  // 小船：三角帆 + 木船身
  boat: [
    '................',
    '........D.......',
    '.......WD.......',
    '......WWD.......',
    '.....WWWD.......',
    '....WWWWD.......',
    '...WWWWWD.......',
    '..WWWWWWD.......',
    '................',
    '.NNNNNNNNNNN....',
    '.NNNNNNNNNNN....',
    '..nnnnnnnnn.....',
    '...nnnnnnn......',
    '................',
    '................',
    '................',
  ],
  // ── 三个模式按钮图标（渲染到 30px，Map.tsx 直接 import）──
  // 无尽：粗笔画 ∞（细线在 30px 下会断）
  'mode-endless': [
    '................',
    '................',
    '................',
    '..AAAA...AAAA...',
    '.AA..AA.AA..AA..',
    '.AA...AAA...AA..',
    '.AA...AAA...AA..',
    '.AA..AA.AA..AA..',
    '..AAAA...AAAA...',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................',
  ],
  // 限时：木框沙漏 + 琥珀流沙
  'mode-timed': [
    '................',
    '..NNNNNNNNNN....',
    '..NNNNNNNNNN....',
    '...AAAAAAAA.....',
    '....AAAAAA......',
    '.....AAAA.......',
    '......AA........',
    '......AA........',
    '.....A..A.......',
    '....A....A......',
    '...AAAAAAAA.....',
    '..NNNNNNNNNN....',
    '..NNNNNNNNNN....',
    '................',
    '................',
    '................',
  ],
  // 九九星图：3×3 格盘，金格 = 已点亮
  'mode-chart': [
    '................',
    '..AAA.AAA.WWW...',
    '..AAA.AAA.WWW...',
    '..AAA.AAA.WWW...',
    '................',
    '..AAA.WWW.AAA...',
    '..AAA.WWW.AAA...',
    '..AAA.WWW.AAA...',
    '................',
    '..WWW.AAA.AAA...',
    '..WWW.AAA.AAA...',
    '..WWW.AAA.AAA...',
    '................',
    '................',
    '................',
    '................',
  ],
  'ore-coal': [
    'GGGGGGGGGGGG',
    'GDDGGGGGDDGG',
    'GDDGGGGGDDGG',
    'GGGGGDDGGGGG',
    'GGGGGDDGGGGG',
    'GDDGGGGGGDDG',
    'GDDGGGGGGDDG',
    'GGGGDDGGGGGG',
    'GGGGDDGGGDDG',
    'GGDGGGGGGDDG',
    'GGDDGGGGGGGG',
    'GGGGGGGGGGGG',
  ],
  'ore-iron': [
    'GGGGGGGGGGGG',
    'GWWGGGGGWWGG',
    'GWWGGGGGWWGG',
    'GGGGGWWGGGGG',
    'GGGGGWWGGGGG',
    'GWWGGGGGGWWG',
    'GWWGGGGGGWWG',
    'GGGGWWGGGGGG',
    'GGGGWWGGGWWG',
    'GGWGGGGGGWWG',
    'GGWWGGGGGGGG',
    'GGGGGGGGGGGG',
  ],
  'ore-gold': [
    'GGGGGGGGGGGG',
    'GAAGGGGGAAGG',
    'GAAGGGGGAAGG',
    'GGGGGAAGGGGG',
    'GGGGGAAGGGGG',
    'GAAGGGGGGAAG',
    'GAAGGGGGGAAG',
    'GGGGAAGGGGGG',
    'GGGGAAGGGAAG',
    'GGAGGGGGGAAG',
    'GGAAGGGGGGGG',
    'GGGGGGGGGGGG',
  ],
  'ore-diamond': [
    'GGGGGGGGGGGG',
    'GCCGGGGGCCGG',
    'GCCGGGGGCCGG',
    'GGGGGCCGGGGG',
    'GGGGGCCGGGGG',
    'GCCGGGGGGCCG',
    'GCCGGGGGGCCG',
    'GGGGCCGGGGGG',
    'GGGGCCGGGCCG',
    'GGCGGGGGGCCG',
    'GGCCGGGGGGGG',
    'GGGGGGGGGGGG',
  ],
  'ore-emerald': [
    'GGGGGGGGGGGG',
    'GEEGGGGGEEGG',
    'GEEGGGGGEEGG',
    'GGGGGEEGGGGG',
    'GGGGGEEGGGGG',
    'GEEGGGGGGEEG',
    'GEEGGGGGGEEG',
    'GGGGEEGGGGGG',
    'GGGGEEGGGEEG',
    'GGEGGGGGGEEG',
    'GGEEGGGGGGGG',
    'GGGGGGGGGGGG',
  ],
  // 旋转平板：横屏设备 + 上方一道带箭头的弧
  // （前一版是个点状圆环套方块，读不出「旋转」；箭头必须有明确的头）
  rotate: [
    '................',
    '.......AAAA.....',
    '.....AA....AA...',
    '....A........A..',
    '..AAA.........A.',
    '...A..........A.',
    '................',
    '..GGGGGGGGGGGG..',
    '..GWWWWWWWWWWG..',
    '..GWWWWWWWWWWG..',
    '..GWWWWWWWWWWG..',
    '..GWWWWWWWWWWG..',
    '..GGGGGGGGGGGG..',
    '................',
    '................',
    '................',
  ],
};

function toPng(rows) {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  const at = (x, y) => (rows[y][x] ?? '.');
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (at(x, y) !== '.') {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const buf = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
    const col = C[at(x0 + x, y0 + y)];
    const o = (y * cw + x) * 4;
    if (col) { buf[o] = col[0]; buf[o + 1] = col[1]; buf[o + 2] = col[2]; buf[o + 3] = 255; }
  }
  return { buf, w: cw, h: ch };
}

await mkdir(OUT, { recursive: true });
for (const [name, rows] of Object.entries(ICONS)) {
  const { buf, w, h } = toPng(rows);
  const png = await sharp(buf, { raw: { width: w, height: h, channels: 4 } })
    .png({ palette: true, effort: 10 })
    .toBuffer();
  await writeFile(join(OUT, `ico-${name}.png`), png);
  console.log(`ico-${name}.png  ${w}×${h}  ${png.length}B`);
}
