import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import HavokPhysics from '@babylonjs/havok';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { createStudioBuilding } from '../src/city/studioBuilding';
import { createGoalFlag } from '../src/city/goalFlag';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { createCityPhysics } from '../src/city/cityPhysics';
import { createAutonomousBots } from '../src/city/autonomousBots';
import type { ProceduralCity } from '../src/city/proceduralCity';
import { generateCity, routeToGoal } from '../src/city/proceduralCity';
import { cityIssueAction } from '../src/ui/cityIssueAction';
import { cityRobotAlert } from '../src/ui/cityRobotAlert';

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

test('a barrier on an adjacent street offers its own repair and clears the travelled street', async () => {
  for (const kind of ['stairs', 'curb', 'bridge'] as const) {
    const { engine, scene, journey, floor } = fixture();
    journey.world.nodes.push({ id: 'c', label: 'North', x: 3, y: .16, z: 5 }, { id: 'd', label: 'South', x: 3, y: .16, z: -5 });
    journey.world.streets.push({ id: 'adjacent', a: 'c', b: 'd', kind, width: 2.6, crossingSeconds: 20 });
    const obstacle = MeshBuilder.CreateBox('adjacent-feature', { width: .28, height: .55, depth: 2.6 }, scene);
    obstacle.position.set(3, .34, 0); obstacle.metadata = { street: 'adjacent' };
    // A nearby building must not steal the identity of the closer street feature.
    const wall = MeshBuilder.CreateBox('nearby-wall', { width: .2, height: 4, depth: 2 }, scene);
    wall.position.set(3.8, 2, 2); wall.metadata = { building: 'Library', side: 'front' };
    const physics = createCityPhysics(scene, journey, [floor, obstacle, wall], await wasm);
    try {
      journey.start();
      for (let i = 0; i < 600 && !journey.blocked; i++) {
        physics.update(1 / 60); journey.update(1 / 60); scene.getPhysicsEngine()!._step(1 / 60);
      }
      assert.equal(journey.currentStreet!.id, 'street');
      assert.equal(journey.blocked?.id, 'adjacent');
      assert.equal(cityIssueAction(journey), kind === 'stairs' ? 'Add ramp' : kind === 'curb' ? 'Lower curb' : 'Lower bridge');
      assert.doesNotMatch(cityRobotAlert(journey)!, /object|wall/);
      assert.equal(journey.canEdit('adjacent'), true);
      assert.equal(journey.repair('adjacent'), true);
      obstacle.setEnabled(false); physics.sync();
      for (let i = 0; i < 900 && !journey.complete; i++) {
        physics.update(1 / 60); journey.update(1 / 60); scene.getPhysicsEngine()!._step(1 / 60);
      }
      assert.equal(journey.complete, true);
      assert.ok(journey.machine.record.failures[0]!.resolvedAt !== null);
    } finally { scene.dispose(); engine.dispose(); }
  }
});

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
  journey.world.nodes.push({ id: 'c', label: 'Junction', x: -6, y: .16, z: 0 }, { id: 'd', label: 'Junction', x: -12, y: .16, z: 0 },
    { id: 'e', label: 'Junction', x: -12, y: .16, z: -8 }, { id: 'f', label: 'Junction', x: -6, y: .16, z: -8 });
  for (const [a, b] of [['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'c']]) journey.world.streets.push({ id: `${a}-${b}`, a: a!, b: b!, kind: 'clear', width: 3, crossingSeconds: 20 });
  const wall = MeshBuilder.CreateBox('wall', { width: .2, height: 4, depth: 8 }, scene); wall.position.set(-9, 2, 0);
  const physics = createCityPhysics(scene, journey, [floor, wall], await wasm);
  const autonomous = createAutonomousBots(scene, journey.world, physics);
  try {
    assert.equal(autonomous.bots.length, 4);
    for (let i = 0; i < 1800; i++) {
      const before = autonomous.bots.map(bot => bot.character.controller.getPosition().clone());
      autonomous.update(1 / 60, true);
      autonomous.bots.forEach((bot, index) => assert.ok(Vector3.Distance(before[index]!, bot.character.controller.getPosition()) < .04));
      for (let index = 0; index < autonomous.bots.length; index++) {
        const after = autonomous.bots[index]!.character.controller.getPosition();
        if (Math.abs(after.z) < 4) assert.ok(before[index]!.x < -9 ? after.x < -9 : after.x > -9, 'solid wall prevents crossing through its footprint');
      }
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
  journey.world.nodes[1]!.x = 40;
  floor.scaling.x = 4;
  journey.world.nodes.push({ id: 'c', label: 'West', x: 0, y: .16, z: 0 }, { id: 'd', label: 'East', x: 8, y: .16, z: 0 });
  journey.world.streets.push({ id: 'crossing', a: 'c', b: 'd', kind: 'crossing', width: 3, crossingSeconds: 1 });
  journey.world.nodes.push({ id: 'e', label: 'North east', x: 8, y: .16, z: 8 }, { id: 'f', label: 'North west', x: 0, y: .16, z: 8 });
  for (const [a, b] of [['d', 'e'], ['e', 'f'], ['f', 'c']]) journey.world.streets.push({ id: `${a}-${b}`, a: a!, b: b!, kind: 'clear', width: 3, crossingSeconds: 20 });
  const physics = createCityPhysics(scene, journey, [floor], await wasm);
  const autonomous = createAutonomousBots(scene, journey.world, physics);
  const bot = autonomous.bots[0]!;
  Object.assign(bot, { node: journey.world.nodes[3]!, target: journey.world.nodes[2]!, wait: 0, heading: Math.PI / 2, crossingEntered: true });
  bot.character.controller.setPosition(new Vector3(4, .075 + bot.character.height / 2, 0));
  for (const [i, other] of autonomous.bots.slice(1).entries()) {
    other.character.controller.setPosition(new Vector3(12 + i * 3, .075 + other.character.height / 2, 10));
    other.wait = 1000;
  }
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
    const route = routeToGoal(world)!, goal = world.nodes.find(n => n.id === world.destination)!;
    const previous = world.nodes.find(n => n.id === route.at(-2))!;
    const dx = goal.x - previous.x, dz = goal.z - previous.z, length = Math.hypot(dx, dz);
    const entrance = new TransformNode('studio-entrance', scene);
    entrance.position.set(goal.x - dx / length * 2, .15, goal.z - dz / length * 2);
    entrance.rotation.y = Math.atan2(dx, dz);
    const material = new StandardMaterial('studio', scene);
    const studio = createStudioBuilding(scene, entrance, material, material, material);
    studio.sync(world.studioEntrance!.width, false); solids.push(...studio.parts);
    createGoalFlag(scene, goal, material, material, material);
    const physics = createCityPhysics(scene, journey, solids, await wasm);
    const autonomous = createAutonomousBots(scene, world, physics);
    try {
      journey.start();
      for (let i = 0; i < 15000 && !journey.complete; i++) {
        physics.update(1 / 60); autonomous.update(1 / 60, true, journey.signalTime); journey.update(1 / 60);
        scene.getPhysicsEngine()!._step(1 / 60);
        if (journey.needsTrainRamp && journey.blocked?.id === world.steamTrain?.street) journey.requestTrainRamp('roboramp');
        if (journey.blocked && !journey.blocked.id.startsWith('robot:')) break;
      }
      assert.equal(journey.blocked, null, `seed ${seed}: ${JSON.stringify({ blocked: journey.blocked, street: journey.currentStreet, logical: journey.position, physical: physics.position })}`);
      assert.equal(journey.complete, true, `seed ${seed} reaches the studio`);
      assert.ok(Math.hypot(physics.position.x - journey.position.x, physics.position.z - journey.position.z) < .02);
    } finally { scene.dispose(); engine.dispose(); }
  }
});

test('the decorative goal flag remains visible but cannot obstruct arrival from either side', async () => {
  for (const reverse of [false, true]) {
    const { engine, scene, journey, floor } = fixture();
    if (reverse) journey.world.nodes[0]!.x = 14;
    const goal = journey.world.nodes[1]!;
    const material = new StandardMaterial('flag', scene);
    createGoalFlag(scene, goal, material, material, material);
    const physics = createCityPhysics(scene, journey, [floor], await wasm);
    try {
      assert.equal(scene.getMeshByName('goal-flagpole')!.isVisible, true);
      assert.equal(physics.colliderCount, 1, 'finish decorations add no collision bodies');
      journey.start();
      for (let i = 0; i < 600 && !journey.complete; i++) {
        physics.update(1 / 60); journey.update(1 / 60);
        scene.getPhysicsEngine()!._step(1 / 60);
      }
      assert.equal(journey.blocked, null);
      assert.equal(journey.complete, true, `arrival from ${reverse ? 'east' : 'west'} finishes`);
      assert.ok(Math.abs(physics.position.x - goal.x) < .02);
    } finally { scene.dispose(); engine.dispose(); }
  }
});
