#!/usr/bin/env bash
# 重新生成像素字体子集。
#
# 什么时候要跑：`npm test` 报「字体子集缺 N 个字」时——那说明源码里加了
# 新中文，而字体里没有对应字形，不重跑会在界面上渲染成豆腐块。
#
# 为什么不接进构建：子集化依赖 Python 的 fonttools，而构建必须能在
# 只有 Node 的 CI 上跑通（同 gen-assets.mjs 的理由）。产物已入库，
# 平时无需执行。
#
# 用法：bash scripts/subset-font.sh
set -euo pipefail
cd "$(dirname "$0")/.."

FONT_VER='2026.07.20'
FONT_URL="https://github.com/TakWolf/ark-pixel-font/releases/download/${FONT_VER}/ark-pixel-font-${FONT_VER%%.*}px-proportional-otf.woff2-v${FONT_VER}.zip"
FONT_URL="https://github.com/TakWolf/ark-pixel-font/releases/download/${FONT_VER}/ark-pixel-font-12px-proportional-otf.woff2-v${FONT_VER}.zip"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "── 1/4 准备 Python 环境（fonttools + brotli）──"
python3 -m venv "$WORK/venv"
"$WORK/venv/bin/pip" install --quiet fonttools brotli

echo "── 2/4 下载方舟像素字体 ${FONT_VER}（OFL）──"
curl -sL -o "$WORK/ark.zip" "$FONT_URL"
unzip -oq "$WORK/ark.zip" -d "$WORK/ark"
SRC=$(find "$WORK/ark" -name '*zh_cn*.woff2' | head -1)
[ -n "$SRC" ] || { echo "❌ 未找到 zh_cn 字体文件"; exit 1; }

echo "── 3/4 扫描源码字符集 ──"
"$WORK/venv/bin/python" - <<'PY'
import pathlib
chars = set()
# 扫全部源码（含注释——宁多勿少，缺字会渲染成豆腐块）
for p in list(pathlib.Path('src').rglob('*.ts')) + list(pathlib.Path('src').rglob('*.tsx')) + [pathlib.Path('index.html')]:
    chars |= set(p.read_text(encoding='utf-8'))
# 口诀由 DIGITS + hanzi() 运行时拼装，字面量里未必出现
chars |= set('零一二三四五六七八九十得')
chars |= set(''.join(chr(c) for c in range(32, 127)))
chars |= set('·—…“”‘’、。，！？：；（）《》×÷＋－★☆✕‹›←→▶◀')
chars = {c for c in chars if c.isprintable() and not c.isspace()} | {' '}
pathlib.Path('src/assets/fonts/charset.txt').write_text(''.join(sorted(chars)), encoding='utf-8')
cjk = [c for c in chars if '一' <= c <= '鿿']
print(f'   字符 {len(chars)} 个（中文 {len(cjk)}）')
PY

echo "── 4/4 子集化 ──"
"$WORK/venv/bin/pyftsubset" "$SRC" \
  --text-file=src/assets/fonts/charset.txt \
  --output-file=src/assets/fonts/ark-pixel-12px.woff2 \
  --flavor=woff2 --layout-features='' --no-hinting --desubroutinize

BEFORE=$(stat -f%z "$SRC" 2>/dev/null || stat -c%s "$SRC")
AFTER=$(stat -f%z src/assets/fonts/ark-pixel-12px.woff2 2>/dev/null || stat -c%s src/assets/fonts/ark-pixel-12px.woff2)
printf '   %dKB → %dKB\n\n✅ 完成。跑 npm test 确认守卫测试通过。\n' $((BEFORE/1024)) $((AFTER/1024))
