import { useEffect, useRef, useState } from 'preact/hooks';

interface CountdownOpts {
  startMs: number; // reset() 缺省复位值
  maxMs: number; // addTime 封顶
  onExpire: () => void; // 到 0 且 canExpire 允许时触发（一次）
  canExpire?: () => boolean; // 返回 false 时延迟触发（如反馈窗口期），下一帧再查
}

// 倒计时 rAF 循环（spec §5）：真值在 ref，以 performance.now() 差值递减，
// 不依赖 setInterval 精度；displayMs 为节流（~100ms）后的展示值，只驱动时间条，
// 刻意不每帧触发整树重渲。visibilitychange 隐藏时不累计（隐藏期间时间不流失），
// 可见时重置基准继续。onExpire/canExpire 走 latest-ref，调用方无需自管闭包新鲜度。
export function useCountdown(active: boolean, opts: CountdownOpts) {
  const { startMs, maxMs } = opts;
  const timeLeftRef = useRef(startMs);
  const [displayMs, setDisplayMs] = useState(startMs);

  const onExpireRef = useRef(opts.onExpire);
  onExpireRef.current = opts.onExpire;
  const canExpireRef = useRef(opts.canExpire);
  canExpireRef.current = opts.canExpire;

  const reset = (ms: number = startMs) => {
    timeLeftRef.current = ms;
    setDisplayMs(ms);
  };

  const addTime = (ms: number) => {
    timeLeftRef.current = Math.min(maxMs, timeLeftRef.current + ms);
    setDisplayMs(timeLeftRef.current);
  };

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let hidden = document.hidden;

    const onVis = () => {
      if (document.hidden) {
        hidden = true;
      } else {
        hidden = false;
        last = performance.now(); // 丢弃隐藏期间的时长
      }
    };
    document.addEventListener('visibilitychange', onVis);

    const tick = (now: number) => {
      if (hidden) {
        last = now; // 隐藏时保持基准新鲜（rAF 一般已被浏览器暂停，双保险）
      } else {
        const dt = now - last;
        last = now;
        timeLeftRef.current = Math.max(0, timeLeftRef.current - dt);
        const v = timeLeftRef.current;
        setDisplayMs((prev) => (v === 0 || Math.abs(prev - v) >= 100 ? v : prev));
        if (v <= 0 && (canExpireRef.current?.() ?? true)) {
          onExpireRef.current(); // 到期触发；不再排下一帧
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [active]);

  return { displayMs, addTime, reset };
}
