import type { BandConfig, Item, Op, Question, Rng } from './types';
import { enumeratePool, itemKey } from './enumerate';
import { makeOptions } from './options';
import { shuffle } from './rand';

const evalItem = (it: Item): number =>
  it.ops.reduce((acc, op, k) => op === '+' ? acc + it.operands[k + 1] : acc - it.operands[k + 1], it.operands[0]);

// 加权选池
function pickPool(cfg: BandConfig, rng: Rng) {
  const total = cfg.pools.reduce((s, p) => s + p.weight, 0);
  let roll = rng() * total;
  for (const p of cfg.pools) { roll -= p.weight; if (roll < 0) return p; }
  return cfg.pools[cfg.pools.length - 1];
}

// 整关配比：floor(权重份额) + 余量按权重随机分配
export function allocate(cfg: BandConfig, count: number, rng: Rng): number[] {
  const total = cfg.pools.reduce((s, p) => s + p.weight, 0);
  const alloc = cfg.pools.map(p => Math.floor((p.weight / total) * count));
  let rest = count - alloc.reduce((a, b) => a + b, 0);
  while (rest-- > 0) alloc[cfg.pools.indexOf(pickPool(cfg, rng))]++;
  return alloc;
}

const opWord = (op: Op) => (op === '+' ? '加' : '减');

function toQuestion(it: Item, cfg: BandConfig, rng: Rng): Question {
  const [a, b] = it.operands;
  let answer: number, missingIndex: number | undefined, ttsText: string;
  switch (it.kind) {
    case 'add': case 'sub': case 'chain3': {
      answer = evalItem(it);
      ttsText = it.kind === 'chain3'
        ? `${a} ${opWord(it.ops[0])} ${b} 再${opWord(it.ops[1])} ${it.operands[2]}，等于几？`
        : `${a} ${opWord(it.ops[0])} ${b} 等于几？`;
      break;
    }
    case 'missing-b': { answer = b; missingIndex = 1; ttsText = `${a} 加上几，等于 ${a + b}？`; break; }
    case 'missing-a': { answer = a; missingIndex = 0; ttsText = `几加上 ${b}，等于 ${a + b}？`; break; }
    case 'missing-sub': { answer = b; missingIndex = 1; ttsText = `${a} 减去几，等于 ${a - b}？`; break; }
  }
  const q: Question = { kind: it.kind, operands: it.operands, ops: it.ops, missingIndex,
    answer, options: makeOptions(it, answer, cfg.band, rng), ttsText };
  if (cfg.chapter !== 3) attachBlocks(q);
  return q;
}

function attachBlocks(q: Question): void {
  const [a, b] = q.operands;
  switch (q.kind) {
    case 'add': q.blocksPlan = { type: 'two-group', a, b };
      q.blocksHint = `先数 ${a} 个，再数 ${b} 个，一共几个？`; break;
    case 'sub': q.blocksPlan = { type: 'divide-out', total: a, crossOut: b };
      q.blocksHint = `${a} 个方块，划掉 ${b} 个，剩下几个？`; break;
    case 'missing-b': q.blocksPlan = { type: 'fill-slot', filled: a, empty: b, filledFirst: true };
      q.blocksHint = `已经有 ${a} 个，再填几个才是 ${a + b} 个？`; break;
    case 'missing-a': q.blocksPlan = { type: 'fill-slot', filled: b, empty: a, filledFirst: false };
      q.blocksHint = `后面有 ${b} 个，前面填几个才是 ${a + b} 个？`; break;
    case 'missing-sub': q.blocksPlan = { type: 'keep-mark', total: a, keep: a - b };
      q.blocksHint = `${a} 个方块，要剩下 ${a - b} 个，得划掉几个？`; break;
    case 'chain3': q.blocksPlan = { type: 'three-group',
      groups: [q.operands[0], q.operands[1], q.operands[2]], ops: q.ops as [Op, Op] };
      q.blocksHint = `一组一组数，${q.ttsText}`; break;
  }
}

export function applyHardMode(cfg: BandConfig): BandConfig {
  return { ...cfg, pools: cfg.pools.map(p => (p.kind === 'add' ? { ...p, kind: 'missing-b' } : p)) };
}

export function generateQuestion(cfg: BandConfig, rng: Rng, recentKeys: string[]): Question {
  const pool = pickPool(cfg, rng);
  let items = enumeratePool(pool).filter(i => !recentKeys.includes(itemKey(i)));
  if (items.length === 0) items = enumeratePool(pool);
  return toQuestion(items[Math.floor(rng() * items.length)], cfg, rng);
}

export function generateLevel(cfg: BandConfig, count: number, rng: Rng): Question[] {
  const alloc = allocate(cfg, count, rng);
  const used = new Set<string>();
  const picked: Item[] = [];
  cfg.pools.forEach((pool, pi) => {
    const items = shuffle(enumeratePool(pool).filter(i => !used.has(itemKey(i))), rng);
    for (let n = 0; n < alloc[pi]; n++) { picked.push(items[n]); used.add(itemKey(items[n])); }
  });
  return picked.map(i => toQuestion(i, cfg, rng)).sort((x, y) => x.answer - y.answer);
}
