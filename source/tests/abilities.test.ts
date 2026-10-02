import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultAbilities, deriveAbilities } from '../src/robot/abilities';

const pairs = [
  ['speed', 'routeMemory'], ['agility', 'balance'],
  ['visualDetail', 'wideAwareness'], ['reach', 'compactness'],
  ['burstPower', 'endurance'],
] as const;

test('all sliders preserve their shared budget across the full range', () => {
  for (let value = 0; value <= 100; value++) {
    const abilities = deriveAbilities({ speed: value, agility: value, visualDetail: value, reach: value, burstPower: value });
    for (const [primary, secondary] of pairs) {
      assert.equal(abilities[primary] + abilities[secondary], 100);
      assert.equal(abilities[primary], value);
    }
    assert.equal(abilities.forgetfulness, value);
  }
});

test('increasing speed reduces memory without changing other pairs', () => {
  const before = deriveAbilities(defaultAbilities());
  const after = deriveAbilities({ ...defaultAbilities(), speed: 85 });
  assert.equal(after.routeMemory, 15);
  assert.equal(after.forgetfulness, 85);
  for (const [primary, secondary] of pairs.slice(1)) {
    assert.equal(after[primary], before[primary]);
    assert.equal(after[secondary], before[secondary]);
  }
});

test('invalid and out-of-range allocations produce usable bounded profiles', () => {
  const profile = deriveAbilities({ speed: NaN, agility: -30, visualDetail: 200, reach: 43.7, burstPower: Infinity });
  assert.equal(profile.speed, 50);
  assert.equal(profile.agility, 0);
  assert.equal(profile.visualDetail, 100);
  assert.equal(profile.reach, 44);
  assert.equal(profile.burstPower, 50);
  for (const [primary, secondary] of pairs) assert.equal(profile[primary] + profile[secondary], 100);
});

test('default allocations are independent and balanced', () => {
  const changed = defaultAbilities();
  changed.speed = 100;
  const fresh = deriveAbilities(defaultAbilities());
  for (const [primary, secondary] of pairs) {
    assert.equal(fresh[primary], 50);
    assert.equal(fresh[secondary], 50);
  }
});
