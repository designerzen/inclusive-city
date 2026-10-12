import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity, routeToGoal } from '../src/city/proceduralCity';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { createRoadGeometryCache } from '../src/city/roadGeometryCache';
import { mergeRoadStrips, roadPolygonUnion, type RoadPolygon } from '../src/city/roadPolygonUnion';
import { routeRoadPolygons } from '../src/city/routeRoad';
import { RouteTrajectory } from '../src/city/routeTrajectory';
import { cityRoadNetwork } from '../src/city/cityRoadNetwork';

function areas(polygons: readonly RoadPolygon[], clearance = false) {
  return [...roadPolygonUnion(polygons, clearance ? [{ minX: 2, maxX: 4, minZ: -3, maxZ: 3 }] : [])]
    .map(([id, data]) => {
      let area = 0;
      for (let i = 0; i < data.indices.length; i += 3) {
        const [a, b, c] = data.indices.slice(i, i + 3).map(index => index * 3);
        area += ((data.positions[b!]! - data.positions[a!]!) * (data.positions[c! + 2]! - data.positions[a! + 2]!) -
          (data.positions[b! + 2]! - data.positions[a! + 2]!) * (data.positions[c!]! - data.positions[a!]!)) / 2;
      }
      return [id, area] as const;
    });
}

test('merged curved ribbons retain street ownership and clearance area', () => {
  const route = new RouteTrajectory([new Vector3(-8, 0, 0), new Vector3(0, 0, 0), new Vector3(0, 0, 8)]);
  const strips = routeRoadPolygons(route, [{ id: 'a', width: 2 }, { id: 'b', width: 3 }]);
  assert.ok(mergeRoadStrips(strips).length < strips.length / 10);
  // Rotating each quad keeps its footprint but prevents strip merging; use it
  // as an independent unmerged sweep to check both area and priority ownership.
  const unmerged = strips.map(p => ({ ...p, points: [...p.points.slice(1), p.points[0]!] }));
  assert.equal(mergeRoadStrips(unmerged).length, strips.length);
  const overlay = { id: 'other', points: [[-5, -2], [2, -2], [2, 3], [-5, 3]] };
  for (const clearance of [false, true]) {
    const expected = new Map(areas([...unmerged, overlay], clearance));
    for (const [id, actual] of areas([...strips, overlay], clearance)) {
      assert.ok(Math.abs(actual - expected.get(id)!) < 1e-7, `${id} footprint and ownership are unchanged`);
    }
  }
});

test('a generated city preserves each street area and overlap ownership after strip merging', () => {
  const bot = new BotHistory(['Curie', 'Einstein'], () => 0).current, world = generateCity(42, [bot]);
  const j = new PlannedJourney(bot, world); j.enableLineFollowing(); j.setRoute(routeToGoal(world, world.start)!);
  const streets = j.route.slice(1).map((id, i) => world.streets.find(s => s.a === id && s.b === j.route[i] || s.b === id && s.a === j.route[i])!);
  const polygons = [...cityRoadNetwork(world, j.minimumTurnRadius).polygons, ...routeRoadPolygons(j.trajectory, streets)];
  const unmerged = polygons.map(p => p.points.length === 4 ? { ...p, points: [...p.points.slice(1), p.points[0]!] } : p);
  const expected = new Map(areas(unmerged));
  for (const [id, actual] of areas(polygons)) assert.ok(Math.abs(actual - expected.get(id)!) < 1e-6, id);
});

test('self-overlapping strips and differing clearance policies retain union semantics', () => {
  const strips: RoadPolygon[] = [
    { id: 'a', points: [[0, 0], [2, 0], [2, 2], [0, 2]] },
    { id: 'a', points: [[2, 0], [0, 0], [0, 2], [2, 2]] },
  ];
  assert.equal(mergeRoadStrips(strips).length, 2);
  assert.equal(new Map(areas(strips)).get('a'), 4);
  assert.equal(mergeRoadStrips([strips[0]!, { id: 'a', needsClearance: true, points: [[2, 0], [4, 0], [4, 2], [2, 2]] }]).length, 2);
});

test('road cache reuses meshes for UI, repairs and bikes but invalidates actual geometry', () => {
  const bot = new BotHistory(['Curie', 'Einstein'], () => 0).current, world = generateCity(42, [bot]);
  const j = new PlannedJourney(bot, world); j.enableLineFollowing();
  const cache = createRoadGeometryCache();
  let previewWidth: number | undefined;
  const width = (street: typeof world.streets[number]) => street === world.streets[0] ? previewWidth ?? street.width : street.width;
  const read = () => cache(world, j.trajectory, j.route, j.minimumTurnRadius, width);
  const initial = read();
  j.repaired.add('communication');
  if (world.bicycles?.[0]) world.bicycles[0].pushDistance = 3;
  assert.equal(read(), initial);
  const building = world.buildings[0]!;
  assert.ok(j.editDimension(`door:${building.name}`, 1.8));
  assert.equal(read(), initial, 'a fresh trajectory with the same footprint reuses the asphalt');
  previewWidth = world.streets[0]!.width + .4;
  const widened = read(); assert.notEqual(widened, initial); assert.equal(read(), widened);
  previewWidth = undefined;
  const cancelled = read(); assert.notEqual(cancelled, widened);
  j.setRoute(routeToGoal(world, world.start)!);
  const routed = read(); assert.notEqual(routed, cancelled); assert.equal(read(), routed);
  j.setMinimumTurnRadius(4);
  assert.notEqual(read(), routed);
});
