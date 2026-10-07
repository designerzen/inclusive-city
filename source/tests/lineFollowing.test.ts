import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { generateCity, routeToGoal, type ProceduralCity } from '../src/city/proceduralCity';

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

test('the complete generated line has no sharp joins at bridges or train platforms', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  for (const seed of [42, 204063043]) for (const radius of [1, 3, 8, 12]) {
    const world = generateCity(seed, [bot]); world.minimumTurnRadius = radius;
    const j = new PlannedJourney(bot, world); j.enableLineFollowing(); j.setRoute(routeToGoal(world)!);
    const points = j.trajectory.points;
    for (let i = 2; i < points.length; i++) {
      const a = points[i - 1]!.subtract(points[i - 2]!).normalize(), b = points[i]!.subtract(points[i - 1]!).normalize();
      assert.ok(a.x * b.x + a.z * b.z > .998, `seed ${seed}, radius ${radius}, sample ${i}: ground and transport joins are tangent`);
    }
    j.repair('communication');
    for (const s of world.streets) { if (s.id !== world.steamTrain?.street) j.repair(s.id); }
    j.start();
    for (let frame = 0; frame < 3000 && !j.complete; frame++) {
      j.update(.2);
      if (j.needsTrainRamp) j.requestTrainRamp('roboramp');
      if (j.onTrainLink) {
        const p = j.position;
        let distance = Infinity;
        for (let i = 1; i < points.length; i++) {
          const a = points[i - 1]!, b = points[i]!, dx = b.x - a.x, dz = b.z - a.z;
          const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)));
          distance = Math.min(distance, Math.hypot(p.x - a.x - dx * t, p.z - a.z - dz * t));
        }
        assert.ok(distance < 1e-7, 'boarding, riding and exit remain on the painted line');
      }
      if (j.blocked && !j.needsTrainRamp) break;
    }
  }
});
