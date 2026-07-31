import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

// 像素字体（src/assets/fonts/ark-pixel-12px.woff2）是按本仓库当时的文案**子集化**过的，
// 只有 charset.txt 里列出的字形。加了新中文文案却没重跑子集化，
// 运行时会静默渲染成豆腐块 —— 这个测试把它变成响亮的失败。
//
// 修复方式见 README「像素字体再生成」。

const ROOT = join(__dirname, '..', '..');
const CHARSET = new Set(readFileSync(join(ROOT, 'src/assets/fonts/charset.txt'), 'utf8'));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(name) ? [p] : [];
  });
}

// 口诀由 DIGITS + hanzi() 在运行时拼装，这些字不一定以字面量形式出现在源码里
const RUNTIME_CHARS = '零一二三四五六七八九十得';

test('像素字体子集覆盖源码中全部中文字符', () => {
  const missing = new Map<string, string>(); // 字 → 首次出现的文件
  for (const file of sourceFiles(join(ROOT, 'src'))) {
    for (const ch of readFileSync(file, 'utf8')) {
      if (ch >= '一' && ch <= '鿿' && !CHARSET.has(ch) && !missing.has(ch)) {
        missing.set(ch, file.slice(ROOT.length + 1));
      }
    }
  }
  const detail = [...missing].map(([c, f]) => `${c}（${f}）`).join(' ');
  expect(missing.size, `字体子集缺 ${missing.size} 个字，需重跑子集化：${detail}`).toBe(0);
});

test('口诀运行时拼装用到的汉字都在子集里', () => {
  for (const ch of RUNTIME_CHARS) {
    expect(CHARSET.has(ch), `口诀用字「${ch}」不在字体子集里`).toBe(true);
  }
});

test('数字与基础拉丁字符在子集里', () => {
  for (const ch of '0123456789/:×+-=?！') {
    expect(CHARSET.has(ch), `「${ch}」不在字体子集里`).toBe(true);
  }
});
