import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { RobotStateMachine } from '../src/robot/robotState';
import { CityJourney } from '../src/simulation/cityJourney';
import { cityBarriers, cityPickups, cityRoute } from '../src/city/cityLayout';

const history = () => new BotHistory(['Curie', 'Einstein'], () => 0);
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ≠ ${b}`);

test('state transitions, wait durations and resolved environment failures are recorded once', () => {
  const bot = history().current;
  const j = new CityJourney(bot);
  assert.equal(j.state, 'following');
  j.update(8 / j.speed + 2);
  assert.equal(j.state, 'blocked');
  assert.equal(bot.record.metrics.failures, 1);
  close(j.metrics.blockedSeconds, 2);
  j.update(3);
  assert.equal(bot.record.failures.length, 1);
  close(j.metrics.blockedSeconds, 5);
  j.paused = true; j.update(4);
  assert.equal(j.state, 'paused');
  close(j.metrics.pausedSeconds, 4);
  j.intervene('curb'); j.intervene('curb');
  assert.equal(j.metrics.interventions, 1);
  assert.equal(bot.record.failures[0]!.resolvedAt, bot.record.clock);
  j.paused = false;
  assert.equal(j.state, 'following');
  assert.equal(bot.record.metrics.stepsTaken, 8);
  j.paused = true;
  assert.throws(() => j.machine.transition('collecting'), /Invalid robot transition/);
});

test('distance milestones and their event times are independent of render frequency', () => {
  const a = new CityJourney(history().current), b = new CityJourney(history().current);
  a.update(3);
  for (let i = 0; i < 90; i++) b.update(1 / 30);
  close(a.metrics.distance, b.metrics.distance);
  assert.equal(a.metrics.stepsTaken, b.metrics.stepsTaken);
  const eventsA = a.machine.record.events.filter(e => e.type === 'step');
  const eventsB = b.machine.record.events.filter(e => e.type === 'step');
  assert.equal(eventsA.length, eventsB.length);
  eventsA.forEach((event, i) => { close(event.time, eventsB[i]!.time); close(event.position.x, eventsB[i]!.position.x); });
});

test('restart archives each run, keeps totals, collects items once per run, and awards achievements once', () => {
  const j = new CityJourney(history().current);
  for (const barrier of cityBarriers) j.intervene(barrier.id);
  j.update(1000);
  const record = j.machine.record;
  const distance = cityRoute.slice(1).reduce((sum, b, i) => {
    const a = cityRoute[i]!; return sum + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  }, 0);
  close(j.metrics.distance, distance);
  assert.equal(j.metrics.pickups, cityPickups.length);
  assert.equal(j.metrics.pickupValue, 6);
  assert.equal(record.runs[0]!.status, 'completed');
  const oldRun = structuredClone(record.runs[0]);
  j.restart();
  assert.equal(j.metrics.distance, 0);
  j.update(1000);
  assert.deepEqual(record.runs[0], oldRun);
  assert.equal(record.metrics.journeysCompleted, 2);
  assert.equal(record.metrics.pickups, 6);
  close(record.metrics.distance, distance * 2);
  assert.equal(record.achievements.filter(a => a.id === 'gallery-reached').length, 1);
  assert.equal(j.recordPickup('late', 'art-fragment'), false);
});

test('cached robots have independent histories and configuration snapshots survive renaming', () => {
  const h = history(), first = h.current;
  const j = new CityJourney(first);
  assert.equal(j.recordPickup('sample', 'art-fragment', 4), true);
  assert.equal(j.recordPickup('sample', 'art-fragment', 4), false);
  assert.throws(() => j.recordPickup('bad', 'art-fragment', NaN));
  j.update(1); j.leave();
  assert.equal(first.record.state, 'designer');
  assert.equal(first.record.runs[0]!.status, 'interrupted');
  h.rename('My bot');
  assert.equal(first.record.metadata.name, 'My bot');
  assert.equal(first.record.runs[0]!.metadata.name, 'Curie');
  const second = h.next();
  assert.equal(second.record.events.length, 0);
  assert.equal(second.record.metrics.distance, 0);
  h.previous();
  assert.equal(h.current.record.metrics.pickups, 1);
  assert.equal(h.current.record.metrics.pickupValue, 4);
});

test('music consumers receive ordered serializable detached data with stable event cursors', () => {
  const j = new CityJourney(history().current);
  j.update(2);
  const snapshot = j.machine.snapshot();
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)), snapshot);
  const events = j.machine.eventsSince(2);
  assert.ok(events.every(e => e.sequence > 2 && e.botId === j.bot.id && e.runId === 1));
  assert.ok(events.every((e, i) => i === 0 || e.time >= events[i - 1]!.time));
  snapshot.metadata.name = 'Changed';
  events[0]!.position.x = 999;
  assert.equal(j.machine.record.metadata.name, 'Curie');
  assert.notEqual(j.machine.record.events[2]!.position.x, 999);
  const empty = history().current.record;
  const machine = new RobotStateMachine(empty, () => ({ edge: 0, position: cityRoute[0]! }));
  assert.throws(() => machine.transition('arrived'), /Invalid robot transition/);
});
