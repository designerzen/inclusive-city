import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RouteTrajectory } from '../src/city/routeTrajectory';
import { buildingRouteClearance, cityRouteClearance } from '../src/city/routeClearance';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity } from '../src/city/proceduralCity';

const point = (x: number, z: number) => ({ x, y: .16, z });

test('corner routing clears the whole robot footprint while retaining safe bends', () => {
  const stops = [point(0, 0), point(8, 0), point(8, 8), point(16, 8), point(16, 16)];
  const clear = buildingRouteClearance([{ name: 'Corner building', x: 5.6, z: 2.4, w: 2, d: 2, h: 3 }], .7);
  const unsafe = new RouteTrajectory(stops);
  assert.ok(unsafe.points.some((p, i) => i > 0 && !clear(unsafe.points[i - 1]!, p)), 'old smoothing intersects the expanded building');
  const safe = new RouteTrajectory(stops, new Map(), 3, clear);
  assert.ok(safe.points.every((p, i) => i === 0 || clear(safe.points[i - 1]!, p)));
  assert.ok(safe.points.some(p => p.x === 8 && p.z === 0), 'tight corner retains its street junction');
  assert.ok(safe.points.length > stops.length, 'roomy corners remain curved');
  assert.deepEqual(safe.atEdge(0, 0).position.asArray(), [0, .16, 0]);
  assert.deepEqual(safe.sample(safe.length).position.asArray(), [16, .16, 16]);
});

test('swept clearance catches an obstruction between samples and accounts for capsule width', () => {
  const clear = buildingRouteClearance([{ name: 'Wall', x: 4, z: 2, w: 1, d: 1, h: 3 }], 1);
  assert.equal(clear(point(0, 2), point(8, 2)), false);
  assert.equal(clear(point(0, .75), point(8, .75)), false, 'centreline misses the wall but capsule touches it');
  assert.equal(clear(point(0, 0), point(8, 0)), true);
});

test('bridge footprints on adjacent streets constrain bends and station exits stay flat', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  const world = generateCity(42, [bot]);
  for (const id of ['2-2', '3-2']) assert.ok(world.streets.filter(s => s.a === id || s.b === id).every(s => s.kind !== 'stairs'));
  world.buildings = []; world.steamTrain = undefined;
  world.nodes = [{ id: 'a', label: 'A', ...point(4, 2) }, { id: 'b', label: 'B', ...point(4, 8) }];
  world.streets = [{ id: 'raised', a: 'a', b: 'b', kind: 'stairs', width: 2.6, crossingSeconds: 20 }];
  assert.equal(cityRouteClearance(world, .7)(point(0, 4), point(8, 4)), false);
});
