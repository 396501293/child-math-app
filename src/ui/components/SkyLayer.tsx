import { freeStarPositions, skyState } from './skyPatterns';

// 夜空层：skyStars 单一计数、两处渲染（地图夜空 + 家园上空）——
// 评审铁则：不得分裂成「家园星」第二货币。pointer-events 穿透，纯展示。
export function SkyLayer({ skyStars }: { skyStars: number }) {
  const sky = skyState(skyStars);
  return (
    <svg class="mn-sky" width="1024" height="768" aria-hidden="true">
      {sky.map(({ pattern, lit, complete }) => (
        <g key={pattern.id}>
          {complete &&
            pattern.lines.map(([a, b], i) => (
              <line
                key={i}
                x1={pattern.stars[a].x} y1={pattern.stars[a].y}
                x2={pattern.stars[b].x} y2={pattern.stars[b].y}
                class="mn-sky-line"
              />
            ))}
          {pattern.stars.slice(0, lit).map((st, i) => (
            <rect key={i} x={st.x - 3} y={st.y - 3} width="6" height="6" class="mn-sky-star" />
          ))}
        </g>
      ))}
      {/* 第 46 颗起的自由星：图样间空隙带散布（审查 D1） */}
      {freeStarPositions(skyStars).map((st, i) => (
        <rect key={i} x={st.x - 3} y={st.y - 3} width="6" height="6" class="mn-sky-star" />
      ))}
    </svg>
  );
}
