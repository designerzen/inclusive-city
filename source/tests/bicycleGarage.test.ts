import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { generateCity } from '../src/city/proceduralCity';
import type { ProceduralCity } from '../src/city/proceduralCity';

function setup(reverse = false) {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  const world: ProceduralCity = {
    seed: 1, start: reverse ? 'b' : 'a', destination: reverse ? 'a' : 'b', riverX: 20, rememberedRobots: 1, buildings: [],
    nodes: [{ id: 'a', label: 'A', x: 0, y: .16, z: 0 }, { id: 'b', label: 'B', x: 12, y: .16, z: 0 }],
    streets: [{ id: 'road', a: 'a', b: 'b', kind: 'clear', width: 6, crossingSeconds: 20 }],
    bicycleGarage: { x: 5, z: 6 }, bicycles: [{ id: 'bicycle-1', street: 'road', location: 'road' }],
  };
  return new PlannedJourney(bot, world);
}

test('bicycles stop travel in either direction until the user stores them, including with physics', () => {
  for (const reverse of [false, true]) for (const physics of [false, true]) {
    const j = setup(reverse);
    if (physics) j.constrainTravel = (from, to) => ({ distance: Math.hypot(to.x - from.x, to.z - from.z) });
    j.start(); j.update(100);
    assert.equal(j.blocked?.id, 'bicycle-1'); assert.equal(j.complete, false);
    assert.ok(reverse ? j.position.x > 6 : j.position.x < 6);
    const stopped = j.position; j.update(100); assert.deepEqual(j.position, stopped);
    assert.equal(j.machine.record.failures.length, 1);
    assert.equal(j.repair('bicycle-unknown'), false);
    assert.equal(j.repair('bicycle-1'), true); assert.equal(j.repair('bicycle-1'), false);
    assert.equal(j.blocked, null); j.update(100); assert.equal(j.complete, true);
    assert.ok(j.machine.record.failures[0]!.resolvedAt !== null);
    assert.ok(j.machine.run.cityPlan!.improvements.includes('bicycle-1'));
  }
});

test('moving bikes supports undo, paused journeys, restart and independent street barriers', () => {
  const j = setup(); j.world.streets[0]!.kind = 'curb';
  j.start(); j.update(100); assert.equal(j.blocked?.id, 'road');
  j.repair('road'); j.update(100); assert.equal(j.blocked?.id, 'bicycle-1');
  j.setPaused(true); j.repair('bicycle-1'); assert.equal(j.paused, true);
  assert.equal(j.undoRepair(), true); j.setPaused(false); j.update(100);
  assert.equal(j.blocked?.id, 'bicycle-1'); j.repair('bicycle-1'); j.restart();
  assert.ok(j.repaired.has('bicycle-1')); j.start(); j.update(100); assert.equal(j.complete, true);
});

test('generated cities have a garage and bicycles on roads and pavements, blocking every workshop exit', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  for (let seed = 0; seed < 30; seed++) {
    const world = generateCity(seed, [bot]);
    assert.ok(world.bicycleGarage); assert.ok(world.bicycles!.some(b => b.location === 'pavement'));
    assert.ok(world.bicycles!.some(b => b.location === 'road'));
    for (const street of world.streets.filter(s => s.a === world.start || s.b === world.start)) {
      assert.ok(world.bicycles!.some(b => b.street === street.id));
    }
  }
});
