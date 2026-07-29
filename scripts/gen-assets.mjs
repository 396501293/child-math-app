// 美术素材生成工具（agnes-ai 文生图）。
//
// ⚠️ 这是一次性开发工具，**不属于构建流程**：`npm run build` 与 CI 都不执行它。
//    构建绝不能依赖外部 API——本仓库的部署门槛是全量测试，多一个外部依赖就多一个卡死点。
//    产物（src/assets/*.webp）直接入库。
//
// 用法：
//   AGNES_API_KEY=sk-xxx node scripts/gen-assets.mjs              # 全部重出
//   AGNES_API_KEY=sk-xxx node scripts/gen-assets.mjs mascot-idle  # 只出指定项
//
// 密钥存于 ~/.secrets/personal.md，取法：
//   AGNES_API_KEY=$(grep -m1 '^- API Key:' ~/.secrets/personal.md | sed 's/^- API Key: //')
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ENDPOINT = 'https://apihub.agnes-ai.com/v1/images/generations';
const MODEL = 'agnes-image-2.1-flash';

// 统一风格前缀——保证任何时候重出都是同一支笔画的。
const STYLE =
  'Animal Crossing New Horizons UI art style, cute kawaii flat vector illustration, ' +
  'thick warm brown outline, soft cream and warm pastel palette, gentle inner shading, ' +
  'rounded chunky shapes, no text, no letters, centered single subject, plain pure white background';

// 角色固定描述——保证四个姿势是同一只。
const CHAR =
  'a small round chubby mascot creature with a cream white body, big round black dot eyes ' +
  'with a white highlight, pink oval blush cheeks, one small green leaf sprouting on top of ' +
  'its head, short stubby arms and legs';

// name → { prompt, edge }。edge 为输出长边像素。
const ASSETS = {
  'mascot-idle': { edge: 400, prompt: `${CHAR} standing calmly, arms relaxed at its sides, friendly gentle smile, front view` },
  'mascot-happy': { edge: 400, prompt: `${CHAR} smiling brightly with both short arms raised halfway in a small happy gesture, front view` },
  'mascot-wave': { edge: 400, prompt: `${CHAR} waving one arm in greeting, head tilted slightly, cheerful open smile, front view` },
  'mascot-cheer': { edge: 400, prompt: `${CHAR} jumping joyfully in mid air with both arms stretched high above its head, eyes closed in a big happy smile, three small golden sparkle stars floating around it` },
  // 答错反馈：歪头「哎呀」，**不要哭**——4–7 岁的错误反馈应是「再试一次」而非挫败。
  'mascot-oops': { edge: 400, prompt: `${CHAR} tilting its head with a small sheepish "oops" expression, eyebrows slightly raised, one arm scratching the back of its head, gentle apologetic smile, NOT crying, NOT sad` },
  // 极简剪影——这个图标会缩到 30px 放进按钮，任何内部纹理都会糊成一团。
  'icon-endless': { edge: 256, prompt: 'a bold simple infinity symbol made of one thick smooth rope loop, flat silhouette, NO internal texture, NO fibers, one small golden star at the crossing point, game mode icon' },
  'icon-timed': { edge: 256, prompt: 'a chubby rounded hourglass with a wooden frame, glowing golden sand falling inside, small motion sparkles, game mode icon' },
  'icon-star': { edge: 256, prompt: 'a 3x3 grid of small rounded squares, some tiles glowing warm gold and some dim cream, arranged as a little constellation board, game mode icon' },
  'node-locked': { edge: 256, prompt: 'a small round wooden signpost plaque with a closed brass padlock on it, weathered warm wood, level marker' },
  'app-icon': { edge: 512, prompt: `${CHAR} HEAD AND FACE ONLY, close-up portrait cropped at the neck, big friendly smile, facing forward, filling the whole frame` },
};

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets');

// ── 白底 → 透明 ──
// agnes-ai 不返回 alpha 通道（传 background:"transparent" 仍是 RGB），必须自行抠。
// 关键：**不能按颜色全局删白**——素材内部大量使用米白（角色身体本身就是米白），
// 全局删会把角色挖空。只能从画布四边做连通域洪泛：角色被粗棕描边围死，填充进不去。
// 容差取 52 是为了连带吃掉模型强行加的脚下浅灰投影（提示词写 no shadow 无效）。
const TOL = 52;

async function dewhite(buf, edge) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;

  const isBg = (i) => {
    const o = i * ch;
    return data[o] >= 255 - TOL && data[o + 1] >= 255 - TOL && data[o + 2] >= 255 - TOL;
  };

  const bg = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) {
    for (const y of [0, h - 1]) {
      const i = y * w + x;
      if (!bg[i] && isBg(i)) { bg[i] = 1; stack.push(i); }
    }
  }
  for (let y = 0; y < h; y++) {
    for (const x of [0, w - 1]) {
      const i = y * w + x;
      if (!bg[i] && isBg(i)) { bg[i] = 1; stack.push(i); }
    }
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w, y = (i / w) | 0;
    if (x > 0)     { const n = i - 1; if (!bg[n] && isBg(n)) { bg[n] = 1; stack.push(n); } }
    if (x < w - 1) { const n = i + 1; if (!bg[n] && isBg(n)) { bg[n] = 1; stack.push(n); } }
    if (y > 0)     { const n = i - w; if (!bg[n] && isBg(n)) { bg[n] = 1; stack.push(n); } }
    if (y < h - 1) { const n = i + w; if (!bg[n] && isBg(n)) { bg[n] = 1; stack.push(n); } }
  }

  const alpha = Buffer.alloc(w * h);
  for (let i = 0; i < w * h; i++) alpha[i] = bg[i] ? 0 : 255;

  // 羽化：轻模糊软化洪泛留下的硬锯齿，再用 linear 拉回对比避免整体半透明。
  // ⚠️ 两个坑：
  //   1. 必须 .raw()，否则 toBuffer() 返回编码后的图片字节而非像素数据；
  //   2. sharp 会把单通道图提升成 sRGB 三通道，必须读 info.channels 按实际步长索引，
  //      否则步长错位会把 mask 读成乱码（表现为包围盒被压扁成一条）。
  const { data: mRaw, info: mInfo } = await sharp(alpha, { raw: { width: w, height: h, channels: 1 } })
    .blur(1)
    .linear(1.6, -64)
    .raw()
    .toBuffer({ resolveWithObject: true });

  const mCh = mInfo.channels;
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) mask[i] = mRaw[i * mCh];

  for (let i = 0; i < w * h; i++) data[i * ch + 3] = mask[i];

  // 自己算内容包围盒：sharp 的 .trim() 依赖角像素取色，对 RGBA 行为不够确定。
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (mask[y * w + x] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error('抠图后内容为空——检查素材是否整张接近白色');

  return sharp(data, { raw: { width: w, height: h, channels: ch } })
    .extract({ left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 })
    .resize(edge, edge, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 86 })
    .toBuffer();
}

async function generate(name, key) {
  const { prompt, edge } = ASSETS[name];
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, n: 1, size: '1024x1024', prompt: `${prompt}, ${STYLE}` }),
  });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);

  const url = (await res.json())?.data?.[0]?.url;
  if (!url) throw new Error(`${name}: 响应中无图片 URL`);

  const img = Buffer.from(await (await fetch(url)).arrayBuffer());
  // KEEP_RAW=1 保留生成原图，便于排查抠图失败（模型偶尔给出低对比或非纯白背景）。
  if (process.env.KEEP_RAW) {
    await mkdir(join(OUT_DIR, '..', '..', '.raw-assets'), { recursive: true });
    await writeFile(join(OUT_DIR, '..', '..', '.raw-assets', `${name}.png`), img);
  }
  const webp = await dewhite(img, edge);
  const out = join(OUT_DIR, `${name}.webp`);
  await writeFile(out, webp);
  console.log(`✓ ${name}  ${(webp.length / 1024).toFixed(0)}KB`);
}

const key = process.env.AGNES_API_KEY;
if (!key) {
  console.error('缺 AGNES_API_KEY 环境变量。密钥存于 ~/.secrets/personal.md：');
  console.error("  AGNES_API_KEY=$(grep -m1 '^- API Key:' ~/.secrets/personal.md | sed 's/^- API Key: //') node scripts/gen-assets.mjs");
  process.exit(1);
}

const targets = process.argv.slice(2);
const names = targets.length ? targets : Object.keys(ASSETS);
for (const n of names) {
  if (!ASSETS[n]) {
    console.error(`未知素材: ${n}\n可用: ${Object.keys(ASSETS).join(', ')}`);
    process.exit(1);
  }
}

await mkdir(OUT_DIR, { recursive: true });
// 并发 4 路：单张约 22 秒，全量串行要 4 分钟。
for (let i = 0; i < names.length; i += 4) {
  await Promise.all(names.slice(i, i + 4).map((n) => generate(n, key).catch((e) => console.error(`✗ ${e.message}`))));
}
