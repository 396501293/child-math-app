import { render } from 'preact';
import { App } from './ui/App';
import { initTTS } from './audio/tts';
import './styles.css';

initTTS(); // 在 render 前初始化语音（iOS 首帧 voices 列表可能为空，靠 voiceschanged 补齐）

render(<App />, document.getElementById('app')!);
