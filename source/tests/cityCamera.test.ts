import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createCityCamera, type CityView } from '../src/city/cityCamera';

test('city rotation visits four edges, reverses and preserves focus and zoom', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const controls = createCityCamera(engine, scene, () => ({ position: Vector3.Zero(), heading: 0, eyeHeight: 1.8 }));
  try {
    controls.setView('angled'); controls.update(2);
    controls.pan(3, 4); controls.setZoom(.8); controls.update(.3);
    const start = controls.camera.position.clone();
    const zoom = controls.camera.orthoTop;
    for (const offset of [new Vector3(55, 55, 0), new Vector3(0, 55, 55), new Vector3(-55, 55, 0), new Vector3(0, 55, -55)]) {
      const before = controls.camera.position.clone();
      controls.rotateCity(1);
      assert.ok(controls.camera.position.equalsWithEpsilon(before));
      controls.update(2);
      assert.ok(controls.camera.position.equalsWithEpsilon(offset.add(new Vector3(3, 0, 4))));
    }
    assert.ok(controls.camera.position.equalsWithEpsilon(start));
    assert.ok(Math.abs(controls.camera.orthoTop! - zoom!) < 1e-5);
    controls.rotateCity(-1); controls.update(0, true);
    assert.ok(controls.camera.position.equalsWithEpsilon(new Vector3(-52, 55, 4)));
    controls.setView('overhead'); controls.update(2);
    const overhead = controls.camera.position.clone();
    controls.rotateCity(1); controls.update(2);
    assert.ok(controls.camera.position.equalsWithEpsilon(overhead));
  } finally { scene.dispose(); engine.dispose(); }
});

test('rotation keeps its orbit radius and target through every frame and repeated clicks', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const controls = createCityCamera(engine, scene, () => ({ position: Vector3.Zero(), heading: 0, eyeHeight: 1.8 }));
  try {
    controls.setView('angled'); controls.update(2);
    controls.rotateCity(1);
    for (let frame = 0; frame < 72; frame++) {
      controls.update(1 / 60);
      const position = controls.camera.position;
      assert.ok(Math.abs(Math.hypot(position.x, position.z) - 55) < 1e-5);
      assert.equal(position.y, 55);
      controls.camera.getViewMatrix(true);
      assert.ok(controls.camera.getTarget().subtract(position).normalize().equalsWithEpsilon(position.negate().normalize(), 1e-5));
      if (frame === 20) {
        const before = position.clone();
        controls.rotateCity(1);
        assert.ok(position.equalsWithEpsilon(before));
      }
    }
    controls.update(2);
    assert.ok(controls.camera.position.equalsWithEpsilon(new Vector3(0, 55, 55)));
    const before = controls.camera.orthoTop!;
    controls.setZoom(.8);
    assert.equal(controls.camera.orthoTop, before);
    controls.update(.15);
    assert.ok(Math.abs(controls.camera.orthoTop! - before * .9) < 1e-5);
    controls.update(.15);
    assert.ok(Math.abs(controls.camera.orthoTop! - before * .8) < 1e-5);
  } finally { scene.dispose(); engine.dispose(); }
});

test('studio arrival orbits, descends to the face and respects reduced motion', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const pose = { position: new Vector3(22, .035, 8), heading: -Math.PI / 2, eyeHeight: 1.8 };
  const controls = createCityCamera(engine, scene, () => pose);
  try {
    controls.beginArrival(); controls.update(2);
    const high = controls.camera.position.clone();
    controls.update(2);
    assert.ok(!controls.camera.position.equalsWithEpsilon(high));
    assert.equal(controls.arrivalComplete, false);
    controls.update(4);
    controls.camera.getViewMatrix(true);
    const eyes = pose.position.add(new Vector3(0, pose.eyeHeight, 0));
    assert.equal(controls.arrivalComplete, true);
    assert.ok(controls.camera.getTarget().subtract(controls.camera.position).normalize().equalsWithEpsilon(eyes.subtract(controls.camera.position).normalize(), 1e-5));
    assert.ok(Math.abs(controls.camera.position.y - eyes.y) < 1e-6);
    assert.ok(controls.camera.position.x > eyes.x);
    assert.ok(Math.abs(controls.camera.position.subtract(eyes).length() - 1.8) < 1e-6);
    controls.fit(); assert.equal(controls.arrivalComplete, false);
    controls.beginArrival(); controls.update(0, true);
    controls.camera.getViewMatrix(true);
    assert.equal(controls.arrivalComplete, true);
    assert.ok(controls.camera.getTarget().subtract(controls.camera.position).normalize().equalsWithEpsilon(eyes.subtract(controls.camera.position).normalize(), 1e-5));
  } finally { scene.dispose(); engine.dispose(); }
});

test('camera presets track robot turns and elevation, then fit restores the map', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const pose = { position: new Vector3(-20, 0, -15), heading: -Math.PI / 2, eyeHeight: 1.8 };
  const controls = createCityCamera(engine, scene, () => pose);
  try {
    assert.equal(controls.camera.mode, Camera.ORTHOGRAPHIC_CAMERA);
    controls.setView('angled');
    controls.update(2);
    assert.equal(controls.camera.position.y, -controls.camera.position.z);
    controls.setView('follow');
    controls.update(2);
    assert.equal(controls.camera.mode, Camera.PERSPECTIVE_CAMERA);
    assert.ok(controls.camera.position.x < pose.position.x);
    const before = controls.camera.position.clone();
    pose.position.addInPlace(new Vector3(3, 2, 0));
    controls.update();
    assert.ok(controls.camera.position.subtract(before).equalsWithEpsilon(new Vector3(3, 2, 0)));
    pose.heading = Math.PI;
    controls.update();
    assert.ok(controls.camera.position.z < pose.position.z);
    controls.pan(4, 4);
    assert.equal(controls.canPan(), false);
    controls.setView('robot-eye');
    controls.update(2);
    controls.camera.getViewMatrix(true);
    assert.ok(controls.camera.position.equalsWithEpsilon(pose.position.add(new Vector3(0, 1.8, 0))));
    assert.ok(controls.camera.getTarget().z > pose.position.z);
    controls.setZoom(0.8);
    controls.update(.3);
    assert.ok(controls.camera.fov < 0.9);
    controls.fit();
    controls.update(2);
    controls.camera.getViewMatrix(true);
    assert.equal(controls.view, 'overhead');
    assert.equal(controls.canPan(), true);
    assert.ok(controls.camera.getTarget().subtract(controls.camera.position).normalize().equalsWithEpsilon(Vector3.Zero().subtract(controls.camera.position).normalize(), 1e-3));
    controls.pan(4, 4);
    assert.equal(controls.camera.position.x, 4);
    assert.ok(Math.abs(controls.camera.position.z - 3.99) < 0.001);
  } finally {
    scene.dispose();
    engine.dispose();
  }
});

test('all camera presets ease position, orientation and projection without a cut', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const pose = { position: new Vector3(-20, 0, -15), heading: -Math.PI / 2, eyeHeight: 1.8 };
  const controls = createCityCamera(engine, scene, () => pose);
  const views: CityView[] = ['overhead', 'angled', 'follow', 'robot-eye'];
  const probe = new Vector3(2, 3, 12);
  try {
    for (const from of views) for (const to of views) {
      if (from === to) continue;
      controls.setView(from); controls.update(2);
      const start = controls.camera.position.clone();
      const rotation = controls.camera.rotation.clone();
      const projected = Vector3.TransformCoordinates(probe, controls.camera.getProjectionMatrix(true));
      controls.setView(to);
      assert.ok(controls.camera.position.equalsWithEpsilon(start, 1e-5), `${from} → ${to}: position cut`);
      assert.ok(controls.camera.rotation.equalsWithEpsilon(rotation, 1e-5), `${from} → ${to}: rotation cut`);
      assert.ok(Vector3.TransformCoordinates(probe, controls.camera.getProjectionMatrix(true)).equalsWithEpsilon(projected, 1e-5), `${from} → ${to}: projection cut`);
      controls.update(.3);
      const intermediate = controls.camera.position.clone();
      assert.ok(!intermediate.equalsWithEpsilon(start));
      controls.update(.9);
      const end = controls.camera.position.clone();
      assert.ok(intermediate.equalsWithEpsilon(Vector3.Lerp(start, end, .15625), 1e-5));
      controls.update();
      assert.ok(controls.camera.position.equalsWithEpsilon(end));
    }
  } finally { scene.dispose(); engine.dispose(); }
});

test('camera changes can be interrupted and reduced motion skips transitions', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  const pose = { position: new Vector3(-20, 0, -15), heading: 0, eyeHeight: 1.8 };
  const controls = createCityCamera(engine, scene, () => pose);
  try {
    controls.setView('follow'); controls.update(.4);
    const position = controls.camera.position.clone();
    const projection = controls.camera.getProjectionMatrix(true).clone();
    controls.setView('robot-eye');
    assert.ok(controls.camera.position.equalsWithEpsilon(position));
    assert.ok(controls.camera.getProjectionMatrix(true).equals(projection));
    controls.update(.6);
    pose.position.x += 4;
    controls.update(.6);
    assert.ok(controls.camera.position.equalsWithEpsilon(pose.position.add(new Vector3(0, pose.eyeHeight, 0))));
    controls.fit(); controls.update(0, true);
    assert.ok(controls.camera.position.equalsWithEpsilon(new Vector3(0, 55, -.01)));
    controls.setView('robot-eye');
    assert.ok(controls.camera.position.equalsWithEpsilon(pose.position.add(new Vector3(0, pose.eyeHeight, 0))));
    assert.equal(controls.camera.mode, Camera.PERSPECTIVE_CAMERA);
  } finally { scene.dispose(); engine.dispose(); }
});
