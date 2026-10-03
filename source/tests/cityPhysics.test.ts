import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import HavokPhysics from '@babylonjs/havok';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { createCityPhysics } from '../src/city/cityPhysics';
import type { ProceduralCity } from '../src/city/proceduralCity';
import { generateCity } from '../src/city/proceduralCity';

const wasm = readFile(createRequire(import.meta.url).resolve('@babylonjs/havok/lib/esm/HavokPhysics.wasm')).then(wasmBinary => HavokPhysics({ wasmBinary }));
function fixture() {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  const world: ProceduralCity = { seed: 1, start: 'a', destination: 'b', riverX: 30, rememberedRobots: 1, buildings: [],
    nodes: [{ id: 'a', label: 'Workshop', x: 0, y: .16, z: 0 }, { id: 'b', label: 'Studio', x: 8, y: .16, z: 0 }],
    streets: [{ id: 'street', a: 'a', b: 'b', kind: 'clear', width: 3, crossingSeconds: 20 }] };
  const engine = new NullEngine(), scene = new Scene(engine), journey = new PlannedJourney(bot, world);
  const floor = MeshBuilder.CreateBox('floor', { width: 30, height: .1, depth: 30 }, scene); floor.position.y = .025;
  return { engine, scene, journey, floor };
}

test('Havok gravity grounds the robot, and swept travel stops at walls without false steps or repeated failures', async () => {
  const { engine, scene, journey, floor } = fixture();
  const wall = MeshBuilder.CreateBox('wall', { width: .2, height: 4, depth: 8 }, scene); wall.position.set(3, 2, 0);
  const physics = createCityPhysics(scene, journey, [floor, wall], await wasm);
  try {
    physics.controller.setPosition(new Vector3(0, 5, 0));
    for (let i = 0; i < 240; i++) physics.update(1 / 60);
    assert.ok(Math.abs(physics.position.y - .045) < .025, `grounded at ${physics.position.y}`);
    journey.start();
    for (let i = 0; i < 600; i++) { physics.update(1 / 60); journey.update(1 / 60); }
    assert.equal(journey.complete, false); assert.ok(journey.blocked);
    assert.ok(journey.position.x < 2.9); assert.ok(journey.position.x > 1);
    assert.equal(journey.metrics.failures, 1);
    assert.equal(journey.metrics.stepsTaken, Math.floor(journey.metrics.distance + 1e-8));
    assert.ok(Math.abs(physics.position.x - journey.position.x) < .005);
    const paused = physics.position.clone(); journey.setPaused(true);
    for (let i = 0; i < 60; i++) { physics.update(1 / 60); journey.update(1 / 60); }
    assert.ok(Vector3.Distance(paused, physics.position) < .001);
    wall.setEnabled(false); physics.sync(); assert.equal(physics.colliderCount, 1);
    journey.setPaused(false);
    for (let i = 0; i < 900 && !journey.complete; i++) { physics.update(1 / 60); journey.update(1 / 60); }
    assert.equal(journey.complete, true); assert.ok(Math.abs(physics.position.x - 8) < .01);
    assert.ok(journey.machine.record.failures[0]!.resolvedAt !== null);
    journey.restart(); physics.update(1 / 60);
    assert.ok(Math.abs(physics.position.x) < .001); assert.equal(journey.metrics.distance, 0);
  } finally { scene.dispose(); engine.dispose(); }
  assert.equal(journey.constrainTravel, undefined);
});

test('resizing, moving, undoing and disabling colliders updates Havok immediately', async () => {
  const { engine, scene, journey, floor } = fixture();
  const wall = MeshBuilder.CreateBox('wall', { width: .2, height: 4, depth: 2 }, scene); wall.position.set(3, 2, 3);
  const physics = createCityPhysics(scene, journey, [floor, wall], await wasm);
  try {
    for (let i = 0; i < 30; i++) physics.update(1 / 60);
    journey.start();
    const travel = () => journey.constrainTravel!({ x: 0, y: .16, z: 0 }, { x: 6, y: .16, z: 0 }, 1);
    assert.ok(travel().distance > 5.99);
    physics.reset(); wall.scaling.z = 6; physics.sync();
    assert.ok(travel().distance < 3);
    physics.reset(); wall.scaling.z = 1; physics.sync();
    assert.ok(travel().distance > 5.99);
    physics.reset(); wall.position.z = 0; physics.sync();
    assert.ok(travel().distance < 3);
    physics.reset(); wall.setEnabled(false); physics.sync();
    assert.ok(travel().distance > 5.99);
    physics.reset(); wall.setEnabled(true); physics.sync();
    assert.ok(travel().distance < 3); assert.equal(physics.colliderCount, 2);
  } finally { scene.dispose(); engine.dispose(); }
});

test('repaired generated routes cross street joins, corners and lowered bridge decks without false obstructions', async () => {
  for (const seed of [8, 42, 109]) {
    const bot = new BotHistory(['Curie', 'Einstein']).current;
    const world = generateCity(seed, [bot]), journey = new PlannedJourney(bot, world);
    const engine = new NullEngine(), scene = new Scene(engine);
    const floor = MeshBuilder.CreateBox('floor', { width: 56, height: .15, depth: 44 }, scene); floor.position.y = -.12;
    const solids = [floor];
    for (const street of world.streets) {
      if (street.kind !== 'clear') journey.repair(street.id);
      const a = world.nodes.find(n => n.id === street.a)!, b = world.nodes.find(n => n.id === street.b)!;
      const dx = Math.abs(b.x - a.x), dz = Math.abs(b.z - a.z);
      const surface = MeshBuilder.CreateBox(street.id, { width: dx || street.width, height: .1, depth: dz || street.width }, scene);
      surface.position.set((a.x + b.x) / 2, .025, (a.z + b.z) / 2); solids.push(surface);
      if (street.kind === 'bridge') {
        const deck = MeshBuilder.CreateBox('deck', { width: dx, height: .16, depth: street.width }, scene);
        deck.position.set(surface.position.x, .06, surface.position.z); solids.push(deck);
      }
    }
    for (const building of world.buildings) {
      const mesh = MeshBuilder.CreateBox(building.name, { width: building.w, height: building.h, depth: building.d }, scene);
      mesh.position.set(building.x, building.h / 2, building.z); solids.push(mesh);
    }
    const physics = createCityPhysics(scene, journey, solids, await wasm);
    try {
      journey.start();
      for (let i = 0; i < 15000 && !journey.complete && !journey.blocked; i++) { physics.update(1 / 60); journey.update(1 / 60); }
      assert.equal(journey.blocked, null, `seed ${seed}: ${JSON.stringify({ blocked: journey.blocked, street: journey.currentStreet, logical: journey.position, physical: physics.position })}`);
      assert.equal(journey.complete, true, `seed ${seed} reaches the studio`);
      assert.ok(Math.hypot(physics.position.x - journey.position.x, physics.position.z - journey.position.z) < .02);
    } finally { scene.dispose(); engine.dispose(); }
  }
});
