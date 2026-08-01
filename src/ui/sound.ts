// 轻软音效层（审查 C1，建造评审小规则③「放置/收回音效轻软」批而未建的补建）。
// WebAudio 运行时合成：零素材、零网络请求，方波/三角波天然是像素风的声音质感。
//
// 边界（无惩罚铁律）：
//   - 答错不配任何音效（只有语音「再试一次」）
//   - 限时模式不加任何时间相关音效（倒计时无声）
// 音量刻意压低——音效是质感衬底，不与 TTS 抢注意力。

let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null; // 无 WebAudio 环境（旧 WebView/测试）：静默降级
  }
}

// 单音 + 指数衰减包络；delay 用于组装短乐句
function tone(
  freq: number,
  dur: number,
  opts: { type?: OscillatorType; vol?: number; delay?: number } = {},
): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + (opts.delay ?? 0);
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = opts.type ?? 'square';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(opts.vol ?? 0.08, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur);
}

// 全部 6 个音（审查 C1 上限）：答对叮 / 放块嗒 / 收回啵 / 点星闪 / 制作成 / 集齐和弦
export const sfx = {
  right: () => {
    tone(880, 0.09, { vol: 0.05 });
    tone(1318, 0.12, { delay: 0.07, vol: 0.04 });
  },
  place: () => tone(220, 0.06, { type: 'triangle', vol: 0.1 }),
  reclaim: () => {
    tone(330, 0.05, { type: 'triangle', vol: 0.08 });
    tone(196, 0.09, { delay: 0.05, type: 'triangle', vol: 0.08 });
  },
  star: () => {
    tone(1568, 0.1, { vol: 0.045 });
    tone(2093, 0.16, { delay: 0.08, vol: 0.035 });
  },
  craft: () => {
    tone(523, 0.08, { type: 'triangle', vol: 0.09 });
    tone(784, 0.14, { delay: 0.08, type: 'triangle', vol: 0.08 });
  },
  chord: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.04, delay: i * 0.06 }));
  },
} as const;
