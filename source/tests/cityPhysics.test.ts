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
import { createAutonomousBots } from '../src/city/autonomousBots';
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

test('robot sweeps stop the player and autonomous robots at each other, including large moves', async () => {
  const { engine, scene, journey, floor } = fixture();
  const physics = createCityPhysics(scene, journey, [floor], await wasm);
  const first = physics.addRobot('first', new Vector3(3, 1, 0), .5, 1.8);
  const second = physics.addRobot('second', new Vector3(6, 1, 0), .5, 1.8);
  try {
    journey.start();
    const result = journey.constrainTravel!({ x: 0, y: .16, z: 0 }, { x: 8, y: .16, z: 0 }, 1);
    assert.ok(result.distance < 2, 'player cannot tunnel through a bot');
    assert.ok(result.distance > .5);
    const before = first.controller.getPosition().clone();
    assert.equal(physics.moveRobot(first, new Vector3(-8, 0, 0), 1).contact, 'player');
    assert.ok(Vector3.Distance(before, first.controller.getPosition()) < .001, 'bot cannot enter the player');
    assert.equal(physics.moveRobot(second, new Vector3(-8, 0, 0), 1).contact, 'first');
    assert.ok(second.controller.getPosition().x >= first.controller.getPosition().x + 1);
    physics.moveRobot(first, new Vector3(0, 0, 3), 1);
    assert.ok(first.controller.getPosition().z > 2.9, 'bots can move away from contact');
  } finally { scene.dispose(); engine.dispose(); }
});

test('autonomous bots wander, reverse at solid walls, and follow collider edits without teleporting', async () => {
  const { engine, scene, journey, floor } = fixture();
  journey.world.nodes.push({ id: 'c', label: 'Junction', x: -6, y: .16, z: 0 }, { id: 'd', label: 'Junction', x: -12, y: .16, z: 0 });
  journey.world.streets.push({ id: 'other', a: 'c', b: 'd', kind: 'clear', width: 3, crossingSeconds: 20 });
  const wall = MeshBuilder.CreateBox('wall', { width: .2, height: 4, depth: 8 }, scene); wall.position.set(-9, 2, 0);
  const physics = createCityPhysics(scene, journey, [floor, wall], await wasm);
  const autonomous = createAutonomousBots(scene, journey.world, physics);
  try {
    assert.equal(autonomous.bots.length, 2);
    for (let i = 0; i < 1800; i++) {
      const before = autonomous.bots.map(bot => bot.character.controller.getPosition().clone());
      autonomous.update(1 / 60, true);
      autonomous.bots.forEach((bot, index) => assert.ok(Vector3.Distance(before[index]!, bot.character.controller.getPosition()) < .04));
      assert.ok(autonomous.bots[0]!.character.controller.getPosition().x > -8.5);
      assert.ok(autonomous.bots[1]!.character.controller.getPosition().x < -9.5);
    }
    assert.ok(autonomous.bots.every(bot => bot.turns > 0 && bot.distance > 2));
    assert.ok(autonomous.bots.every(bot => Math.abs(bot.model.robot.position.y - .045) < .04));
    const distance = autonomous.bots.reduce((sum, bot) => sum + bot.distance, 0);
    wall.setEnabled(false); physics.sync();
    for (let i = 0; i < 1800; i++) autonomous.update(1 / 60);
    assert.ok(autonomous.bots.reduce((sum, bot) => sum + bot.distance, 0) > distance + 10);
  } finally { scene.dispose(); engine.dispose(); }
});

test('the player waits for another robot and resumes when it moves away', async () => {
  const { engine, scene, journey, floor } = fixture();
  const physics = createCityPhysics(scene, journey, [floor], await wasm);
  const other = physics.addRobot('crossing', new Vector3(3, 1, 0), .55, 1.8);
  try {
    journey.start();
    for (let i = 0; i < 600; i++) { physics.update(1 / 60); journey.update(1 / 60); }
    assert.equal(journey.blocked?.id, 'robot:crossing');
    assert.equal(journey.metrics.failures, 1);
    physics.moveRobot(other, new Vector3(0, 0, 3), 1);
    scene.getPhysicsEngine()!._step(1 / 60);
    for (let i = 0; i < 900 && !journey.complete; i++) { physics.update(1 / 60); journey.update(1 / 60); }
    assert.equal(journey.complete, true);
    assert.ok(journey.machine.record.failures[0]!.resolvedAt !== null);
  } finally { scene.dispose(); engine.dispose(); }
});

test('a head-on bot retreats midway through a red crossing and lets the player finish', async () => {
  const { engine, scene, journey, floor } = fixture();
  journey.world.nodes.push({ id: 'c', label: 'West', x: 0, y: .16, z: 0 }, { id: 'd', label: 'East', x: 8, y: .16, z: 0 });
  journey.world.streets.push({ id: 'crossing', a: 'c', b: 'd', kind: 'crossing', width: 3, crossingSeconds: 1 });
  const physics = createCityPhysics(scene, journey, [floor], await wasm);
  const autonomous = createAutonomousBots(scene, journey.world, physics);
  const bot = autonomous.bots[0]!;
  Object.assign(bot, { node: journey.world.nodes[3]!, target: journey.world.nodes[2]!, wait: 0, heading: Math.PI / 2, crossingEntered: true });
  bot.character.controller.setPosition(new Vector3(4, .075 + bot.character.height / 2, 0));
  const other = autonomous.bots[1]!;
  other.character.controller.setPosition(new Vector3(12, .075 + other.character.height / 2, 10));
  other.wait = 1000;
  scene.getPhysicsEngine()!._step(1 / 60);
  try {
    journey.start();
    let reversedMidStreet = false;
    for (let i = 0; i < 1800 && !journey.complete; i++) {
      physics.update(1 / 60); autonomous.update(1 / 60, false, 0); journey.update(1 / 60);
      scene.getPhysicsEngine()!._step(1 / 60);
      if (bot.returning && bot.character.controller.getPosition().x > .2 && bot.character.controller.getPosition().x < 7.8) reversedMidStreet = true;
    }
    assert.ok(reversedMidStreet, 'reverse happens before reaching a junction');
    assert.equal(journey.complete, true, JSON.stringify({ player: journey.position, bot: bot.model.robot.position.asArray(), blocked: journey.blocked, returning: bot.returning }));
    const collisions = journey.machine.record.events.filter(e => e.type === 'collision');
    assert.ok(collisions.some(e => e.data.actor === 'player' || e.data.other === 'player'));
    assert.ok(collisions.every(e => Number(e.data.speed) > 0 && Number.isFinite(e.position.x)));
  } finally { scene.dispose(); engine.dispose(); }
});

test('each new collision is recorded once, repeated contact is silent, and separating rearms it', async () => {
  const { engine, scene, journey, floor } = fixture();
  const wall = MeshBuilder.CreateBox('impact-wall', { width: .2, height: 4, depth: 8 }, scene); wall.position.set(3, 2, 0);
  const physics = createCityPhysics(scene, journey, [floor, wall], await wasm);
  const bot = physics.addRobot('impact-bot', new Vector3(-3, 1, 0), .55, 1.8);
  const impacts = () => journey.machine.record.events.filter(e => e.type === 'collision');
  try {
    physics.moveRobot(bot, new Vector3(8, 0, 0), 1);
    for (let i = 0; i < 30; i++) physics.moveRobot(bot, new Vector3(1, 0, 0), 1 / 60);
    assert.equal(impacts().length, 1);
    assert.equal(impacts()[0]!.data.kind, 'robot');
    physics.moveRobot(bot, new Vector3(-2, 0, 0), 1);
    physics.moveRobot(bot, new Vector3(8, 0, 0), 1);
    assert.equal(impacts().length, 2);
    journey.start();
    physics.moveRobot(physics.player, new Vector3(8, 0, 0), 1);
    assert.ok(impacts().some(e => e.data.kind === 'world' && e.data.other === 'solid:impact-wall'));
  } finally { scene.dispose(); engine.dispose(); }
});

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
    for (const bicycle of world.bicycles ?? []) journey.repair(bicycle.id);
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
    for (const bike of world.bicycles ?? []) journey.repair(bike.id);
    journey.repair('studio-entrance'); journey.repair('studio-entrance');
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
