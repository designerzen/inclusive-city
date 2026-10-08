import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import HavokPhysics from '@babylonjs/havok';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import type { ProceduralCity } from '../src/city/proceduralCity';
import { createHumpbackBridge } from '../src/city/createHumpbackBridge';
import { createCityPhysics } from '../src/city/cityPhysics';
import { isHumpbackBridge, bridgeRampRise } from '../src/city/humpbackBridge';
import { cityIssueAction } from '../src/ui/cityIssueAction';
import { cityRobotAlert } from '../src/ui/cityRobotAlert';
import { interpretCityReply, applyCityReply } from '../src/ui/cityReply';

function fixture(kind: 'stairs' | 'bridge' = 'stairs', reverse = false) {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  const world: ProceduralCity = { seed: 1, start: reverse ? 'b' : 'a', destination: reverse ? 'a' : 'b', riverX: 30, rememberedRobots: 1, buildings: [],
    nodes: [{ id: 'a', label: 'A', x: 0, y: .16, z: 0 }, { id: 'b', label: 'B', x: 0, y: .16, z: 10 }],
    streets: [{ id: 'hump', a: 'a', b: 'b', kind, width: 2.6, crossingSeconds: 20 }] };
  return new PlannedJourney(bot, world);
}

test('stepped humpback bridges require access; ramp/elevator selection, undo and restart preserve each mode', () => {
  for (const kind of ['stairs', 'bridge'] as const) {
    const j = fixture(kind), street = j.world.streets[0]!;
    assert.match(j.problem(street)!, /humpback.*ramp or elevators/);
    j.start(); j.update(5); assert.equal(j.blocked?.id, street.id);
    assert.equal(j.setBridgeAccess(street.id, 'ramp'), true);
    assert.equal(j.problem(street), null);
    assert.equal(j.setBridgeAccess(street.id, 'elevator'), true);
    assert.equal(j.machine.run.cityPlan!.world.streets[0]!.bridgeAccess, 'elevator');
    assert.equal(j.undoRepair(), true); assert.equal(j.bridgeAccess(street), 'ramp');
    assert.equal(j.undoRepair(), true); assert.equal(j.bridgeAccess(street), 'steps');
    j.update(1); assert.equal(j.blocked?.id, street.id);
    j.setBridgeAccess(street.id, 'elevator');
    const saved = structuredClone(j.machine.run.cityPlan);
    j.restart(); assert.equal(j.bridgeAccess(street), 'elevator');
    assert.deepEqual(j.machine.run.cityPlan, saved);
    j.world.steamTrain = { street: street.id };
    assert.equal(isHumpbackBridge(street, j.world), false);
    assert.equal(j.setBridgeAccess(street.id, 'ramp'), false);
  }
});

test('elevators lift at both ends in either direction; pause and occupied-edit protection also apply to vertical travel', () => {
  for (const reverse of [false, true]) {
    const j = fixture('bridge', reverse), street = j.world.streets[0]!;
    j.enableLineFollowing(); j.setBridgeAccess(street.id, 'elevator'); j.start();
    const origin = j.position;
    j.update(1); assert.equal(j.position.x, origin.x); assert.equal(j.position.z, origin.z);
    assert.ok(j.position.y > .5); assert.equal(j.metrics.distance, 0);
    assert.equal(j.setBridgeAccess(street.id, 'ramp'), false); assert.equal(j.undoAvailable, false);
    j.setPaused(true); const p = j.position; j.update(10); assert.deepEqual(j.position, p);
    j.setPaused(false); j.update(1 + 5 / j.speed);
    assert.ok(Math.abs(j.position.z - 5) < 1e-8); assert.ok(j.position.y > 1);
    j.update(100); assert.equal(j.complete, true); assert.equal(j.position.y, .16);
    assert.ok(Math.abs(j.metrics.waitingSeconds - 4) < 1e-8); assert.equal(j.metrics.distance, 10);
    assert.equal(j.metrics.stepsTaken, 10);
    j.restart(); assert.equal(j.bridgeSeconds, 0);
  }
});

test('spoken elevator requests select elevators on a blocked humpback bridge', () => {
  const j = fixture(); j.start(); j.update(1);
  const reply = interpretCityReply('add an elevator', j);
  assert.deepEqual(reply.action, { kind: 'bridge-access', id: 'hump', access: 'elevator' });
  applyCityReply(j, reply); assert.equal(j.bridgeAccess(j.world.streets[0]!), 'elevator');
});

const wasm = readFile(createRequire(import.meta.url).resolve('@babylonjs/havok/lib/esm/HavokPhysics.wasm')).then(wasmBinary => HavokPhysics({ wasmBinary }));
test('ramps carry wheels up and down the hump with Havok, while keeping steps visible beside the route', async () => {
  for (const length of [10, 4, 2]) {
    for (const reverse of [false, true]) {
      const j = fixture('stairs', reverse), engine = new NullEngine(), scene = new Scene(engine);
      j.world.nodes[1]!.z = length;
      const material = new StandardMaterial('deck', scene);
      const bridge = createHumpbackBridge(scene, 'hump', j.world.nodes[0]!, j.world.nodes[1]!, material, material);
      const ground = MeshBuilder.CreateBox('ground', { width: 30, depth: 30, height: .1 }, scene); ground.position.y = .025;
      j.setBridgeAccess('hump', 'ramp'); bridge.sync('ramp', 2.6);
      const physics = createCityPhysics(scene, j, [ground, ...bridge.solids], await wasm);
      try {
        j.start(); let peak = 0;
        for (let i = 0; i < 1200 && !j.complete && !j.blocked; i++) {
          physics.update(1 / 60); j.update(1 / 60); scene.getPhysicsEngine()!._step(1 / 60);
          peak = Math.max(peak, physics.position.y);
        }
        assert.equal(j.blocked, null, `length ${length}, reverse ${reverse}`);
        assert.equal(j.complete, true); assert.ok(peak > bridgeRampRise(length) - .1);
        assert.ok(scene.getMeshByName('humpback-step-0-0-hump')!.isEnabled());
        assert.equal(scene.getMeshByName('humpback-step-0-0-hump')!.metadata.decorative, true);
      } finally { scene.dispose(); engine.dispose(); }
    }
  }
});

test('a stalled repaired ramp offers elevators and continues from the same point without duplicate distance', () => {
  for (const reverse of [false, true]) {
    const j = fixture('stairs', reverse);
    j.enableLineFollowing(); j.setBridgeAccess('hump', 'ramp'); j.start(); j.update(1);
    const before = j.position, distance = j.metrics.distance;
    assert.ok(j.distanceOnEdge > 0);
    j.constrainTravel = () => ({ distance: 0, blocker: { id: 'hump', reason: 'A solid object blocks this street.' } });
    j.update(1);
    assert.equal(j.canEdit('hump'), false, 'ordinary occupied edits stay protected');
    assert.equal(j.bridgeRampBlocked, true);
    assert.equal(cityIssueAction(j), 'Add elevators');
    assert.match(cityRobotAlert(j)!, /bridge ramp.*elevators/);
    assert.equal(j.setBridgeAccess('hump', 'steps'), false);
    j.setPaused(true);
    assert.equal(j.repair('hump'), true);
    assert.equal(j.blocked, null); assert.equal(j.paused, true);
    assert.ok(Math.abs(j.position.x - before.x) < 1e-8 && Math.abs(j.position.z - before.z) < 1e-8);
    assert.equal(j.metrics.distance, distance);
    assert.equal(j.bridgeAccess(j.currentStreet!), 'elevator');
    j.setPaused(false); j.update(100);
    assert.equal(j.complete, true);
    assert.ok(Math.abs(j.metrics.distance - j.routeLength) < 1e-8);
    assert.ok(j.machine.record.failures.every(f => f.resolvedAt !== null));
  }
});
