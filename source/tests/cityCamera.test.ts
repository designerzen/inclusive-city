import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { createCityCamera } from '../src/city/cityCamera';

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
    assert.equal(controls.camera.position.y, -controls.camera.position.z);
    controls.setView('follow');
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
    assert.ok(controls.camera.position.equalsWithEpsilon(pose.position.add(new Vector3(0, 1.8, 0))));
    assert.ok(controls.camera.getTarget().z > pose.position.z);
    controls.setZoom(0.8);
    assert.ok(controls.camera.fov < 0.9);
    controls.fit();
    assert.equal(controls.view, 'overhead');
    assert.equal(controls.canPan(), true);
    assert.ok(controls.camera.getTarget().equalsWithEpsilon(Vector3.Zero()));
    controls.pan(4, 4);
    assert.equal(controls.camera.position.x, 4);
    assert.ok(Math.abs(controls.camera.position.z - 3.99) < 0.001);
  } finally {
    scene.dispose();
    engine.dispose();
  }
});
