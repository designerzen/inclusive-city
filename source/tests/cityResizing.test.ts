import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { BotHistory } from '../src/robot/botHistory';
import { CityJourney } from '../src/simulation/cityJourney';
import { createCityResizer, resizeCursor } from '../src/city/cityResizer';
import { CityDocument } from '../src/city/cityDocument';
import { buildingKey } from '../src/city/buildingDimensions';

const journey = () => new CityJourney(new BotHistory(['Curie', 'Einstein']).current, true);

test('wall, door and pavement edits share undo history and immutable journey snapshots', () => {
  const j = journey();
  j.edit('building:Library:front', -10);
  assert.equal(j.city.get('building:Library:back'), -5.5);
  j.edit('door:Library', 1.4);
  j.edit('pavement:0', 4);
  j.edit('sidewalk', 2.4);
  assert.equal(j.undo(), true); assert.equal(j.city.get('sidewalk'), 1.2);
  assert.equal(j.undo(), true); assert.equal(j.city.get('pavement:0'), 3.2);
  assert.equal(j.redo(), true); assert.equal(j.city.get('pavement:0'), 4);
  const saved = structuredClone(j.machine.run.citySnapshot);
  j.restart();
  assert.equal(j.city.get('door:Library'), 1.4);
  assert.equal(j.machine.run.citySnapshot!['building:Library:front'], -10);
  j.edit('door:Library', 1.8);
  assert.equal(saved!['door:Library'], 1.4);
  assert.deepEqual(JSON.parse(JSON.stringify(j.machine.record)), j.machine.record);
});

test('invalid sizes are atomic and an occupied pavement cannot be resized', () => {
  const doc = new CityDocument();
  const before = doc.snapshot();
  for (const [id, value] of [['door:Library', 0], ['building:Library:front', 100], ['pavement:0', NaN]] as const) assert.throws(() => doc.set(id, value));
  assert.deepEqual(doc.snapshot(), before); assert.equal(doc.undoEdit, undefined);
  const j = journey(); j.machine.depart(); j.update(0.5);
  assert.equal(j.canEdit('pavement:0'), false);
  assert.equal(j.edit('pavement:0', 4), false);
});

test('a wall drag previews without history, commits once and cancelled drags restore the value', () => {
  const engine = new NullEngine({ renderWidth: 200, renderHeight: 200, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 4 });
  engine.getRenderingCanvas = () => ({ clientWidth: 200, clientHeight: 200 } as HTMLCanvasElement);
  const scene = new Scene(engine);
  try {
    const camera = new UniversalCamera('camera', new Vector3(-16, 30, -8.001), scene);
    camera.setTarget(new Vector3(-16, 0, -8)); camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
    camera.orthoLeft = -6; camera.orthoRight = 6; camera.orthoTop = 6; camera.orthoBottom = -6;
    const mesh = MeshBuilder.CreateBox('Library', { width: 5, height: 4.2, depth: 5 }, scene);
    mesh.material = new StandardMaterial('walls', scene);
    mesh.position.set(-16, 2.1, -8); mesh.metadata = { building: 'Library' };
    scene.render();
    const point = Vector3.Project(new Vector3(-16, 4.2, -10.4), Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(200, 200));
    const j = journey();
    let syncs = 0;
    const resizer = createCityResizer(scene, engine, j, () => { syncs++; }, () => {});
    const hover = resizer.inspect(point.x, point.y);
    assert.equal(hover?.id, buildingKey('Library', 'front'));
    assert.equal(hover?.available, true);
    assert.equal(resizer.active, false);
    assert.equal(j.city.undoEdit, undefined);
    assert.equal(resizer.begin(point.x, point.y), true);
    for (let n = 1; n <= 15; n++) resizer.move(point.x, point.y + n);
    const key = buildingKey('Library', 'front');
    assert.equal(j.city.undoEdit, undefined);
    assert.notEqual(resizer.value(key), j.city.get(key));
    const committed = resizer.finish();
    assert.equal(committed, key); assert.ok(syncs >= 15);
    assert.equal(j.undo(), true); assert.equal(j.city.undoEdit, undefined);
    assert.equal(resizer.begin(point.x, point.y), true);
    resizer.move(point.x, point.y - 15); resizer.finish(false);
    assert.equal(resizer.value(key), j.city.get(key)); assert.equal(j.city.undoEdit, undefined);
  } finally { scene.dispose(); engine.dispose(); }
});

test('resize cursors follow the projected axis in either drag direction', () => {
  for (const [x, y, cursor] of [[10, 0, 'ew-resize'], [0, 10, 'ns-resize'], [10, 10, 'nwse-resize'], [10, -10, 'nesw-resize']] as const) {
    assert.equal(resizeCursor(x, y), cursor);
    assert.equal(resizeCursor(-x, -y), cursor);
  }
});
