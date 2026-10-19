import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity, routeToGoal } from '../src/city/proceduralCity';
import { createZebraCrossing, zebraBeaconOn, zebraRoadSites, signalCrossingSite } from '../src/city/zebraCrossing';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { RouteTrajectory } from '../src/city/routeTrajectory';
import type { ProceduralCity } from '../src/city/proceduralCity';
import { cityRoadNetwork } from '../src/city/cityRoadNetwork';

const point = (id: string, x: number, z: number) => ({ id, label: id, x, y: .16, z });
function junction(): ProceduralCity {
  return { seed: 1, start: 'w', destination: 'e', buildings: [], riverX: 40, rememberedRobots: 1,
    nodes: [point('w', -10, 0), point('j', 0, 0), point('e', 10, 0), point('n', 0, 10), point('s', 0, -10)],
    streets: ['w', 'e', 'n', 's'].map(id => ({ id, a: 'j', b: id, kind: 'clear', width: id === 'n' ? 4 : 2.6, crossingSeconds: 20 })) };
}

test('crossings span a junction along the robot route, without overlapping paint', () => {
  const world = junction(), network = cityRoadNetwork(world, 3);
  for (const [from, to, horizontal, width] of [['w', 'e', false, 4], ['n', 's', true, 2.6]] as const) {
    const trajectory = new RouteTrajectory([from, 'j', to].map(id => world.nodes.find(n => n.id === id)!));
    const sites = zebraRoadSites(world, network, 12, trajectory);
    assert.equal(sites.length, 1);
    assert.deepEqual([sites[0]!.x, sites[0]!.z], [0, 0]);
    assert.equal(sites[0]!.horizontal, horizontal);
    assert.equal(sites[0]!.width, width);
    assert.equal(sites[0]!.onRoute, true);
    assert.equal(sites[0]!.bandWidth, 2.6);
  }
  assert.equal(zebraRoadSites(world, network, 1).length, 1);
  assert.deepEqual(zebraRoadSites(world, network, 0), []);
  world.streets[0]!.kind = 'crossing';
  assert.deepEqual(zebraRoadSites(world, network), [], 'signalised junctions retain their own markings');
});

test('dead ends and simple bends never receive zebra crossings', () => {
  const world = junction();
  world.streets = world.streets.filter(s => s.id === 'w' || s.id === 'n');
  assert.deepEqual(zebraRoadSites(world, cityRoadNetwork(world, 3), 12), []);
  world.streets = world.streets.filter(s => s.id === 'w');
  assert.deepEqual(zebraRoadSites(world, cityRoadNetwork(world, 3), 12), []);
});

test('signalised markings cross only the junction width, and turning routes use its straight approach', () => {
  const world = junction(), street = world.streets[0]!;
  const straight = signalCrossingSite(world, street, 3, ['w', 'j', 'e'])!;
  assert.deepEqual([straight.x, straight.z, straight.length], [0, 0, 4]);
  const turn = signalCrossingSite(world, street, 3, ['w', 'j', 'n'])!;
  assert.deepEqual([turn.x, turn.z, turn.length], [-5, 0, 4]);
  assert.ok(turn.x + turn.length / 2 <= -3, 'paint ends before the rounded turn begins');
  world.streets = [street];
  assert.equal(signalCrossingSite(world, street, 3, ['w', 'j']), null, 'no stripes without a side road');
});

test('generated crossings stay at connected junctions and prioritise the actual journey', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  let routeCrossings = 0;
  for (let seed = 0; seed < 100; seed++) {
    const world = generateCity(seed, [bot]);
    const journey = new PlannedJourney(bot, world); journey.enableLineFollowing();
    const route = routeToGoal(world); if (!route) continue; journey.setRoute(route);
    const sites = zebraRoadSites(world, cityRoadNetwork(world, journey.minimumTurnRadius), 12, journey.trajectory);
    assert.ok(sites.length <= 12);
    assert.equal(new Set(sites.map(s => s.node)).size, sites.length);
    for (const site of sites) {
      const node = world.nodes.find(n => n.id === site.node)!;
      assert.deepEqual([site.x, site.z], [node.x, node.z]);
      assert.ok(world.streets.filter(s => s.a === node.id || s.b === node.id).length >= 3);
      assert.ok(site.width > 0 && site.bandWidth <= 3.2);
    }
    if (sites.some(s => s.onRoute)) { assert.equal(sites[0]!.onRoute, true); routeCrossings++; }
  }
  assert.ok(routeCrossings > 0, 'generated journeys use the junction crossings when the route goes straight across a side road');
});

test('beacons flash once on every musical beat at different tempos without frame accumulation', () => {
  for (const bpm of [60, 90, 120, 180]) {
    const beat = 60 / bpm;
    for (const n of [0, 1, 7, 10000]) {
      assert.equal(zebraBeaconOn(n * beat, bpm), true);
      assert.equal(zebraBeaconOn((n + .2) * beat, bpm), true);
      assert.equal(zebraBeaconOn((n + .6) * beat, bpm), false);
    }
  }
  assert.equal(zebraBeaconOn(-1, 120), false);
  assert.equal(zebraBeaconOn(NaN, 120), false);
});

test('zebra stripes and paired Belisha globes follow road width and share the same flash', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const zebra = createZebraCrossing(scene, 'test', new StandardMaterial('white', scene), new StandardMaterial('black', scene));
    zebra.place(2, -5, 4);
    const stripes = scene.meshes.filter(m => m.name.startsWith('zebra-stripe'));
    assert.equal(stripes.length, 6);
    for (const stripe of stripes) {
      stripe.computeWorldMatrix(true);
      const bounds = stripe.getBoundingInfo().boundingBox;
      assert.ok(bounds.extendSizeWorld.z > bounds.extendSizeWorld.x, 'stripes run along the pedestrian path across traffic');
      assert.ok(Math.abs(stripe.position.x) + 3.2 * stripe.scaling.x / 2 <= 1.6 && stripe.scaling.z === 4, 'paint stays between road edges');
    }
    const globes = scene.meshes.filter(m => m.name.startsWith('belisha-globe'));
    assert.equal(globes.length, 2);
    assert.equal(scene.meshes.filter(m => m.name.startsWith('belisha-cap')).length, 0);
    assert.equal(globes[0]!.material, globes[1]!.material);
    assert.deepEqual(globes.map(m => m.parent!.position.z), [-2.45, 2.45]);
    assert.ok(globes.every(m => m.parent!.position.x > 1.6), 'beacons stay beside the pedestrian path');
    zebra.update(0, 120);
    const material = globes[0]!.material as StandardMaterial;
    const bright = material.emissiveColor.r;
    zebra.update(.3, 120);
    assert.ok(material.emissiveColor.r < bright);
    zebra.place(2, -5, 6, false);
    assert.equal(zebra.root.rotation.y, Math.PI / 2);
    assert.deepEqual(globes.map(m => m.parent!.position.z), [-3.45, 3.45]);
  } finally { scene.dispose(); engine.dispose(); }
});
