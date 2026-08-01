import type { Progress } from './types';

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const V1_KEY = 'math_nightsail_v1';
const V2_KEY = 'math_nightsail_v2';
const V2_CORRUPT_KEY = 'math_nightsail_v2_corrupt';

// ── 多档案（审查 D3，二孩「拆家」）──────────────────────────────────
// 档案 0 沿用 V2_KEY（老用户零迁移）；档案 1/2 分片 `${V2_KEY}_p{i}`。
// active/count 存元数据 key；无元数据 = 单档案 active 0，行为逐位等于多档案之前。
const PROFILE_META_KEY = 'math_nightsail_profiles';
export const MAX_PROFILES = 3;

export function profileMeta(store: StorageLike = safeStore()): { active: number; count: number } {
  try {
    const raw = store.getItem(PROFILE_META_KEY);
    if (raw) {
      const m = JSON.parse(raw) as { active?: unknown; count?: unknown };
      const count = Math.min(MAX_PROFILES, Math.max(1, Number(m.count) || 1));
      const active = Math.min(count - 1, Math.max(0, Number(m.active) || 0));
      return { active, count };
    }
  } catch {
    // 解析失败按单档案处理
  }
  return { active: 0, count: 1 };
}

function saveMeta(m: { active: number; count: number }, store: StorageLike): void {
  try {
    store.setItem(PROFILE_META_KEY, JSON.stringify(m));
  } catch {
    // 私密模式：静默降级为单档案
  }
}

export function addProfile(store: StorageLike = safeStore()): void {
  const m = profileMeta(store);
  if (m.count >= MAX_PROFILES) return;
  saveMeta({ ...m, count: m.count + 1 }, store);
}

export function setActiveProfile(i: number, store: StorageLike = safeStore()): void {
  const m = profileMeta(store);
  if (i < 0 || i >= m.count) return;
  saveMeta({ ...m, active: i }, store);
  mem = null; // 切档后内存兜底失效（属于旧档案）
}

const keyFor = (i: number): string => (i === 0 ? V2_KEY : `${V2_KEY}_p${i}`);

// 选人屏头像用：窥视某档案的装扮与前沿（不改 active、不触发迁移）。
export function peekProfile(i: number, store: StorageLike = safeStore()):
  { equipped: Progress['rewards']['equipped']; unlocked: number; starred: number } | null {
  try {
    const raw = store.getItem(keyFor(i));
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Progress>;
    const d = defaultProgress();
    return {
      equipped: { ...d.rewards.equipped, ...p.rewards?.equipped },
      unlocked: Number(p.unlocked) || 1,
      starred: Object.values(p.stars ?? {}).filter((s) => (s ?? 0) >= 1).length,
    };
  } catch {
    return null;
  }
}

export function defaultProgress(): Progress {
  return {
    version: 2,
    stars: {},
    unlocked: 1,
    endless: { bestStreak: 0, totalAnswered: 0, streak: 0 },
    timed: { bestCount: 0 },
    timesTable: { facts: {}, sessions: 0 },
    settings: { questionCount: 5, hardMode: false, showBlocks: true, showBlocksTimed: false, steveRaise: true },
    rewards: {
      practiceFirstTry: 0,
      owned: [],
      equipped: { boots: null, helm: null, legs: null, chest: null, accessories: [] },
      skyStars: 0,
      homeGrid: Array(144).fill(null),
      traded: { coalToIron: 0, ironToGold: 0, goldToDiamond: 0, diamondToEmerald: 0 },
    },
    weekly: { weekStart: 0, answered: 0, firstTry: 0 },
    insight: { days: [], errors: [] },
  };
}

// In-memory fallback: last successfully saved Progress, used when the real
// store throws (private browsing / quota exceeded) so the app still "works"
// for the duration of the session.
let mem: Progress | null = null;

function deepClone(p: Progress): Progress {
  return JSON.parse(JSON.stringify(p)) as Progress;
}

function noopStore(): StorageLike {
  return {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
}

export function safeStore(): StorageLike {
  try {
    const ls = globalThis.localStorage;
    if (ls) return ls;
  } catch {
    // accessing the property itself can throw in some privacy modes
  }
  return noopStore();
}

// Guards only version + object-ness; nested fields may be missing (older or
// hand-edited blobs), so the ok path merges over defaultProgress().
function isProgressShape(v: unknown): v is Partial<Progress> & { version: 2 } {
  return !!v && typeof v === 'object' && (v as { version?: unknown }).version === 2;
}

type V2Result =
  | { kind: 'ok'; data: Partial<Progress> & { version: 2 } }
  | { kind: 'missing' }
  | { kind: 'corrupt' }
  | { kind: 'broken' };

function tryLoadV2(store: StorageLike): V2Result {
  let raw: string | null;
  try {
    raw = store.getItem(keyFor(profileMeta(store).active));
  } catch {
    return { kind: 'broken' };
  }
  if (raw == null) return { kind: 'missing' };
  try {
    const parsed = JSON.parse(raw);
    if (isProgressShape(parsed)) return { kind: 'ok', data: parsed };
  } catch {
    // fall through to corrupt handling below
  }
  // unparseable OR valid JSON with wrong shape/version: back up raw blob before reset
  try {
    store.setItem(V2_CORRUPT_KEY, raw);
  } catch {
    // best effort; if this throws the store is broken anyway
  }
  return { kind: 'corrupt' };
}

function tryLoadV1(store: StorageLike): { stars: Record<number, 0 | 1 | 2 | 3>; unlocked: number } | null {
  let raw: string | null;
  try {
    raw = store.getItem(V1_KEY);
  } catch {
    return null;
  }
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw) as { stars?: Record<number, 0 | 1 | 2 | 3>; unlocked?: number };
    if (!parsed || typeof parsed !== 'object') return null;
    return { stars: parsed.stars ?? {}, unlocked: parsed.unlocked ?? 1 };
  } catch {
    return null;
  }
}

export function loadProgress(store: StorageLike = safeStore()): Progress {
  const v2 = tryLoadV2(store);

  if (v2.kind === 'broken') return mem ? deepClone(mem) : defaultProgress();
  if (v2.kind === 'ok') {
    // Merge over defaults so partial blobs degrade gracefully instead of
    // crashing the app at e.g. progress.settings.questionCount.
    const d = defaultProgress();
    const parsed = v2.data;
    return {
      ...d,
      ...parsed,
      settings: { ...d.settings, ...parsed.settings },
      endless: { ...d.endless, ...parsed.endless },
      timed: { ...d.timed, ...parsed.timed },
      timesTable: { ...d.timesTable, ...parsed.timesTable },
      // 养成切片：旧存档无此片时按 totalAnswered 折算 practiceFirstTry
      //（评审 M5「事后惊喜」——老用户首开养成屏材料已按既往进度堆好）
      rewards: parsed.rewards
        ? {
            ...d.rewards,
            ...parsed.rewards,
            equipped: { ...d.rewards.equipped, ...parsed.rewards.equipped },
            traded: { ...d.rewards.traded, ...parsed.rewards.traded },
          }
        : { ...d.rewards, practiceFirstTry: parsed.endless?.totalAnswered ?? 0 },
      weekly: { ...d.weekly, ...parsed.weekly },
      insight: parsed.insight
        ? { days: parsed.insight.days ?? [], errors: parsed.insight.errors ?? [] }
        : d.insight,
      version: 2,
    };
  }
  if (v2.kind === 'corrupt') return defaultProgress(); // already backed up to _corrupt key

  // v2.kind === 'missing': no v2 data yet, try prototype v1 migration
  // （v1 迁移只属于档案 0；新增档案的 missing 就是空进度）
  const v1 = profileMeta(store).active === 0 ? tryLoadV1(store) : null;
  if (v1) {
    const merged = defaultProgress();
    // prototype data isn't validated: clamp stars to 0..3 and unlocked to 1..60
    for (const [k, v] of Object.entries(v1.stars))
      merged.stars[Number(k)] = Math.min(3, Math.max(0, Number(v) || 0)) as 0 | 1 | 2 | 3;
    const rawUnlocked = Number(v1.unlocked);
    merged.unlocked = Math.min(60, Math.max(1, Number.isFinite(rawUnlocked) ? rawUnlocked : 1));
    saveProgress(merged, store); // migrate: persist v2 immediately, keep v1 key intact
    return merged;
  }

  return defaultProgress();
}

export function saveProgress(p: Progress, store: StorageLike = safeStore()): void {
  mem = deepClone(p);
  try {
    store.setItem(keyFor(profileMeta(store).active), JSON.stringify(p));
  } catch {
    // in-memory fallback (mem) already updated above; ignore storage failure
  }
}
