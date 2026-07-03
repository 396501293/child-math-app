import { expect, test } from 'vitest';
import { defaultProgress, loadProgress, saveProgress } from '../../src/core/storage';

const fakeStore = (init: Record<string, string> = {}) => {
  const m = new Map(Object.entries(init));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
};

test('default progress shape', () => {
  const p = defaultProgress();
  expect(p).toMatchObject({ version: 2, unlocked: 1,
    endless: { bestStreak: 0, totalAnswered: 0 }, timed: { bestCount: 0 },
    settings: { questionCount: 5, hardMode: false, showBlocks: true, showBlocksTimed: false } });
});

test('save/load round-trip', () => {
  const s = fakeStore();
  const p = defaultProgress(); p.unlocked = 7; p.stars[3] = 2;
  saveProgress(p, s);
  expect(loadProgress(s)).toEqual(p);
});

test('migrates prototype v1 data and keeps original key', () => {
  const s = fakeStore({ math_nightsail_v1: JSON.stringify({ stars: { 1: 3, 2: 2 }, unlocked: 3 }) });
  const p = loadProgress(s);
  expect(p.version).toBe(2); expect(p.stars[1]).toBe(3); expect(p.unlocked).toBe(3);
  expect(s.dump()).toHaveProperty('math_nightsail_v1');   // 原 key 不删
  expect(s.dump()).toHaveProperty('math_nightsail_v2');   // 迁移即落盘
});

test('corrupt v2 JSON → copied to backup key, reset to default', () => {
  const s = fakeStore({ math_nightsail_v2: '{oops' });
  const p = loadProgress(s);
  expect(p).toEqual(defaultProgress());
  expect(s.dump().math_nightsail_v2_corrupt).toBe('{oops');
});

test('storage throwing → in-memory fallback works for the session', () => {
  const boom = { getItem: () => { throw new Error(); }, setItem: () => { throw new Error(); },
    removeItem: () => {} };
  const p = defaultProgress(); p.unlocked = 9;
  saveProgress(p, boom);                 // 不抛
  expect(loadProgress(boom).unlocked).toBe(9);   // 内存兜底读回
});
