import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { cityRoadNetwork } from '../src/city/cityRoadNetwork';
import { roadPolygonUnion } from '../src/city/roadPolygonUnion';
import { routeRoadPolygons } from '../src/city/routeRoad';
import { createRoadSurface, updateRoadSurface } from '../src/city/roadSurface';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity, routeToGoal, type ProceduralCity } from '../src/city/proceduralCity';

const point = (id: string, x: number, z: number) => ({ id, label: id, x, y: .16, z });
function bend(): ProceduralCity {
  return { seed: 1, start: 'a', destination: 'c', nodes: [point('a', -8, 0), point('b', 0, 0), point('c', 0, 8)],
    streets: [{ id: 'ab', a: 'a', b: 'b', kind: 'clear', width: 2.6, crossingSeconds: 20 }, { id: 'bc', a: 'b', b: 'c', kind: 'clear', width: 2.6, crossingSeconds: 20 }], buildings: [], riverX: 40, rememberedRobots: 1 };
}
test('the actual road replaces the outer square corner with a swept circular section', () => {
  const world = bend(), network = cityRoadNetwork(world, 3), engine = new NullEngine(), scene = new Scene(engine);
  try {
    assert.equal(network.turns.length, 1);
    const meshes = [...roadPolygonUnion(network.polygons)].map(([id, data]) => { const mesh = createRoadSurface(id, scene); updateRoadSurface(mesh, data); mesh.computeWorldMatrix(true); return mesh; });
    const onRoad = (x: number, z: number) => scene.pickWithRay(new Ray(new Vector3(x, 3, z), new Vector3(0, -1, 0)), m => meshes.includes(m))?.hit;
    assert.equal(onRoad(1.1, -1.1), false, 'the old rectangular corner is gone, not hidden under another curve');
    assert.equal(onRoad(-5, 0), true, 'approach remains straight');
    assert.equal(onRoad(0, 5), true, 'departure remains straight');
    for (const p of network.turns[0]!.path.points) assert.ok(onRoad(p.x, p.z), 'every sample of the turn is on the curved asphalt');
  } finally { scene.dispose(); engine.dispose(); }
});

test('all junction turns are curved before a route is drawn', () => {
  const world = bend(); world.nodes.push(point('d', 8, 0), point('e', 0, -8));
  world.streets.push({ id: 'bd', a: 'b', b: 'd', kind: 'clear', width: 2.6, crossingSeconds: 20 }, { id: 'be', a: 'b', b: 'e', kind: 'clear', width: 2.6, crossingSeconds: 20 });
  const network = cityRoadNetwork(world, 3);
  assert.equal(network.turns.length, 4);
  for (const { path } of network.turns) {
    assert.ok(path.points.length >= 60);
    for (let i = 2; i < path.points.length; i++) {
      const a = path.points[i - 1]!.subtract(path.points[i - 2]!).normalize(), b = path.points[i]!.subtract(path.points[i - 1]!).normalize();
      assert.ok(Vector3.Dot(a, b) > .999, 'sampled turn has no abrupt heading change');
    }
  }
});

test('large radius layouts give all ground turns room and never replace them with right angles', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  for (const radius of [1, 3, 6, 8, 12]) {
    const world = generateCity(42, [bot]); world.minimumTurnRadius = radius;
    const journey = new PlannedJourney(bot, world); journey.enableLineFollowing();
    const network = cityRoadNetwork(world, radius);
    let expected = 0;
    for (const n of world.nodes) {
      const neighbours = world.streets.filter(s => s.kind !== 'bridge' && (s.a === n.id || s.b === n.id)).map(s => world.nodes.find(p => p.id === (s.a === n.id ? s.b : s.a))!);
      for (let a = 0; a < neighbours.length; a++) for (let b = a + 1; b < neighbours.length; b++) {
        const u = new Vector3(neighbours[a]!.x - n.x, 0, neighbours[a]!.z - n.z).normalize(), v = new Vector3(neighbours[b]!.x - n.x, 0, neighbours[b]!.z - n.z).normalize();
        if (Math.abs(Vector3.Dot(u, v)) < .99999) expected++;
      }
    }
    assert.equal(network.turns.length, expected, `radius ${radius}: every corner has a curve`);
    journey.setRoute(routeToGoal(world)!);
    const path = journey.trajectory;
    for (const { path: turn, streets } of network.turns) {
      for (const building of world.buildings) for (const p of turn.points) {
        const half = Math.max(...streets.map(s => s.width)) / 2;
        assert.ok(Math.abs(p.x - building.x) > building.w / 2 + half || Math.abs(p.z - building.z) > building.d / 2 + half, 'buildings leave room for the complete road bend');
      }
    }
    assert.ok(path.length > 0);
  }
});

test('a full city and its route produce a bounded road mesh for rendering and physics', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  for (const radius of [1, 3, 12]) {
    const world = generateCity(42, [bot]); world.minimumTurnRadius = radius;
    const journey = new PlannedJourney(bot, world); journey.enableLineFollowing();
    journey.setRoute(routeToGoal(world)!);
    const network = cityRoadNetwork(world, radius);
    const corridors = routeRoadPolygons(journey.trajectory, journey.route.slice(1).map((id, i) => {
      const street = world.streets.find(s => (s.a === id && s.b === journey.route[i]) || (s.b === id && s.a === journey.route[i]))!;
      return { id: street.id, width: street.width, transport: street.kind === 'bridge' };
    }));
    assert.ok(network.polygons.length > 2000, 'exercise the complete network of sampled curves');
    const roads = roadPolygonUnion([...network.polygons, ...corridors]);
    const triangles = [...roads.values()].reduce((sum, data) => sum + data.indices.length / 3, 0);
    assert.ok(triangles < 20000, `radius ${radius}: ${triangles} triangles; unrelated curve cuts must not multiply the city mesh`);
    assert.ok(triangles > 0);
  }
});
