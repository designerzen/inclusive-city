import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultAbilities } from '../src/robot/abilities';
import { createRobotProfile, defaultFunctions, robotFunctions, toggleFunction } from '../src/robot/functions';
import type { FunctionId } from '../src/robot/functions';

test('every switch preserves exactly three selections for all possible ordered profiles', () => {
  const ids = robotFunctions.map(item => item.id);
  const combinations = new Set<string>();
  for (const a of ids) for (const b of ids) for (const c of ids) {
    if (new Set([a, b, c]).size !== 3) continue;
    const selected = [a, b, c];
    combinations.add([...selected].sort().join(','));
    for (const target of ids) {
      const result = toggleFunction(selected, target);
      assert.equal(result.selected.length, 3);
      assert.equal(new Set(result.selected).size, 3);
      assert.equal(result.selected.includes(target), !selected.includes(target));
      assert.ok(result.selected.includes(result.enabled));
      assert.ok(!result.selected.includes(result.disabled));
      assert.equal(selected.filter(id => !result.selected.includes(id)).length, 1);
      assert.deepEqual(selected, [a, b, c]);
    }
  }
  assert.equal(combinations.size, 10);
});

test('swap replacements are predictable', () => {
  assert.deepEqual(toggleFunction(defaultFunctions(), 'hearing').selected, ['vision', 'memory', 'hearing']);
  assert.deepEqual(toggleFunction(defaultFunctions(), 'vision').selected, ['communication', 'memory', 'hearing']);
});

test('disabled functions override effective values and retain tuning for reactivation', () => {
  const allocation = { ...defaultAbilities(), speed: 85, visualDetail: 70 };
  const inactive = createRobotProfile(allocation, ['hearing', 'memory', 'balance']);
  assert.equal(inactive.abilities.speed, 85);
  assert.equal(inactive.effectiveAbilities.speed, 85);
  assert.equal(inactive.effectiveAbilities.visualDetail, 0);
  assert.equal(inactive.effectiveAbilities.wideAwareness, 0);
  const restored = createRobotProfile(allocation, defaultFunctions());
  assert.equal(restored.effectiveAbilities.speed, 85);
  assert.equal(restored.effectiveAbilities.visualDetail, 70);
  assert.equal(restored.effectiveAbilities.balance, 0);
  const noMemory = createRobotProfile(allocation, ['communication', 'vision', 'hearing']);
  assert.equal(noMemory.effectiveAbilities.routeMemory, 0);
  assert.equal(noMemory.effectiveAbilities.forgetfulness, 100);
});

test('invalid counts, duplicates and unknown functions are rejected', () => {
  for (const invalid of [[], ['communication', 'vision'], ['communication', 'vision', 'hearing', 'memory'], ['vision', 'vision', 'memory'], ['unknown', 'vision', 'memory']]) {
    assert.throws(() => createRobotProfile(defaultAbilities(), invalid as FunctionId[]));
    assert.throws(() => toggleFunction(invalid as FunctionId[], 'communication'));
  }
  assert.throws(() => toggleFunction(defaultFunctions(), 'unknown' as FunctionId));
});
