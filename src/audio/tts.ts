let voice: SpeechSynthesisVoice | null = null;

// 可用性变化订阅者（🔊 图标置灰用）：voiceschanged 后重挑声音并广播。
const availabilityListeners = new Set<() => void>();

function pickVoice(): void {
  const list = speechSynthesis.getVoices();
  voice = list.find(v => v.lang.startsWith('zh') && v.localService)
       ?? list.find(v => v.lang.startsWith('zh')) ?? null;
  availabilityListeners.forEach(fn => fn());
}

export function initTTS(): void {
  if (!('speechSynthesis' in globalThis)) { return; }
  pickVoice();
  speechSynthesis.addEventListener('voiceschanged', pickVoice); // iOS 首次列表为空
}

export const ttsAvailable = (): boolean => !!voice;

// 订阅可用性变化，返回取消订阅函数（App 用一个 useState 刷新 🔊 灰态）。
export function onAvailabilityChange(fn: () => void): () => void {
  availabilityListeners.add(fn);
  return () => { availabilityListeners.delete(fn); };
}

export function speak(text: string, opts: { interrupt?: boolean } = {}): void {
  if (!voice) return;                                  // 静默降级
  if (opts.interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice; u.lang = voice.lang; u.rate = 0.9;
  speechSynthesis.speak(u);
}

export const stopTTS = (): void => { if ('speechSynthesis' in globalThis) speechSynthesis.cancel(); };
