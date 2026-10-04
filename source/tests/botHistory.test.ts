import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { BotHistory } from '../src/robot/botHistory';
import { parseScientistSurnames } from '../src/robot/scientistNames';
import { createRobotProfile } from '../src/robot/functions';
import { defaultAbilities } from '../src/robot/abilities';
import { robotDesignStorageKey } from '../src/robot/designStorage';
import type { DesignStorage } from '../src/robot/designStorage';

function memoryStorage(): DesignStorage {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); } };
}

test('restart restores custom designs, edits and the selected history position', () => {
  const storage = memoryStorage();
  const history = new BotHistory(scientistNames, () => .2, storage);
  history.rename('My saved robot');
  history.updateProfile(createRobotProfile({ ...defaultAbilities(), speed: 85 }, ['vision', 'hearing', 'memory'], { painter: 'ink', musician: 'jazz' }));
  const first = structuredClone(history.current);
  const second = structuredClone(history.next());
  history.previous();
  const restored = new BotHistory(scientistNames, () => { throw new Error('Must not generate a replacement robot'); }, storage);
  assert.deepEqual(restored.current, first);
  assert.equal(restored.position, 1);
  assert.equal(restored.count, 2);
  assert.deepEqual(restored.next(), second);
  assert.equal(new BotHistory(scientistNames, Math.random, storage).position, 2);
});

test('restart restores the selected preset and its custom edits without duplicating it', () => {
  const storage = memoryStorage();
  const history = new BotHistory(scientistNames, () => .2, storage);
  history.selectPreset('donk');
  history.rename('My donkBot');
  history.updateProfile(createRobotProfile(defaultAbilities(), ['communication', 'hearing', 'balance'], { painter: 'pop', musician: 'techno' }));
  const restored = new BotHistory(scientistNames, Math.random, storage);
  assert.deepEqual(restored.current, history.current);
  assert.equal(restored.current.presetId, 'donk');
  restored.selectPreset('donk');
  assert.equal(restored.count, 2);
  assert.equal(restored.current.name, 'My donkBot');
  assert.equal(JSON.parse(storage.getItem(robotDesignStorageKey)!).bots[1].record, undefined);
});

test('invalid saved data falls back to a usable new design', () => {
  const storage = memoryStorage();
  new BotHistory(scientistNames, () => .2, storage);
  const valid = storage.getItem(robotDesignStorageKey)!;
  const invalid = [
    '{broken', 'null', JSON.stringify({ version: 2 }),
    JSON.stringify({ ...JSON.parse(valid), cursor: 100 }),
    JSON.stringify({ ...JSON.parse(valid), bots: [] }),
  ];
  const badProfile = JSON.parse(valid);
  badProfile.bots[0].profile.enabledFunctions = ['communication', 'communication', 'vision'];
  invalid.push(JSON.stringify(badProfile));
  const badAppearance = JSON.parse(valid);
  badAppearance.bots[0].appearance.width = -1;
  invalid.push(JSON.stringify(badAppearance));
  for (const value of invalid) {
    storage.setItem(robotDesignStorageKey, value);
    const restored = new BotHistory(scientistNames, () => .2, storage);
    assert.equal(restored.count, 1);
    assert.equal(restored.position, 1);
    assert.equal(restored.current.appearance.width, 1);
  }
});

test('unavailable storage does not prevent editing or navigation', () => {
  const unavailable = { getItem() { throw new Error('Blocked'); }, setItem() { throw new Error('Full'); } };
  const history = new BotHistory(scientistNames, () => .2, unavailable);
  history.rename('Still works');
  history.next();
  history.previous();
  assert.equal(history.current.name, 'Still works');
});

test('restoring editor controls preserves the preset creative metadata', () => {
  const storage = memoryStorage();
  const history = new BotHistory(scientistNames, () => .2, storage);
  history.selectPreset('aria');
  const creative = structuredClone(history.current.creative);
  const restored = new BotHistory(scientistNames, Math.random, storage);
  restored.updateProfile(restored.current.profile);
  assert.deepEqual(restored.current.creative, creative);
  assert.deepEqual(new BotHistory(scientistNames, Math.random, storage).current.creative, creative);
});

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
  history.updateProfile(createRobotProfile(defaultAbilities(), ['communication', 'balance', 'hearing']));
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


test('saved movement selections migrate to communication without losing the design', () => {
  const storage = memoryStorage();
  const history = new BotHistory(scientistNames, () => .2, storage);
  history.rename('Legacy robot');
  history.updateProfile(createRobotProfile({ ...defaultAbilities(), speed: 85 }, ['communication', 'vision', 'memory']));
  const saved = JSON.parse(storage.getItem(robotDesignStorageKey)!);
  saved.bots[0].profile.enabledFunctions[0] = 'movement';
  storage.setItem(robotDesignStorageKey, JSON.stringify(saved));
  const restored = new BotHistory(scientistNames, () => { throw new Error('Must restore legacy design'); }, storage);
  assert.equal(restored.current.name, 'Legacy robot');
  assert.deepEqual(restored.current.profile.enabledFunctions, ['communication', 'vision', 'memory']);
  assert.equal(restored.current.profile.effectiveAbilities.speed, 85);
});
