import { useEffect, useState } from 'preact/hooks';

export const STAGE_W = 1024;
export const STAGE_H = 768;

export function stageScale(w: number, h: number): number {
  return Math.min(w / STAGE_W, h / STAGE_H);
}

export function useStageScale(): number {
  const [scale, setScale] = useState(() => stageScale(window.innerWidth, window.innerHeight));

  useEffect(() => {
    const onResize = () => setScale(stageScale(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return scale;
}
