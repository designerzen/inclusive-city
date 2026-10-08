import assert from 'node:assert/strict';
import { test } from 'node:test';
import { paintNoise, paintStream } from '../src/art/paintField';

test('named artistic streams remain independent of other sampling and survive seed restoration', () => {
  const palette = paintStream(42661, 'palette'), composition = paintStream(42661, 'composition');
  const expected = Array.from({ length: 20 }, paintStream(42661, 'composition'));
  const actual = Array.from({ length: 20 }, () => {
    for (let i = 0; i < 50; i++) palette();
    return composition();
  });
  assert.deepEqual(actual, expected);
  assert.notDeepEqual(actual, Array.from({ length: 20 }, paintStream(42662, 'composition')));
  assert.notDeepEqual(actual, Array.from({ length: 20 }, paintStream(42661, 'palette')));
});

test('paint fields are smooth across lattice boundaries, bounded and independent of sampling order', () => {
  for (const seed of [0, 42661, 0xffffffff]) {
    for (const x of [-3, -1, 0, 1, 8]) {
      const value = paintNoise(seed, x, .73);
      assert.ok(value >= 0 && value <= 1);
      assert.ok(Math.abs(paintNoise(seed, x - .0001, .73) - paintNoise(seed, x + .0001, .73)) < .001);
      paintNoise(seed, 100, -20);
      assert.equal(paintNoise(seed, x, .73), value);
    }
  }
  assert.notEqual(paintNoise(1, .4, .7), paintNoise(2, .4, .7));
});
