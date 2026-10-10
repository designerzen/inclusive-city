import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity } from '../src/city/proceduralCity';
import { createZebraCrossing, foregroundCrossingPosition, zebraBeaconOn, zebraRoadSites } from '../src/city/zebraCrossing';
import { cityRoadNetwork } from '../src/city/cityRoadNetwork';

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

test('every generated city has space for the foreground crossing ahead of all streets and buildings', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  for (let seed = 0; seed < 100; seed++) {
    const world = generateCity(seed, [bot]), front = foregroundCrossingPosition(world);
    assert.ok(world.nodes.every(node => node.z > front.z + 1.5));
    assert.ok(world.buildings.every(b => b.z - b.d / 2 > front.z + 1.5));
    assert.ok(Math.abs(front.x - world.riverX) > 4.5);
  }
});

test('zebra stripes and paired Belisha globes follow road width and share the same flash', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const zebra = createZebraCrossing(scene, 'test', new StandardMaterial('white', scene), new StandardMaterial('black', scene));
    zebra.place(2, -5, 4);
    const stripes = scene.meshes.filter(m => m.name.startsWith('zebra-stripe'));
    assert.equal(stripes.length, 7);
    for (const stripe of stripes) {
      stripe.computeWorldMatrix(true);
      const bounds = stripe.getBoundingInfo().boundingBox;
      assert.ok(bounds.extendSizeWorld.x > bounds.extendSizeWorld.z, 'stripes run along traffic, spaced across the road');
      assert.ok(Math.abs(stripe.position.z) + stripe.scaling.z / 2 <= 2, 'paint stays between road edges');
    }
    const globes = scene.meshes.filter(m => m.name.startsWith('belisha-globe'));
    assert.equal(globes.length, 2);
    assert.equal(globes[0]!.material, globes[1]!.material);
    assert.deepEqual(globes.map(m => m.parent!.position.z), [-2.45, 2.45]);
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

test('zebra crossings occupy straight ordinary roads and never another crossing or a bend', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  for (let seed = 0; seed < 100; seed++) {
    const world = generateCity(seed, [bot]), network = cityRoadNetwork(world, 3);
    for (const site of zebraRoadSites(world, network)) {
      assert.ok(site.street.kind === 'clear' || site.street.kind === 'width');
      assert.notEqual(site.street.id, world.steamTrain?.street);
      const span = network.spans.get(site.street.id)!;
      assert.ok(Math.hypot(span.b.x - span.a.x, span.b.z - span.a.z) >= 4);
    }
  }
});
