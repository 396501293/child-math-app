import type { Progress } from './types';

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const V1_KEY = 'math_nightsail_v1';
const V2_KEY = 'math_nightsail_v2';
const V2_CORRUPT_KEY = 'math_nightsail_v2_corrupt';

export function defaultProgress(): Progress {
  return {
    version: 2,
    stars: {},
    unlocked: 1,
    endless: { bestStreak: 0, totalAnswered: 0 },
    timed: { bestCount: 0 },
    timesTable: { facts: {}, sessions: 0 },
    settings: { questionCount: 5, hardMode: false, showBlocks: true, showBlocksTimed: false },
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
    raw = store.getItem(V2_KEY);
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
      version: 2,
    };
  }
  if (v2.kind === 'corrupt') return defaultProgress(); // already backed up to _corrupt key

  // v2.kind === 'missing': no v2 data yet, try prototype v1 migration
  const v1 = tryLoadV1(store);
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
    store.setItem(V2_KEY, JSON.stringify(p));
  } catch {
    // in-memory fallback (mem) already updated above; ignore storage failure
  }
}
