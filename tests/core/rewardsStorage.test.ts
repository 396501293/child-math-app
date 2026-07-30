import { expect, test } from 'vitest';
import { defaultProgress, loadProgress, saveProgress, type StorageLike } from '../../src/core/storage';
import { recordAnswer } from '../../src/core/rewards';

function memStore(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

// ── 迁移：老 v2 存档（无 rewards 切片）→ practiceFirstTry 按 totalAnswered 折算 ──
// 这就是评审 M5 的「事后惊喜」：老用户首开养成屏时材料已按既往进度堆好。

test('无 rewards 切片的旧存档：practiceFirstTry = endless.totalAnswered', () => {
  const store = memStore();
  const legacy = defaultProgress() as unknown as Record<string, unknown>;
  delete legacy.rewards;
  delete legacy.weekly;
  (legacy.endless as { totalAnswered: number }).totalAnswered = 340;
  store.map.set('math_nightsail_v2', JSON.stringify(legacy));

  const p = loadProgress(store);
  expect(p.rewards.practiceFirstTry).toBe(340);
  expect(p.rewards.owned).toEqual([]);
  expect(p.rewards.skyStars).toBe(0);
  expect(p.settings.steveRaise).toBe(true); // 新设置项默认开
});

test('已有 rewards 切片：原样保留，不重复折算', () => {
  const store = memStore();
  const p0 = defaultProgress();
  p0.endless.totalAnswered = 500;
  p0.rewards.practiceFirstTry = 42;
  p0.rewards.owned = ['eq-leather-boots'];
  saveProgress(p0, store);

  const p = loadProgress(store);
  expect(p.rewards.practiceFirstTry).toBe(42); // 不被 500 覆盖
  expect(p.rewards.owned).toEqual(['eq-leather-boots']);
});

// ── recordAnswer：埋点纯函数（App.answer 调用）──

const WEEK = 7 * 24 * 3600 * 1000;

test('练习模式首答即对：practiceFirstTry+1；weekly 同步计数', () => {
  const p0 = defaultProgress();
  const t0 = 1_800_000_000_000;
  const p1 = recordAnswer(p0, { practice: true, firstTry: true, correct: true }, t0);
  expect(p1.rewards.practiceFirstTry).toBe(1);
  expect(p1.weekly.answered).toBe(1);
  expect(p1.weekly.firstTry).toBe(1);
});

test('主线首答：weekly 计数但 practiceFirstTry 不动', () => {
  const p1 = recordAnswer(defaultProgress(), { practice: false, firstTry: true, correct: true }, 0);
  expect(p1.rewards.practiceFirstTry).toBe(0);
  expect(p1.weekly.answered).toBe(1);
  expect(p1.weekly.firstTry).toBe(1);
});

test('重试答对不计 practiceFirstTry；首答答错计 answered 不计 firstTry', () => {
  let p = recordAnswer(defaultProgress(), { practice: true, firstTry: false, correct: true }, 0);
  expect(p.rewards.practiceFirstTry).toBe(0);
  expect(p.weekly.answered).toBe(0); // 非首答不重复计题量
  p = recordAnswer(defaultProgress(), { practice: true, firstTry: true, correct: false }, 0);
  expect(p.weekly.answered).toBe(1);
  expect(p.weekly.firstTry).toBe(0);
  expect(p.rewards.practiceFirstTry).toBe(0);
});

test('weekly 翻周重置', () => {
  const t0 = 1_800_000_000_000;
  let p = recordAnswer(defaultProgress(), { practice: true, firstTry: true, correct: true }, t0);
  p = recordAnswer(p, { practice: true, firstTry: true, correct: true }, t0 + 1000);
  expect(p.weekly.answered).toBe(2);
  p = recordAnswer(p, { practice: true, firstTry: true, correct: true }, t0 + WEEK + 1);
  expect(p.weekly.answered).toBe(1); // 新的一周从头计
  expect(p.rewards.practiceFirstTry).toBe(3); // 累计值不受翻周影响
});
