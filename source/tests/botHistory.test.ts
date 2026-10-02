import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { BotHistory } from '../src/robot/botHistory';
import { parseScientistSurnames } from '../src/robot/scientistNames';
import { createRobotProfile } from '../src/robot/functions';
import { defaultAbilities } from '../src/robot/abilities';

const scientistNames = parseScientistSurnames(readFileSync(new URL('../src/data/scientist-surnames.txt', import.meta.url), 'utf8'));

test('next generates at the end and cached navigation restores the original design', () => {
  let draws = 0;
  const history = new BotHistory(scientistNames, () => { draws++; return 0.2; });
  const first = structuredClone(history.current);
  const second = structuredClone(history.next());
  const third = structuredClone(history.next());
  const usedDraws = draws;
  assert.equal(history.count, 3);
  assert.deepEqual(history.previous(), second);
  assert.deepEqual(history.previous(), first);
  assert.equal(history.canGoBack, false);
  assert.deepEqual(history.previous(), first);
  assert.deepEqual(history.next(), second);
  assert.deepEqual(history.next(), third);
  assert.equal(draws, usedDraws);
  assert.equal(history.count, 3);
  assert.equal(history.position, 3);
  history.next();
  assert.equal(history.count, 4);
});

test('each new bot starts with a scientist name and a different upper body', () => {
  const history = new BotHistory(scientistNames, () => 0);
  for (let i = 0; i < 20; i++) {
    const previous = history.current;
    const next = history.next();
    assert.ok(scientistNames.some(name => name === next.name));
    assert.notEqual(next.name, previous.name);
    assert.notEqual(next.appearance.shape, previous.appearance.shape);
    assert.notEqual(next.appearance.colour.hex, previous.appearance.colour.hex);
    assert.notEqual(next.appearance.width, previous.appearance.width);
  }
});

test('names and profiles are saved independently for each bot', () => {
  const history = new BotHistory(scientistNames, () => 0.5);
  history.rename('  My art bot  ');
  history.updateProfile(createRobotProfile({ ...defaultAbilities(), speed: 85 }, ['vision', 'hearing', 'memory']));
  const first = structuredClone(history.current);
  history.next();
  history.rename('Second bot');
  history.updateProfile(createRobotProfile(defaultAbilities(), ['movement', 'balance', 'hearing']));
  const second = structuredClone(history.current);
  assert.deepEqual(history.previous(), first);
  assert.deepEqual(history.next(), second);
  assert.equal(first.name, 'My art bot');
  assert.equal(first.profile.abilities.speed, 85);
  assert.equal(second.profile.abilities.speed, 50);
});

test('invalid names are rejected without changing the saved name', () => {
  const history = new BotHistory(scientistNames);
  const name = history.current.name;
  assert.throws(() => history.rename('   '));
  assert.throws(() => history.rename('a'.repeat(61)));
  assert.equal(history.current.name, name);
});
