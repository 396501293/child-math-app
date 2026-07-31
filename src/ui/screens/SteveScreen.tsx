import { useState } from 'preact/hooks';
import type { EquipSlot, OreKind, Progress, TradeKind } from '../../core/types';
import { balance, craftable, tierUnlocked, visibleAccessories } from '../../core/rewards';
import {
  ACCESSORIES,
  CATALOG_BY_ID,
  EQUIPMENT,
  SKY_PATTERNS,
  SLOT_ORDER,
  STAR_PRICE_COAL,
  TIER_ORDER,
  TRADE_CHAIN,
  type EquipItem,
} from '../../core/rewardsCatalog';
import { Steve } from '../components/Steve';
import { ORE_CN, ORE_SOURCE_LINE, ORE_SRC } from '../components/oreAssets';

interface SteveScreenProps {
  progress: Progress;
  onBack: () => void;
  onCraft: (id: string) => void;
  onToggleWear: (slot: EquipSlot, id: string) => void; // 点已拥有的件穿/脱
  onTrade: (kind: TradeKind) => void;
  onLightStar: () => void;
  onSpeak: (line: string) => void;
}

const TIER_CN: Record<string, string> = { leather: '皮革', iron: '铁', gold: '金', diamond: '钻石' };

// 缺料提示：必须带材料图标——「还差 3」不说差什么，成人都要想一下
function Lack({ n, ore }: { n: number; ore: OreKind }) {
  return (
    <span class="mn-gear-lack">
      还差 <img class="mn-ico" src={ORE_SRC[ore]} alt={ORE_CN[ore]} /> ×{n}
    </span>
  );
}

// 价格点阵（M3 近端化）：数量按 5 个一组渲染成小方块，
// 让「12 煤」在视觉上就是「两组 5 加 2」——价格本身是数学教具。
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

// 养成屏（spec §5）。两个标签：装备（阶梯 + 立绘）/ 工作台（配件·兑换·点星）。
// 呈现纪律：无红点无角标；措辞「做」不「买」；渐次显形。
export function SteveScreen({ progress, onBack, onCraft, onToggleWear, onTrade, onLightStar, onSpeak }: SteveScreenProps) {
  const [tab, setTab] = useState<'gear' | 'bench'>('gear');
  const r = progress.rewards;
  const bal = balance(progress);

  // 渐次显形：已解锁阶展开；下一阶只给名字剪影；再往后不显示
  const tiers: { tier: (typeof TIER_ORDER)[number]; state: 'open' | 'next' }[] = [];
  for (const tier of TIER_ORDER) {
    if (tierUnlocked(r, tier)) tiers.push({ tier, state: 'open' });
    else { tiers.push({ tier, state: 'next' }); break; }
  }

  const sky = (() => {
    // 当前图样与图样内进度（图样按序点亮，45 星后自由点星）
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
    const lack = e.cost - bal[e.material];
    return (
      <div key={e.id} class="mn-gear-row">
        <span>{e.name}</span>
        <PriceDots n={e.cost} ore={e.material} />
        {can
          ? <button class="mn-btn mn-btn--leaf mn-gear-craft" onClick={() => onCraft(e.id)}>做</button>
          : <Lack n={lack} ore={e.material} />}
      </div>
    );
  };

  return (
    <>
      <button class="mn-btn mn-btn--square mn-quiz-back" onClick={onBack} aria-label="回地图">←</button>
      <div class="mn-steve-top">
        <div class="mn-steve-title">我的伙伴</div>
        <button class={'mn-btn mn-steve-tab' + (tab === 'gear' ? ' is-on' : '')} onClick={() => setTab('gear')}>装备</button>
        <button class={'mn-btn mn-steve-tab' + (tab === 'bench' ? ' is-on' : '')} onClick={() => setTab('bench')}>工作台</button>
      </div>

      {/* 中央立绘（两个标签共用）：点件换装即时反映。
          材料栏常驻立绘下方——「我有什么」必须永远可见，
          这是理解整个经济的前提，藏在某个标签里成人都会迷路。 */}
      <div class="mn-steve-stage">
        <Steve pose="idle" scale={2} equipped={r.equipped} />
        <div class="mn-bench-ores">
          {(Object.keys(ORE_SRC) as OreKind[]).map((k) => (
            <button key={k} class="mn-bench-ore" onClick={() => onSpeak(ORE_SOURCE_LINE[k])}>
              <img class="mn-ico" src={ORE_SRC[k]} alt={ORE_CN[k]} />
              <b>{bal[k]}</b>
            </button>
          ))}
        </div>
        <div class="mn-gear-hint">做题攒材料 · 点材料听它从哪来</div>
      </div>

      {tab === 'gear' && (
        <div class="mn-steve-panel mn-panel">
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
        </div>
      )}

      {tab === 'bench' && (
        <div class="mn-steve-panel mn-panel">
          <div class="mn-steve-explain">给史蒂夫做点小玩意 · 材料多了换一换 · 攒煤点亮夜空</div>

          <div class="mn-bench-sec">做点小玩意</div>
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
          <div class="mn-gear-hint">点亮的星会出现在地图的夜空里</div>
        </div>
      )}
    </>
  );
}
