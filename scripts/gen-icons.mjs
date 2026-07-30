// 生成 PWA / apple-touch 图标：把史蒂夫精灵合成到夜色底上。
// 素材源 src/assets/steve-idle.png（由 scripts/gen-assets.mjs 生成）。
// 运行：node scripts/gen-icons.mjs
//
// 主屏图标必须与应用内角色是同一个人，否则从桌面点进来会认知断裂。
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const BG = '#12333E';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcIcon = join(root, 'src', 'assets', 'steve-idle.png');
const outDir = join(root, 'public', 'icons');

await mkdir(outDir, { recursive: true });

// maskable 安全区：图标内容需收在中心 80% 内，避免被各平台裁切成圆形时切到角色。
const CONTENT_RATIO = 0.62; // 史蒂夫是竖长人形，比圆脸角色要留更多边

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];

for (const [name, size] of targets) {
  const inner = Math.round(size * CONTENT_RATIO);
  // ⚠️ 必须 kernel: 'nearest' —— 默认 lanczos 会把 16×32 的像素精灵插值成糊图
  const steve = await sharp(srcIcon)
    .resize(inner, inner, { fit: 'inside', kernel: 'nearest', withoutEnlargement: false })
    .toBuffer();
  const { width, height } = await sharp(steve).metadata();

  // 直角底：像素风不预先倒角，iOS 会自己裁圆角。
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <rect width="${size}" height="${size}" rx="0" ry="0" fill="${BG}"/>
     </svg>`,
  );

  await sharp(bg)
    .composite([{ input: steve, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }])
    // 调色板量化：素材是扁平插画、色数有限，PNG-8 能压掉约 3/4 体积且肉眼无损。
    // 图标进 PWA 预缓存，体积直接影响首次安装的下载量。
    .png({ palette: true, quality: 90, effort: 10 })
    .toFile(join(outDir, name));
  console.log(`wrote ${name} (${size}×${size})`);
}
