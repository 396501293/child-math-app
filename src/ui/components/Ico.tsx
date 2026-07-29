import { icoSrc, type IcoName } from './icoAssets';

export type { IcoName };

// 行内小图标。高度用 1em 跟随上下文字号——这样各处不必单独调尺寸，
// 行为与它替代的 emoji 一致（emoji 本来就是按字号排版的字形）。
// alt="" ：图标是装饰性的，语义由相邻文案或外层 aria-label 承担。
export function Ico({ name }: { name: IcoName }) {
  return <img class="mn-ico" src={icoSrc(name)} alt="" />;
}
