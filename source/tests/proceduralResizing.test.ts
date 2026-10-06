import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity } from '../src/city/proceduralCity';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { createProceduralResizer } from '../src/city/proceduralResizer';

function journey() { const bot = new BotHistory(['Curie', 'Einstein']).current; return new PlannedJourney(bot, generateCity(24, [bot])); }

test('generated building walls and doorways resize, undo together with street repairs, and survive restarting', () => {
  const j = journey(), b = j.world.buildings[0]!, originalWidth = b.w;
  const wall = `wall:${b.name}:left`, before = j.dimensions.get(wall)!;
  assert.equal(j.editDimension(wall, before - 1), true);
  assert.ok(Math.abs(b.w - originalWidth - 1) < 1e-8);
  assert.equal(j.editDimension(`door:${b.name}`, 1.8), true);
  const bridge = j.world.streets.find(s => s.kind === 'bridge' && s.id !== j.world.steamTrain?.street)!;
  assert.equal(j.repair(bridge.id), true);
  assert.equal(j.undoRepair(), true); assert.equal(j.repaired.has(bridge.id), false);
  assert.equal(j.undoRepair(), true); assert.equal(j.dimensions.get(`door:${b.name}`), .65);
  assert.equal(j.editDimension(`door:${b.name}`, 1.5), true);
  const run = structuredClone(j.machine.run);
  j.restart();
  assert.equal(j.dimensions.get(`door:${b.name}`), 1.5);
  j.editDimension(`door:${b.name}`, 2);
  assert.equal(run.citySnapshot![`door:${b.name}`], 1.5);
  assert.equal(run.cityPlan!.world.buildings[0]!.w, originalWidth + 1);
  const snapshot = j.dimensions.snapshot();
  for (const [id, value] of [[wall, NaN], [wall, before - 100], [`door:${b.name}`, .1], ['missing', 2]] as const) assert.equal(j.editDimension(id, value), false);
  assert.deepEqual(j.dimensions.snapshot(), snapshot);
});

test('passage clearance uses its actual size, including after a repair is narrowed or undone', () => {
  const j = journey(), street = j.world.streets.find(s => s.kind === 'width')!;
  const id = `width:${street.id}`, initial = street.width;
  assert.ok(j.problem(street)); assert.equal(j.repair(street.id), true); assert.equal(j.problem(street), null);
  assert.equal(j.editDimension(id, initial), true); assert.ok(j.problem(street));
  assert.equal(j.undoRepair(), true); assert.equal(j.problem(street), null);
  j.world.start = street.a; j.world.destination = street.b;
  j.restart(); j.setRoute([street.a, street.b]); j.start(); j.update(.1);
  assert.ok(j.distanceOnEdge > 0);
  assert.equal(j.editDimension(id, initial), false, 'do not resize an occupied passage');
});

test('generated-city wall drags preview live, commit one undo step, and restore geometry on cancellation', () => {
  const j = journey(), b = j.world.buildings[0]!, key = `wall:${b.name}:front`;
  const engine = new NullEngine({ renderWidth: 200, renderHeight: 200, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 4 });
  engine.getRenderingCanvas = () => ({ clientWidth: 200, clientHeight: 200 } as HTMLCanvasElement);
  const scene = new Scene(engine);
  try {
    const camera = new UniversalCamera('camera', new Vector3(b.x, 30, b.z - .001), scene);
    camera.setTarget(new Vector3(b.x, 0, b.z)); camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    camera.orthoLeft = -6; camera.orthoRight = 6; camera.orthoTop = 6; camera.orthoBottom = -6;
    const mesh = MeshBuilder.CreateBox('building', { width: b.w, height: b.h, depth: b.d }, scene);
    mesh.position.set(b.x, b.h / 2, b.z); mesh.material = new StandardMaterial('walls', scene); mesh.metadata = { building: b.name };
    scene.render();
    const point = Vector3.Project(new Vector3(b.x, b.h, b.z - b.d / 2 + .1), Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(200, 200));
    let syncs = 0;
    const resizer = createProceduralResizer(scene, engine, j, () => syncs++, () => {}), original = j.dimensions.get(key)!;
    assert.equal(resizer.inspect(point.x, point.y)?.id, key);
    assert.equal(resizer.begin(point.x, point.y), true);
    for (let y = 1; y <= 15; y++) resizer.move(point.x, point.y + y);
    assert.equal(j.undoAvailable, false); assert.equal(j.dimensions.get(key), original);
    assert.notEqual(resizer.value(key), original); assert.ok(syncs >= 15);
    assert.equal(resizer.finish(), key); assert.equal(j.undoAvailable, true);
    assert.equal(j.undoRepair(), true); assert.equal(j.dimensions.get(key), original); assert.equal(j.undoAvailable, false);
    assert.equal(resizer.begin(point.x, point.y), true); resizer.move(point.x, point.y + 10); resizer.finish(false);
    assert.equal(resizer.value(key), original); assert.equal(j.undoAvailable, false);
  } finally { scene.dispose(); engine.dispose(); }
});
