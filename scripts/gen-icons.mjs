// 生成 PWA / apple-touch 图标：用 sharp 把内嵌的几何吉祥物 SVG 光栅化为 PNG。
// 吉祥物：琥珀 #F2A541 圆角方脸 + 深色 #12333E 眼 + 白高光 + 下弯微笑；背景 #12333E 圆角。
// 与 src/ui/components/Mascot.tsx 造型一致。运行：node scripts/gen-icons.mjs
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const BG = '#12333E';
const AMBER = '#F2A541';
const DARK = '#12333E';

// viewBox 512×512。face 300×280 居中偏上；眼/高光/嘴按 Mascot 造型等比放大。
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" ry="112" fill="${BG}"/>
  <circle cx="256" cy="262" r="190" fill="${AMBER}" opacity="0.12"/>
  <rect x="106" y="116" width="300" height="280" rx="118" ry="112" fill="${AMBER}"/>
  <circle cx="195" cy="231" r="35" fill="${DARK}"/>
  <circle cx="317" cy="231" r="35" fill="${DARK}"/>
  <circle cx="181" cy="219" r="13" fill="#ffffff"/>
  <circle cx="331" cy="219" r="13" fill="#ffffff"/>
  <path d="M 213 308 H 299 V 330 Q 299 348 281 348 H 231 Q 213 348 213 330 Z" fill="${DARK}"/>
</svg>`;

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
await mkdir(outDir, { recursive: true });

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
];

for (const [name, size] of targets) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(outDir, name));
  console.log(`wrote ${name} (${size}×${size})`);
}
