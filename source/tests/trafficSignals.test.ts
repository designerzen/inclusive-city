import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { createRobotProfile, robotFunctions } from '../src/robot/functions';
import { defaultAbilities } from '../src/robot/abilities';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { crossingSignal } from '../src/city/trafficSignals';
import type { FunctionId } from '../src/robot/functions';
import type { ProceduralCity } from '../src/city/proceduralCity';
import { robotButtonReach } from '../src/city/proceduralCity';

function crossing(functions: FunctionId[] = ['movement', 'vision', 'memory'], green = 12) {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  bot.profile = createRobotProfile({ ...defaultAbilities(), speed: 0 }, functions);
  const world: ProceduralCity = { seed: 1, start: 'a', destination: 'b', riverX: 30, rememberedRobots: 1, buildings: [],
    nodes: [{ id: 'a', label: 'Start', x: 0, y: .16, z: 0 }, { id: 'b', label: 'End', x: 6, y: .16, z: 0 }],
    streets: [{ id: 'cross', a: 'a', b: 'b', kind: 'crossing', width: 2.6, crossingSeconds: green }] };
  return new PlannedJourney(bot, world);
}

test('eyes and ears are two of exactly five selectable robot abilities', () => {
  assert.equal(robotFunctions.length, 5);
  assert.equal(robotFunctions.find(f => f.id === 'vision')?.label, 'Robot eyes');
  assert.equal(robotFunctions.find(f => f.id === 'hearing')?.label, 'Robot ears');
});

test('pedestrian green and clearance stop road traffic, with red before each green', () => {
  assert.equal(crossingSignal(0, 12).green, false);
  assert.equal(crossingSignal(4, 12).green, true);
  assert.equal(crossingSignal(16, 12).green, false);
  assert.equal(crossingSignal(16, 12).clearance, true);
  assert.equal(crossingSignal(18, 12).clearance, false);
});

test('a slow robot waits for green without a failure, then finishes before red', () => {
  const j = crossing(); j.start(); j.update(3);
  assert.equal(j.waiting, true); assert.equal(j.metrics.distance, 0);
  assert.equal(j.metrics.failures, 0); assert.equal(j.metrics.waitingSeconds, 3);
  j.update(1.1); assert.ok(j.distanceOnEdge > 0);
  j.update(8); assert.equal(j.complete, true);
  assert.ok(j.signalTime < 16);
});

test('short green is a barrier based on the full crossing length; extending it resolves it', () => {
  const j = crossing(undefined, 4); j.start(); j.update(1);
  assert.equal(j.blocked?.id, 'cross'); assert.match(j.blocked!.reason, /7.5 seconds/);
  assert.equal(j.repair('cross'), true); j.update(30); assert.equal(j.complete, true);
});

test('robots without eyes need beepers; robots without eyes or ears use tactile cues', () => {
  for (const functions of [['movement', 'hearing', 'memory'], ['movement', 'balance', 'memory']] as FunctionId[][]) {
    const j = crossing(functions); j.start(); j.update(1);
    assert.match(j.blocked!.reason, /cannot see/);
    assert.equal(j.repair('signals:cross'), true);
    assert.notEqual(j.machine.record.failures[0]!.resolvedAt, null);
    assert.equal(j.undoRepair(), true); j.update(1); assert.ok(j.blocked);
    j.repair('signals:cross'); j.update(30); assert.equal(j.complete, true);
    assert.equal(j.crossingCue(j.world.streets[0]!), functions.includes('hearing') ? 'audible' : 'tactile');
    assert.equal(j.machine.run.citySnapshot!['signals:cross'], true);
  }
});

test('late arrivals wait for the next full green; pauses, restarts and tick sizes agree', () => {
  const a = crossing(), b = crossing();
  for (const j of [a, b]) { j.start(); j.setPaused(true); j.update(10); j.setPaused(false); }
  a.update(1); assert.equal(a.waiting, true); assert.equal(a.metrics.distance, 0);
  a.update(29); for (let i = 0; i < 900; i++) b.update(1 / 30);
  assert.equal(a.complete, true); assert.equal(b.complete, true);
  assert.ok(Math.abs(a.metrics.waitingSeconds - b.metrics.waitingSeconds) < 1e-6);
  a.restart(); a.start(); a.update(1); assert.equal(a.waiting, true);
  assert.equal(a.metrics.distance, 0);
});

test('short reach blocks a crossing even on green until its button panel is lowered', () => {
  const j = crossing();
  j.bot.profile = createRobotProfile({ ...defaultAbilities(), speed: 0, reach: 0 }, ['movement', 'vision', 'memory']);
  const original = structuredClone(j.bot.profile), street = j.world.streets[0]!;
  j.start(); j.setPaused(true); j.update(4); j.setPaused(false); j.update(.1);
  assert.equal(j.signal(street).green, true);
  assert.equal(j.metrics.distance, 0); assert.match(j.blocked!.reason, /Lower the button panel/);
  assert.equal(j.hasRequestedCrossing(street), false);
  assert.equal(j.machine.record.events.filter(e => e.type === 'crossing_requested').length, 0);
  assert.equal(j.repair(street.id), true);
  assert.ok(street.buttonHeight! <= robotButtonReach(j.bot));
  assert.equal(j.undoRepair(), true); assert.equal(street.buttonHeight, 1.5);
  j.update(.1); assert.ok(j.blocked);
  j.repair(street.id); j.update(.1);
  assert.equal(j.hasRequestedCrossing(street), true);
  assert.equal(j.machine.record.events.filter(e => e.type === 'crossing_requested').length, 1);
  assert.deepEqual(j.bot.profile, original);
  j.update(30); assert.equal(j.complete, true);
  const saved = structuredClone(j.machine.run);
  j.restart(); assert.equal(j.dimensions.get('panel:cross'), .8);
  assert.equal(saved.citySnapshot!['panel:cross'], .8);
  j.start(); assert.equal(j.hasRequestedCrossing(street), false);
});

test('long reach operates the high panel once per crossing and panel edits respect occupancy', () => {
  const j = crossing();
  j.bot.profile = createRobotProfile({ ...defaultAbilities(), speed: 0, reach: 100 }, ['movement', 'vision', 'memory']);
  const street = j.world.streets[0]!;
  j.start(); j.update(2);
  assert.equal(j.waiting, true); assert.equal(j.blocked, null);
  assert.equal(j.hasRequestedCrossing(street), true);
  j.update(1); assert.equal(j.machine.record.events.filter(e => e.type === 'crossing_requested').length, 1);
  j.update(1.1); assert.ok(j.distanceOnEdge > 0);
  assert.equal(j.editDimension('panel:cross', 2.2), false);
});

test('lowering a panel does not bypass crossing timing or sensory barriers', () => {
  const j = crossing(['movement', 'hearing', 'memory'], 2);
  j.bot.profile = createRobotProfile({ ...defaultAbilities(), speed: 0, reach: 0 }, ['movement', 'hearing', 'memory']);
  j.start(); j.update(1); assert.ok(j.reachProblem(j.world.streets[0]!));
  j.repair('cross'); j.update(1); assert.match(j.blocked!.reason, /green light gives/);
  j.repair('cross'); j.update(1); j.repair('cross'); j.update(30);
  assert.equal(j.complete, true);
  assert.equal(j.machine.record.events.filter(e => e.type === 'crossing_requested').length, 1);
});
