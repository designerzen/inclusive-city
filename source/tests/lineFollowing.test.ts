import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import type { ProceduralCity } from '../src/city/proceduralCity';

function fixture() {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  const world: ProceduralCity = { seed: 1, start: 'a', destination: 'd', riverX: 40, rememberedRobots: 1, buildings: [],
    nodes: [{ id: 'a', label: 'Workshop', x: 0, y: .16, z: 0 }, { id: 'b', label: 'Corner', x: 8, y: .16, z: 0 },
      { id: 'c', label: 'Corner', x: 8, y: .16, z: 8 }, { id: 'd', label: 'Studio', x: 16, y: .16, z: 8 }],
    streets: [{ id: 'ab', a: 'a', b: 'b', kind: 'clear', width: 6, crossingSeconds: 20 },
      { id: 'bc', a: 'b', b: 'c', kind: 'clear', width: 6, crossingSeconds: 20 },
      { id: 'cd', a: 'c', b: 'd', kind: 'clear', width: 6, crossingSeconds: 20 }] };
  const j = new PlannedJourney(bot, world); j.enableLineFollowing(); j.start();
  return j;
}

test('minimum radius changes the shared route before departure and is saved with the city', () => {
  const j = fixture(); j.restart();
  const previous = j.trajectory.points.map(p => p.asArray());
  assert.equal(j.setMinimumTurnRadius(6), true);
  assert.notDeepEqual(j.trajectory.points.map(p => p.asArray()), previous);
  assert.equal(j.machine.run.cityPlan!.world.minimumTurnRadius, 6);
  assert.equal(j.setMinimumTurnRadius(NaN), false);
  assert.equal(j.setMinimumTurnRadius(0), false);
  j.start(); assert.equal(j.setMinimumTurnRadius(4), false, 'travelling robot cannot jump onto a changed line');
  j.update(100); assert.equal(j.complete, true);
  assert.ok(Math.abs(j.metrics.distance - j.trajectory.length) < 1e-8);
});

test('the follower advances on the exact rendered curve and steers while moving', () => {
  const j = fixture();
  let sweptCorner = false, turningWhileMoving = false;
  for (let i = 0; i < 1200 && !j.complete; i++) {
    const previous = j.position, heading = j.heading;
    j.update(1 / 60);
    const expected = j.trajectory.atEdge(j.edge, j.distanceOnEdge).position;
    assert.ok(Math.hypot(j.position.x - expected.x, j.position.z - expected.z) < 1e-9);
    if (j.position.x < 8 && j.position.z > 0 && j.position.z < 3.9) sweptCorner = true;
    if (Math.abs(j.heading - heading) > 1e-4 && Math.hypot(j.position.x - previous.x, j.position.z - previous.z) > .001) turningWhileMoving = true;
  }
  assert.ok(sweptCorner, 'robot takes the sweeping bend instead of the old right angle');
  assert.ok(turningWhileMoving, 'robot steers continuously rather than pivoting at the dot');
  assert.equal(j.complete, true);
  assert.ok(Math.abs(j.metrics.distance - j.trajectory.length) < 1e-8);
});

test('pause, restart, barriers and frame sizes preserve the shared path', () => {
  const large = fixture(), small = fixture();
  large.update(2); large.setPaused(true); const stopped = large.position;
  large.update(20); assert.deepEqual(large.position, stopped);
  large.setPaused(false); large.update(1);
  for (let i = 0; i < 180; i++) small.update(1 / 60);
  assert.ok(Math.hypot(large.position.x - small.position.x, large.position.z - small.position.z) < 1e-8);
  large.restart(); assert.deepEqual(large.position, { x: 0, y: .16, z: 0 });
  const barrier = fixture(); barrier.world.streets[1]!.kind = 'curb';
  barrier.update(100); assert.equal(barrier.blocked?.id, 'bc');
  const p = barrier.position; barrier.update(100); assert.deepEqual(barrier.position, p);
  barrier.repair('bc'); barrier.update(100); assert.equal(barrier.complete, true);
});

test('collision sweeps receive successive samples of the same curved line', () => {
  const j = fixture(); let curveSweeps = 0;
  j.constrainTravel = (from, to) => {
    const expected = j.trajectory.atEdge(j.edge, j.distanceOnEdge).position;
    assert.ok(Math.hypot(from.x - expected.x, from.z - expected.z) < 1e-8);
    if (Math.abs(to.x - from.x) > 1e-5 && Math.abs(to.z - from.z) > 1e-5) curveSweeps++;
    return { distance: Math.hypot(to.x - from.x, to.z - from.z) };
  };
  j.update(100);
  assert.ok(curveSweeps > 50);
  assert.equal(j.complete, true);
});

test('blocked travel can return to a junction, unlock undo and resume without losing the route', () => {
  const j = fixture();
  j.restart();
  const before = j.dimensions.get('width:ab')!;
  assert.equal(j.editDimension('width:ab', before + 1), true);
  j.start(); j.update(1);
  const route = [...j.route], run = j.machine.run.id;
  assert.ok(j.distanceOnEdge > 0);
  j.blocked = { id: 'ab', reason: 'A solid object blocks this street.' };
  assert.equal(j.undoAvailable, false);
  assert.equal(j.hasCityChanges, true);
  let synced = 0;
  j.syncTransport = () => { synced++; assert.equal(j.distanceOnEdge, 0); };
  assert.equal(j.backToJunction(), true);
  assert.equal(synced, 1);
  assert.equal(j.paused, true);
  assert.equal(j.blocked, null);
  assert.equal(j.machine.state, 'paused');
  assert.equal(j.machine.run.id, run);
  assert.deepEqual(j.route, route);
  assert.equal(j.undoRepair(), true);
  assert.equal(j.dimensions.get('width:ab'), before);
  const position = j.position; j.update(10); assert.deepEqual(j.position, position);
  j.setPaused(false); j.update(100); assert.equal(j.complete, true);
  assert.equal(j.backToJunction(), false);
});

test('restart for a different route keeps city edits and undo history', () => {
  const j = fixture();
  j.restart(); j.editDimension('width:ab', 7); j.start(); j.update(1);
  j.blocked = { id: 'ab', reason: 'A solid object blocks this street.' };
  j.restart(); j.clearRoute();
  assert.equal(j.ready, true); assert.deepEqual(j.route, ['a']);
  assert.equal(j.dimensions.get('width:ab'), 7);
  assert.equal(j.undoRepair(), true);
  assert.equal(j.dimensions.get('width:ab'), 6);
});
