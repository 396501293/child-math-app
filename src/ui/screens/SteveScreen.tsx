import { useEffect, useRef, useState } from 'preact/hooks';
import type { EquipSlot, OreKind, Progress, TradeKind } from '../../core/types';
import { balance, craftable, tierUnlocked, visibleAccessories } from '../../core/rewards';
import {
  ACCESSORIES,
  BLOCKS,
  PET_IDS,
  EQUIPMENT,
  HOME_COLS,
  SKY_PATTERNS,
  STAR_PRICE_COAL,
  TIER_ORDER,
  TRADE_CHAIN,
  type EquipItem,
} from '../../core/rewardsCatalog';
import { Steve } from '../components/Steve';
import { Ico } from '../components/Ico';
import { SkyLayer } from '../components/SkyLayer';
import { ORE_CN, ORE_SOURCE_LINE, ORE_SRC } from '../components/oreAssets';
import { ACC_SRC } from '../components/steveMeta';

interface SteveScreenProps {
  progress: Progress;
  onBack: () => void;
  onCraft: (id: string) => void;
  onToggleWear: (slot: EquipSlot, id: string) => void;
  onToggleAccessory: (id: string) => void; // 摆出/收起配件（非宠物）
  onTrade: (kind: TradeKind) => void;
  onLightStar: () => void;
  onPlaceBlock: (index: number, blockId: string) => void;
  onRemoveBlock: (index: number) => void;
  onSpeak: (line: string) => void;
}

const TIER_CN: Record<string, string> = { leather: '皮革', iron: '铁', gold: '金', diamond: '钻石' };

function Lack({ n, ore }: { n: number; ore: OreKind }) {
  return (
    <span class="mn-gear-lack">
      还差 <img class="mn-ico" src={ORE_SRC[ore]} alt={ORE_CN[ore]} /> ×{n}
    </span>
  );
}

// 价格点阵（M3）：数量按 5 个一组渲染，价格本身是数学教具。
function PriceDots({ n, ore }: { n: number; ore: OreKind }) {
  const groups: number[] = [];
  for (let left = n; left > 0; left -= 5) groups.push(Math.min(5, left));
  return (
    <span class="mn-price">
      <img class="mn-ico" src={ORE_SRC[ore]} alt={ORE_CN[ore]} />
      {groups.map((g, i) => (
        <span key={i} class="mn-price-group">
          {Array.from({ length: g }, (_, j) => <i key={j} class="mn-price-dot" />)}
        </span>
      ))}
      <b>{n}</b>
    </span>
  );
}

// 宠物散步（M8：无需求无召回——它们只是在）。CSS transition + 定时换目标。
function Pet({ id, min, max, bottom }: { id: string; min: number; max: number; bottom: number }) {
  const [x, setX] = useState(min + Math.random() * (max - min));
  const [flip, setFlip] = useState(false);
  useEffect(() => {
    const t = window.setInterval(() => {
      setX((cur) => {
        const nx = min + Math.random() * (max - min);
        setFlip(nx < cur);
        return nx;
      });
    }, 3200 + Math.random() * 2200);
    return () => window.clearInterval(t);
  }, [min, max]);
  return (
    <img
      class={'mn-home-pet' + (flip ? ' is-flip' : '')}
      src={ACC_SRC[id]}
      alt=""
      style={{ left: x, bottom }}
    />
  );
}

// 养成屏（评审 2026-07-31 §问6）：进屏即家园——三层奖励第一次同框
// （穿装备的史蒂夫、走动的宠物、头顶的星、自己搭的方块）。
// 衣柜/工作台是抽屉；场景内点史蒂夫=衣柜、点工作台方块=工作台（双通道）。
// M9：无任何完成度表征——托盘上唯一的数字是煤余额。
export function SteveScreen(props: SteveScreenProps) {
  const { progress, onBack, onCraft, onToggleWear, onToggleAccessory, onTrade, onLightStar, onPlaceBlock, onRemoveBlock, onSpeak } = props;
  const [drawer, setDrawer] = useState<'none' | 'wardrobe' | 'bench'>('none');
  const [tray, setTray] = useState(false);
  const [tool, setTool] = useState<string>('blk-wood'); // 方块 id 或 'hammer'（收回模式）
  const r = progress.rewards;
  const bal = balance(progress);

  // 史蒂夫在场景里溜达（M8：他不需要你，他只是住在这）
  const [sx, setSx] = useState(180);
  const [sflip, setSflip] = useState(false);
  const walking = drawer === 'none' && !tray; // 建造/翻抽屉时站住，避免点不中
  const walkRef = useRef<number | undefined>(undefined);
  // 开抽屉时走到左侧展示位——抽屉占右半屏，他得「走过来给你看」
  useEffect(() => {
    if (drawer !== 'none') { setSflip(sx > 160); setSx(160); }
  }, [drawer]);
  useEffect(() => {
    if (!walking) return;
    walkRef.current = window.setInterval(() => {
      setSx((cur) => {
        const nx = 100 + Math.random() * 560;
        setSflip(nx < cur);
        return nx;
      });
    }, 5200);
    return () => window.clearInterval(walkRef.current);
  }, [walking]);

  const pets = PET_IDS.filter((id) => r.owned.includes(id));

  const tiers: { tier: (typeof TIER_ORDER)[number]; state: 'open' | 'next' }[] = [];
  for (const tier of TIER_ORDER) {
    if (tierUnlocked(r, tier)) tiers.push({ tier, state: 'open' });
    else { tiers.push({ tier, state: 'next' }); break; }
  }

  const sky = (() => {
    let left = r.skyStars;
    for (const pat of SKY_PATTERNS) {
      if (left < pat.stars) return { pat, lit: left, free: false };
      left -= pat.stars;
    }
    return { pat: null, lit: left, free: true };
  })();

  const itemRow = (e: EquipItem) => {
    const owned = r.owned.includes(e.id);
    const worn = r.equipped[e.slot] === e.id;
    if (owned) {
      return (
        <button key={e.id} class={'mn-gear-row is-owned' + (worn ? ' is-worn' : '')} onClick={() => onToggleWear(e.slot, e.id)}>
          <span>{e.name}</span>
          <span class={'mn-gear-state' + (worn ? ' is-worn-tag' : ' is-btn')}>{worn ? '穿着 ✓' : '换上'}</span>
        </button>
      );
    }
    const can = craftable(progress, e.id);
    return (
      <div key={e.id} class="mn-gear-row">
        <span>{e.name}</span>
        <PriceDots n={e.cost} ore={e.material} />
        {can
          ? <button class="mn-btn mn-btn--leaf mn-gear-craft" onClick={() => onCraft(e.id)}>做</button>
          : <Lack n={e.cost - bal[e.material]} ore={e.material} />}
      </div>
    );
  };

  const gridClick = (i: number) => {
    if (tool === 'hammer') onRemoveBlock(i);
    else onPlaceBlock(i, tool);
  };

  return (
    <>
      {/* ── 家园场景（主视图） ── */}
      <SkyLayer skyStars={r.skyStars} />
      <div class="mn-home-ground" />

      <div class="mn-home-grid" style={{ gridTemplateColumns: `repeat(${HOME_COLS}, 52px)` }}>
        {r.homeGrid.map((b, i) => (
          <div
            key={i}
            class={'mn-home-cell' + (tray ? ' is-build' : '') + (tray && tool === 'hammer' ? ' is-hammer' : '')}
            onClick={tray ? () => gridClick(i) : undefined}
          >
            {b && <div class={`mn-blk mn-${b}`} />}
          </div>
        ))}
      </div>

      {/* 史蒂夫（点他 = 开衣柜的同义入口） */}
      <div
        class={'mn-home-steve' + (sflip ? ' is-flip' : '') + (tray ? ' is-ghost' : '')}
        style={{ left: sx }}
        onClick={() => setDrawer('wardrobe')}
        role="button"
        aria-label="打开衣柜"
      >
        <Steve pose={drawer === 'wardrobe' ? 'wave' : 'idle'} equipped={r.equipped} />
      </div>
      <div class={tray ? 'is-ghost-wrap' : ''}>
        {pets.map((id, i) => (
          <Pet key={id} id={id} min={520 + i * 60} max={940} bottom={182 - (i % 2) * 6} />
        ))}
      </div>

      {/* 场景内工作台方块（同义入口） */}
      <div class={'mn-home-bench' + (tray ? ' is-ghost' : '')} onClick={() => setDrawer('bench')} role="button" aria-label="打开工作台">
        <div class="mn-home-bench-top" />
        <div class="mn-home-bench-body" />
      </div>

      {/* ── 顶栏 ── */}
      <button class="mn-btn mn-btn--square mn-quiz-back" onClick={onBack} aria-label="回地图">←</button>
      <div class="mn-steve-top">
        <div class="mn-steve-title">史蒂夫的家园</div>
        <button class={'mn-btn mn-steve-tab' + (drawer === 'wardrobe' ? ' is-on' : '')} onClick={() => setDrawer(drawer === 'wardrobe' ? 'none' : 'wardrobe')}>衣柜</button>
        <button class={'mn-btn mn-steve-tab' + (drawer === 'bench' ? ' is-on' : '')} onClick={() => setDrawer(drawer === 'bench' ? 'none' : 'bench')}>工作台</button>
        <button class={'mn-btn mn-steve-tab' + (tray ? ' is-on' : '')} onClick={() => { setTray(!tray); setDrawer('none'); }}>方块</button>
      </div>

      {/* ── 建造托盘（M9：唯一数字 = 煤余额） ── */}
      {tray && (
        <div class="mn-tray">
          <span class="mn-tray-coal">
            <img class="mn-ico" src={ORE_SRC.coal} alt="煤" /> {bal.coal}
          </span>
          {BLOCKS.map((b) => (
            <button
              key={b.id}
              class={'mn-tray-slot' + (tool === b.id ? ' is-on' : '')}
              onClick={() => setTool(b.id)}
              aria-label={b.name}
            >
              <div class={`mn-blk mn-${b.id}`} />
            </button>
          ))}
          <button
            class={'mn-tray-slot mn-tray-hammer' + (tool === 'hammer' ? ' is-on' : '')}
            onClick={() => setTool('hammer')}
            aria-label="收回"
          ><Ico name="pickaxe" /></button>
        </div>
      )}

      {/* ── 抽屉（衣柜 / 工作台）── */}
      {drawer !== 'none' && (
        <div class="mn-drawer-mask" onClick={() => setDrawer('none')}>
          <div class="mn-drawer mn-panel" onClick={(e) => e.stopPropagation()}>
            <button class="mn-set-close" onClick={() => setDrawer('none')} aria-label="关闭">✕</button>

            {drawer === 'wardrobe' && (
              <>
                <div class="mn-steve-explain">材料够了就能做装备，做好了直接穿上</div>
                {tiers.map(({ tier, state }) =>
                  state === 'open' ? (
                    <div key={tier} class="mn-gear-tier">
                      <div class="mn-gear-tier-name">{TIER_CN[tier]}</div>
                      {EQUIPMENT.filter((e) => e.tier === tier).map(itemRow)}
                    </div>
                  ) : (
                    <div key={tier} class="mn-gear-tier is-next">
                      <div class="mn-gear-tier-name">？？？</div>
                      <div class="mn-gear-hint">先集齐上一套</div>
                    </div>
                  ),
                )}
                {/* 已拥有的小玩意：摆出/收起（宠物住家园，不在此列） */}
                {ACCESSORIES.some((a) => r.owned.includes(a.id) && !PET_IDS.includes(a.id)) && (
                  <div class="mn-gear-tier">
                    <div class="mn-gear-tier-name">小玩意</div>
                    {ACCESSORIES.filter((a) => r.owned.includes(a.id) && !PET_IDS.includes(a.id)).map((a) => {
                      const out = r.equipped.accessories.includes(a.id);
                      return (
                        <button key={a.id} class={'mn-gear-row is-owned' + (out ? ' is-worn' : '')} onClick={() => onToggleAccessory(a.id)}>
                          <span>{a.name}</span>
                          <span class={'mn-gear-state' + (out ? ' is-worn-tag' : ' is-btn')}>{out ? '带着 ✓' : '带上'}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {drawer === 'bench' && (
              <>
                <div class="mn-steve-explain">做点小玩意 · 材料多了换一换 · 攒煤点亮夜空</div>
                <div class="mn-bench-ores">
                  {(Object.keys(ORE_SRC) as OreKind[]).map((k) => (
                    <button
                      key={k}
                      class="mn-bench-ore"
                      onClick={() => {
                        const used = k === 'coal' ? r.homeGrid.filter(Boolean).length : 0;
                        onSpeak(ORE_SOURCE_LINE[k] + (used > 0 ? `家园里用了 ${used} 块煤，收回就能拿回来。` : ''));
                      }}
                    >
                      <img class="mn-ico" src={ORE_SRC[k]} alt={ORE_CN[k]} />
                      <b>{bal[k]}</b>
                    </button>
                  ))}
                </div>

                {visibleAccessories(r).some((id) => !r.owned.includes(id)) && (
                  <div class="mn-bench-sec">做点小玩意</div>
                )}
                {visibleAccessories(r)
                  .filter((id) => !r.owned.includes(id))
                  .map((id) => {
                    const a = ACCESSORIES.find((x) => x.id === id)!;
                    const can = craftable(progress, id);
                    return (
                      <div key={id} class="mn-gear-row">
                        <span>{a.name}</span>
                        <PriceDots n={a.cost} ore={a.material} />
                        {can
                          ? <button class="mn-btn mn-btn--leaf mn-gear-craft" onClick={() => onCraft(id)}>做</button>
                          : <Lack n={a.cost - bal[a.material]} ore={a.material} />}
                      </div>
                    );
                  })}

                <div class="mn-bench-sec">换材料：4 个换 1 个更稀有的</div>
                {TRADE_CHAIN.map((t) => (
                  <div key={t.kind} class="mn-gear-row">
                    <span class="mn-trade-eq">
                      <img class="mn-ico" src={ORE_SRC[t.from]} alt={ORE_CN[t.from]} /> ×4 →
                      <img class="mn-ico" src={ORE_SRC[t.to]} alt={ORE_CN[t.to]} /> ×1
                    </span>
                    {bal[t.from] >= t.rate
                      ? <button class="mn-btn mn-gear-craft" onClick={() => onTrade(t.kind)}>换</button>
                      : <Lack n={t.rate - bal[t.from]} ore={t.from} />}
                  </div>
                ))}

                <div class="mn-bench-sec">夜空点星</div>
                <div class="mn-gear-row">
                  <span>{sky.free ? '自由点星' : `${sky.pat!.name} ${sky.lit}/${sky.pat!.stars}`}</span>
                  <PriceDots n={STAR_PRICE_COAL} ore="coal" />
                  {bal.coal >= STAR_PRICE_COAL
                    ? <button class="mn-btn mn-btn--leaf mn-gear-craft" onClick={onLightStar}>点亮</button>
                    : <Lack n={STAR_PRICE_COAL - bal.coal} ore="coal" />}
                </div>
                <div class="mn-gear-hint">方块可以收回，星星点亮了就一直亮着</div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
