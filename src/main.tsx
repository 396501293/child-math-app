import { render } from 'preact';
import '@fontsource/noto-sans-sc/500.css';
import '@fontsource/noto-sans-sc/700.css';
import '@fontsource/noto-sans-sc/900.css';
// Nunito 只引 latin：中文字形由 Noto Sans SC 承担，引其中文子集是纯浪费。
// 本应用数字密集，圆润数字是动森观感的主要来源。
import '@fontsource/nunito/latin-500.css';
import '@fontsource/nunito/latin-700.css';
import '@fontsource/nunito/latin-900.css';
import { App } from './ui/App';
import { initTTS } from './audio/tts';
import './styles.css';

initTTS(); // 在 render 前初始化语音（iOS 首帧 voices 列表可能为空，靠 voiceschanged 补齐）

render(<App />, document.getElementById('app')!);
