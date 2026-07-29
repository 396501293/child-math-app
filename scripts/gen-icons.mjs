// 生成 PWA / apple-touch 图标：把吉祥物素材合成到夜色圆角底上。
// 素材源 src/assets/app-icon.webp（由 scripts/gen-assets.mjs 生成）。
// 运行：node scripts/gen-icons.mjs
//
// 早期版本是把内嵌的几何吉祥物 SVG 光栅化——那个造型已被手绘素材取代，
// 留着会导致主屏图标与应用内吉祥物长得不一样。
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const BG = '#12333E';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcIcon = join(root, 'src', 'assets', 'app-icon.webp');
const outDir = join(root, 'public', 'icons');

await mkdir(outDir, { recursive: true });

// maskable 安全区：图标内容需收在中心 80% 内，避免被各平台裁切成圆形时切到角色。
const CONTENT_RATIO = 0.78;

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];

for (const [name, size] of targets) {
  const inner = Math.round(size * CONTENT_RATIO);
  const mascot = await sharp(srcIcon)
    .resize(inner, inner, { fit: 'inside', withoutEnlargement: false })
    .toBuffer();
  const { width, height } = await sharp(mascot).metadata();

  // 圆角底：SVG 铺底再合成，圆角半径取 size 的 22%（与 iOS 图标观感接近）。
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <rect width="${size}" height="${size}" rx="${Math.round(size * 0.22)}" ry="${Math.round(size * 0.22)}" fill="${BG}"/>
     </svg>`,
  );

  await sharp(bg)
    .composite([{ input: mascot, left: Math.round((size - width) / 2), top: Math.round((size - height) / 2) }])
    // 调色板量化：素材是扁平插画、色数有限，PNG-8 能压掉约 3/4 体积且肉眼无损。
    // 图标进 PWA 预缓存，体积直接影响首次安装的下载量。
    .png({ palette: true, quality: 90, effort: 10 })
    .toFile(join(outDir, name));
  console.log(`wrote ${name} (${size}×${size})`);
}
