import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { CityJourney } from '../src/simulation/cityJourney';
import { ProceduralPainting } from '../src/art/ProceduralPainting';
import { JourneyCreativity } from '../src/art/JourneyCreativity';

const journey = () => new CityJourney(new BotHistory(['Curie', 'Einstein'], () => 0).current);

test('every step paints before any powerup, while barriers, achievements and incidents have distinct marks', () => {
  const j = journey();
  j.update(100);
  j.paused = true; j.update(2); j.paused = false;
  j.intervene('curb');
  j.update(100);
  const creation = new JourneyCreativity(j.bot);
  for (const event of j.machine.record.events) creation.consume(event);
  assert.equal(creation.art, true);
  assert.equal(creation.marks.filter(mark => mark.kind === 'step').length, j.metrics.stepsTaken);
  const kinds = new Set(creation.marks.map(mark => mark.kind));
  for (const kind of ['step', 'barrier', 'repair', 'achievement', 'incident']) assert.ok(kinds.has(kind as any), kind);
  const barrier = creation.marks.find(mark => mark.kind === 'barrier')!;
  const repair = creation.marks.find(mark => mark.kind === 'repair')!;
  assert.notEqual(barrier.pigment, repair.pigment);
  assert.equal(j.machine.run.pickups.length, 0);
});

test('painting data replays exactly, is serializable, and ignores duplicate events', () => {
  const j = journey(); j.update(5);
  const a = new ProceduralPainting(3571), b = new ProceduralPainting(3571);
  for (const event of j.machine.record.events) {
    a.consume(event); b.consume(JSON.parse(JSON.stringify(event)));
  }
  assert.deepEqual(a.marks, b.marks);
  assert.deepEqual(JSON.parse(JSON.stringify(a.marks)), a.marks);
  const original = structuredClone(a.marks);
  for (const event of j.machine.record.events) a.consume(event);
  assert.deepEqual(a.marks, original);
  for (const mark of a.marks) {
    assert.equal(mark.version, 1);
    assert.ok(mark.width > 0 && Number.isFinite(mark.width));
    for (const point of mark.points) assert.ok(point.x >= 0.09 && point.x <= 0.91 && point.y >= 0.09 && point.y <= 0.91);
  }
  const other = new ProceduralPainting(9812);
  for (const event of j.machine.record.events) other.consume(event);
  assert.notDeepEqual(a.marks, other.marks);
});

test('pausing and idle waiting never invent step strokes; powerups enrich subsequent paint', () => {
  const j = journey(); j.explore('art-seed'); j.explore('colour-seed');
  j.update(1); j.paused = true; j.update(30); j.paused = false; j.update(100);
  const painting = new ProceduralPainting(400);
  for (const event of j.machine.record.events) painting.consume(event);
  assert.equal(painting.marks.filter(mark => mark.kind === 'step').length, j.metrics.stepsTaken);
  assert.ok(painting.marks.some(mark => mark.kind === 'step' && !mark.rich));
  assert.ok(painting.marks.some(mark => mark.kind === 'step' && mark.rich));
  const previous = painting.marks.length;
  j.update(100);
  for (const event of j.machine.record.events) painting.consume(event);
  assert.equal(painting.marks.length, previous);
});

test('barriers influence following gestures and access improvements release that tension', () => {
  const j = journey(); j.update(100);
  const step = j.machine.record.events.find(event => event.type === 'step')!;
  const barrier = j.machine.record.events.find(event => event.type === 'blocked')!;
  const painting = new ProceduralPainting(9812);
  painting.consume({ ...step, sequence: 1 });
  painting.consume({ ...barrier, sequence: 2 });
  painting.consume({ ...step, sequence: 3 });
  const tense = painting.marks.at(-1)!;
  assert.equal(tense.pigment, '#313c4c');
  painting.consume({ ...barrier, type: 'intervention', sequence: 4 });
  painting.consume({ ...step, sequence: 5 });
  const relieved = painting.marks.at(-1)!;
  assert.notEqual(relieved.pigment, '#313c4c');
  assert.notDeepEqual(tense.points, relieved.points);
  assert.ok(tense.expression && relieved.expression);
});

test('expressive gestures vary pressure and wetness, lift the brush, and remain replayable', () => {
  const j = journey();
  for (let i = 0; i < 10 && !j.complete; i++) { j.update(100); if (j.blocked) j.intervene(j.blocked.id); }
  const a = new ProceduralPainting(42661), b = new ProceduralPainting(42661);
  for (const event of j.machine.record.events) { a.consume(event); b.consume(structuredClone(event)); }
  const steps = a.marks.filter(mark => mark.kind === 'step');
  assert.ok(steps.some(mark => mark.expression?.lift));
  assert.ok(steps.some(mark => !mark.expression?.lift));
  assert.ok(new Set(steps.map(mark => mark.expression!.pressure)).size > 20);
  assert.ok(new Set(steps.map(mark => mark.expression!.wetness)).size > 20);
  assert.deepEqual(a.marks, b.marks);
  assert.deepEqual(JSON.parse(JSON.stringify(a.marks)), a.marks);
});
