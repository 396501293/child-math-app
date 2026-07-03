import { expect, test } from 'vitest';
import { stageScale } from '../../src/ui/scale';

test('scale = min(vw/1024, vh/768)', () => {
  expect(stageScale(2048, 1536)).toBe(2);
  expect(stageScale(1024, 384)).toBe(0.5);
  expect(stageScale(512, 768)).toBe(0.5);
});
