import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { CityJourney } from '../src/simulation/cityJourney';
import { cityBarriers, cityPowerups, cityRoute } from '../src/city/cityLayout';
import { JourneyCreativity } from '../src/art/JourneyCreativity';
import { SoundEffect } from '../src/audio/SoundEffect';

const bot = () => new BotHistory(['Curie', 'Einstein'], () => 0).current;

test('studio arrival provides a track without discoveries and preserves composed music', () => {
  const creation = new JourneyCreativity(bot());
  assert.equal(creation.score.length, 0);
  creation.finishMusic();
  assert.ok(creation.score.length > 0);
  assert.equal(creation.score[0]!.at, 0);
  assert.equal(creation.music, true);
  const saved = structuredClone(creation.score);
  creation.finishMusic();
  assert.deepEqual(creation.score, saved);
});

test('powerups require actual detour travel, collect once, and never bypass a barrier', () => {
  const j = new CityJourney(bot());
  assert.equal(j.explore('music-seed'), true);
  assert.equal(j.explore('music-seed'), false);
  j.update(1);
  assert.equal(j.exploring, 'music-seed');
  assert.equal(j.metrics.pickups, 0);
  assert.equal(j.edge, 0);
  j.paused = true; const position = j.position;
  j.update(10); assert.deepEqual(j.position, position);
  j.paused = false; j.update(100);
  assert.deepEqual(j.position, cityRoute[1]);
  assert.equal(j.blocked?.id, 'curb');
  assert.equal(j.machine.run.pickups.filter(p => p.id === 'music-seed').length, 1);
  assert.equal(j.explore('music-seed'), false);
  assert.equal(j.machine.record.events.find(e => e.type === 'pickup')!.position.x, -18);
  assert.equal(j.machine.record.events.find(e => e.type === 'pickup')!.position.z, -16);
  assert.equal(j.metrics.distance, 16);
  j.restart();
  assert.equal(j.plannedPowerups.size, 0);
  assert.equal(j.metrics.pickups, 0);
  assert.equal(j.explore('music-seed'), true);
});

test('detours preserve distance and pickup times across simulation tick sizes', () => {
  const a = new CityJourney(bot()), b = new CityJourney(bot());
  for (const j of [a, b]) for (const pickup of cityPowerups) j.explore(pickup.id);
  for (const j of [a, b]) for (const barrier of cityBarriers) j.intervene(barrier.id);
  a.update(240);
  for (let i = 0; i < 7200; i++) b.update(1 / 30);
  assert.equal(a.complete, true); assert.equal(b.complete, true);
  assert.deepEqual(a.position, cityRoute.at(-1));
  assert.ok(Math.abs(a.metrics.distance - b.metrics.distance) < 1e-7);
  assert.deepEqual(a.machine.run.pickups.map(p => p.id), b.machine.run.pickups.map(p => p.id));
  a.machine.run.pickups.forEach((p, i) => assert.ok(Math.abs(p.time - b.machine.run.pickups[i]!.time) < 1e-7));
  assert.equal(a.machine.run.pickups.filter(p => cityPowerups.some(powerup => powerup.id === p.id)).length, cityPowerups.length);
  const creation = new JourneyCreativity(a.bot);
  for (const event of a.events) creation.consume(event);
  assert.ok(creation.music && creation.art && creation.harmony && creation.colour);
  assert.ok(new Set(creation.marks.map(mark => mark.hue)).size > 1);
  assert.ok(creation.marks.some(mark => mark.shape === 'circle'));
  assert.ok(creation.marks.some(mark => mark.shape === 'diamond'));
});

test('creative modes unlock from collection and respond reproducibly to robot identity and route', () => {
  const original = bot();
  const j = new CityJourney(original);
  const a = new JourneyCreativity(original), b = new JourneyCreativity(structuredClone(original));
  assert.deepEqual(a.advance(0), []);
  j.explore('music-seed'); j.explore('art-seed');
  j.update(100);
  for (const event of j.events) { a.consume(event); b.consume(JSON.parse(JSON.stringify(event))); }
  assert.equal(a.music, true); assert.equal(a.art, true);
  assert.ok(a.marks.length > 0);
  const phrase = a.advance(20);
  assert.deepEqual(phrase, b.advance(20));
  assert.deepEqual(a.advance(20), []);
  assert.deepEqual(a.advance(21, true), []);
  for (const entry of phrase) assert.deepEqual(SoundEffect.fromScore(entry.score).toScore(), entry.score);
  const before = structuredClone(a.marks);
  for (const event of j.events) a.consume(event);
  assert.deepEqual(a.marks, before);
  const different = new JourneyCreativity({ ...original, id: original.id + 1 });
  assert.notEqual(a.seed, different.seed);
  for (const event of j.events) different.consume(event);
  assert.notDeepEqual(phrase, different.advance(20));
  j.intervene('curb'); j.intervene('crossing'); j.intervene('sidewalk');
  j.explore('harmony-seed'); j.update(100);
  for (const event of j.events) a.consume(event);
  assert.equal(a.harmony, true);
  assert.equal(a.advance(100).length, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(a.score)), a.score);
});
