import type { Rng } from '../../src/core/types';
export const seeded = (s: number): Rng => () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
