import { expect, test } from 'vitest';
import type { StorageLike } from '../../src/core/storage';
import {
  addProfile,
  defaultProgress,
  loadProgress,
  profileMeta,
  saveProgress,
  setActiveProfile,
} from '../../src/core/storage';

// 多档案（审查 D3，二孩「拆家」）：档案 0 沿用原 key（老用户零迁移），
// 档案 1/2 分片 key；active 存元数据 key。上限 3。

function memStore(): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {};
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => { data[k] = v; },
    removeItem: (k) => { delete data[k]; },
  };
}

test('无元数据 → 单档案 active 0（老用户行为逐位不变）', () => {
  const st = memStore();
  expect(profileMeta(st)).toEqual({ active: 0, count: 1 });
  const p = defaultProgress();
  p.unlocked = 7;
  saveProgress(p, st);
  expect(st.data['math_nightsail_v2']).toBeTruthy(); // 原 key
  expect(loadProgress(st).unlocked).toBe(7);
});

test('addProfile：上限 3；新档案空进度、不切换 active', () => {
  const st = memStore();
  addProfile(st);
  expect(profileMeta(st)).toEqual({ active: 0, count: 2 });
  addProfile(st);
  addProfile(st); // 超限忽略
  expect(profileMeta(st).count).toBe(3);
});

test('档案分片隔离：档 1 的写入不碰档 0；切回档 0 读回原进度', () => {
  const st = memStore();
  const p0 = defaultProgress();
  p0.unlocked = 30;
  saveProgress(p0, st);
  addProfile(st);
  setActiveProfile(1, st);
  expect(loadProgress(st).unlocked).toBe(1); // 新档案空进度
  const p1 = defaultProgress();
  p1.unlocked = 5;
  saveProgress(p1, st);
  expect(st.data['math_nightsail_v2_p1']).toBeTruthy();
  setActiveProfile(0, st);
  expect(loadProgress(st).unlocked).toBe(30); // 档 0 未被拆家
  setActiveProfile(1, st);
  expect(loadProgress(st).unlocked).toBe(5);
});

test('setActiveProfile 越界忽略', () => {
  const st = memStore();
  setActiveProfile(2, st); // count=1，越界
  expect(profileMeta(st).active).toBe(0);
  setActiveProfile(-1, st);
  expect(profileMeta(st).active).toBe(0);
});
