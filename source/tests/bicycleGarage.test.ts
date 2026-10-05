import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { generateCity } from '../src/city/proceduralCity';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { createBicycleGarage } from '../src/city/bicycleGarage';
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

test('generated cities have a garage and bicycles on roads and pavements, blocking non-crossing workshop exits', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  for (let seed = 0; seed < 30; seed++) {
    const world = generateCity(seed, [bot]);
    assert.ok(world.bicycleGarage); assert.ok(world.bicycles!.some(b => b.location === 'pavement'));
    assert.ok(world.bicycles!.some(b => b.location === 'road'));
    for (const street of world.streets.filter(s => s.kind !== 'crossing' && (s.a === world.start || s.b === world.start))) {
      assert.ok(world.bicycles!.some(b => b.street === street.id));
    }
  }
});

test('bicycles never occupy pelican crossings, including workshop exits', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  let workshopCrossings = 0;
  for (let seed = 0; seed < 1000; seed++) {
    const world = generateCity(seed, [bot]);
    const crossings = world.streets.filter(street => street.kind === 'crossing');
    workshopCrossings += crossings.filter(street => street.a === world.start || street.b === world.start).length;
    for (const bike of world.bicycles ?? []) {
      const street = world.streets.find(street => street.id === bike.street);
      assert.ok(street, `Seed ${seed}: ${bike.id} must belong to an existing street`);
      assert.notEqual(street.kind, 'crossing', `Seed ${seed}: ${bike.id} must not occupy a pelican crossing`);
    }
  }
  assert.ok(workshopCrossings > 0, 'Seeds must cover pelican crossings at workshop exits');
});


test('repeated pushes tip bikes aside and clear travel in both directions without storing them', () => {
  for (const reverse of [false, true]) {
    const j = setup(reverse);
    j.start(); j.update(100);
    const stopped = j.position;
    assert.equal(j.pushBicycle('missing'), false);
    assert.equal(j.pushBicycle('bicycle-1'), true);
    assert.equal(j.world.bicycles![0]!.pushDistance, .65);
    assert.equal(j.bicycleBlocks('bicycle-1'), true);
    j.update(100); assert.deepEqual(j.position, stopped);
    for (let i = 0; i < 20 && j.bicycleBlocks('bicycle-1'); i++) j.pushBicycle('bicycle-1');
    assert.equal(j.bicycleBlocks('bicycle-1'), false);
    assert.equal(j.blocked, null);
    assert.equal(j.repaired.has('bicycle-1'), false);
    assert.equal(j.machine.run.cityPlan!.world.bicycles![0]!.pushDistance, j.world.bicycles![0]!.pushDistance);
    assert.ok(j.machine.record.failures[0]!.resolvedAt !== null);
    j.update(100); assert.equal(j.complete, true);
    assert.equal(j.pushBicycle('bicycle-1'), false);
  }
});

test('pushes undo separately, survive restart, preserve pause and still allow garage storage', () => {
  const j = setup();
  j.start(); j.update(100); j.setPaused(true);
  const original = structuredClone(j.machine.run.cityPlan);
  while (j.bicycleBlocks('bicycle-1')) j.pushBicycle('bicycle-1');
  assert.equal(j.paused, true); assert.equal(j.machine.state, 'paused');
  assert.equal(j.undoRepair(), true); assert.equal(j.bicycleBlocks('bicycle-1'), true);
  j.setPaused(false); j.update(100); assert.equal(j.blocked?.id, 'bicycle-1');
  j.pushBicycle('bicycle-1');
  const pushed = j.world.bicycles![0]!.pushDistance;
  j.repair('bicycle-1'); assert.equal(j.pushBicycle('bicycle-1'), false);
  j.undoRepair(); assert.equal(j.world.bicycles![0]!.pushDistance, pushed);
  j.restart(); assert.equal(j.bicycleBlocks('bicycle-1'), false);
  assert.equal(original!.world.bicycles![0]!.pushDistance, undefined);
  while (j.undoAvailable) j.undoRepair();
  assert.equal(j.world.bicycles![0]!.pushDistance, 0);
  assert.equal(j.bicycleBlocks('bicycle-1'), true);
});


test('bike meshes fall, move perpendicular to the route, and stand upright when stored or undone', () => {
  const j = setup(), engine = new NullEngine(), scene = new Scene(engine);
  try {
    const material = new StandardMaterial('bike', scene);
    const sync = createBicycleGarage(scene, j, material, material, material);
    sync();
    const root = scene.getTransformNodeById('bicycle-1')!;
    const initial = root.position.clone();
    j.pushBicycle('bicycle-1'); sync();
    assert.equal(root.rotation.x, Math.PI / 2);
    assert.ok(Math.abs(root.position.x - initial.x) < 1e-8);
    assert.ok(Math.abs(root.position.z - initial.z + .65) < 1e-8);
    j.pushBicycle('bicycle-1'); sync();
    assert.ok(Math.abs(root.position.z - initial.z + 1.3) < 1e-8);
    j.repair('bicycle-1'); sync();
    assert.equal(root.rotation.x, 0);
    assert.equal(root.position.x, j.world.bicycleGarage!.x - 1.3);
    j.undoRepair(); sync(); assert.equal(root.rotation.x, Math.PI / 2);
    j.undoRepair(); j.undoRepair(); sync();
    assert.equal(root.rotation.x, 0); assert.deepEqual(root.position, initial);
  } finally { scene.dispose(); engine.dispose(); }
});
