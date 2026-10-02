import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { CityJourney } from '../src/simulation/cityJourney';
import { CityDocument } from '../src/city/cityDocument';
import { cityBarriers, cityRoute } from '../src/city/cityLayout';

const bot = () => new BotHistory(['Curie', 'Einstein'], () => 0).current;

test('planning is untimed and city edits do not start the robot', () => {
  const journey = new CityJourney(bot(), true);
  journey.explore('music-seed');
  journey.update(1000);
  assert.equal(journey.ready, true);
  assert.equal(journey.machine.record.clock, 0);
  assert.equal(journey.metrics.journeysStarted, 0);
  assert.equal(journey.metrics.stepsTaken, 0);
  assert.deepEqual(journey.position, cityRoute[0]);
  journey.edit('stairs', true);
  journey.edit('sidewalk', 2.4);
  journey.undo(); journey.redo();
  assert.equal(journey.state, 'ready');
  assert.equal(journey.metrics.failures, 0);
  assert.equal(journey.metrics.interventions, 0);
  journey.start(); journey.start();
  assert.equal(journey.metrics.journeysStarted, 1);
  assert.equal(journey.machine.run.citySnapshot!.sidewalk, 2.4);
  assert.equal(journey.machine.run.citySnapshot!.stairs, true);
  journey.update(1);
  assert.ok(journey.metrics.distance > 0);
});

test('crossing time and pavement width determine access rather than a changed-feature flag', () => {
  const journey = new CityJourney(bot(), true);
  journey.edit('curb', true);
  journey.edit('crossing', 1.6); // A change, but still too short for this robot.
  assert.equal(journey.inaccessibleFeature('crossing'), true);
  journey.start(); journey.update(1000);
  assert.equal(journey.blocked?.id, 'crossing');
  journey.paused = true;
  journey.edit('crossing', journey.suggestedValue('crossing'));
  assert.equal(journey.blocked, null);
  assert.equal(journey.state, 'paused');
  journey.undo();
  assert.equal(journey.inaccessibleFeature('crossing'), true);
  assert.equal(journey.state, 'paused');
  journey.redo(); journey.paused = false; journey.update(1000);
  assert.equal(journey.blocked?.id, 'sidewalk');
  journey.edit('sidewalk', 1.3);
  assert.equal(journey.inaccessibleFeature('sidewalk'), true);
  journey.edit('sidewalk', journey.suggestedValue('sidewalk'));
  assert.equal(journey.inaccessibleFeature('sidewalk'), false);
  journey.update(1000);
  assert.equal(journey.blocked?.id, 'bridge');
});

test('undo and redo preserve pause, history and occupied surfaces', () => {
  const journey = new CityJourney(bot());
  for (const feature of cityBarriers) journey.intervene(feature.id);
  journey.undo(); // Undo elevator before the robot gets there.
  assert.equal(journey.city.get('elevator'), false);
  journey.redo();
  const distanceToRamp = cityRoute.slice(1, 9).reduce((sum, b, i) => {
    const a = cityRoute[i]!; return sum + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }, 0);
  journey.update((distanceToRamp + 2) / journey.speed);
  assert.equal(journey.edge, 8);
  assert.ok(journey.distanceOnEdge > 0);
  journey.paused = true;
  const position = journey.position;
  assert.equal(journey.edit('stairs', false), false);
  assert.equal(journey.city.get('stairs'), true);
  assert.deepEqual(journey.position, position);
  assert.equal(journey.state, 'paused');
  journey.edit('guidance', false);
  const eventCount = journey.events.length;
  journey.undo();
  assert.ok(journey.events.length > eventCount);
  assert.equal(journey.state, 'paused');
});

test('completed cities remain editable and retries retain changes without altering the old run', () => {
  const journey = new CityJourney(bot(), true);
  for (const feature of cityBarriers) journey.intervene(feature.id);
  journey.start(); journey.update(1000);
  assert.equal(journey.complete, true);
  const oldRun = structuredClone(journey.machine.run);
  journey.edit('curb', false);
  assert.deepEqual(journey.machine.run, oldRun);
  journey.restart();
  assert.equal(journey.city.get('curb'), false);
  assert.equal(journey.machine.run.citySnapshot!.curb, false);
  journey.update(1000);
  assert.equal(journey.blocked?.id, 'curb');
  assert.equal(journey.undo(), true);
  journey.update(1000);
  assert.equal(journey.complete, true);
  assert.deepEqual(journey.machine.record.runs[0], oldRun);
});

test('invalid edits are atomic and a fresh edit clears redo', () => {
  const city = new CityDocument();
  const original = city.snapshot();
  for (const value of [NaN, Infinity, 0, 7, true]) assert.throws(() => city.set('sidewalk', value));
  assert.throws(() => city.set('stairs', 1));
  assert.deepEqual(city.snapshot(), original);
  assert.equal(city.revision, 0);
  city.set('sidewalk', 2); city.undo(); city.set('crossing', 3);
  assert.equal(city.redo(), null);
  const snapshot = city.snapshot(); snapshot.crossing = 9;
  assert.equal(city.get('crossing'), 3);
});
