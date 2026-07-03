let voice: SpeechSynthesisVoice | null = null;

function pickVoice(): void {
  const list = speechSynthesis.getVoices();
  voice = list.find(v => v.lang.startsWith('zh') && v.localService)
       ?? list.find(v => v.lang.startsWith('zh')) ?? null;
}

export function initTTS(): void {
  if (!('speechSynthesis' in globalThis)) { return; }
  pickVoice();
  speechSynthesis.addEventListener('voiceschanged', pickVoice); // iOS 首次列表为空
}

export const ttsAvailable = (): boolean => !!voice;

export function speak(text: string, opts: { interrupt?: boolean } = {}): void {
  if (!voice) return;                                  // 静默降级
  if (opts.interrupt) speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice; u.lang = voice.lang; u.rate = 0.9;
  speechSynthesis.speak(u);
}

export const stopTTS = (): void => { if ('speechSynthesis' in globalThis) speechSynthesis.cancel(); };
