import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { createBuildingRoof } from '../src/city/buildingRoof';

test('solid roofs have a ridge, sloping faces and gable ends that follow building resizing', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const building = new TransformNode('building', scene);
    const roof = createBuildingRoof('roof', 6, 5, 1.5, scene);
    roof.material = new StandardMaterial('roof-material', scene);
    roof.parent = building;
    roof.position.y = 4;
    const pick = (origin: Vector3, direction: Vector3) => {
      roof.computeWorldMatrix(true);
      return scene.pickWithRay(new Ray(origin, direction), mesh => mesh === roof);
    };
    const slope = pick(new Vector3(1.5, 10, 0), new Vector3(0, -1, 0));
    assert.ok(slope?.hit);
    assert.ok(slope.getNormal(true)!.y > 0, 'roof slopes face upward for lighting and picking');
    assert.ok(Math.abs(slope.pickedPoint!.y - 4.75) < 1e-6);
    const gable = pick(new Vector3(0, 4.5, -10), new Vector3(0, 0, 1));
    assert.ok(gable?.hit);
    assert.ok(gable.getNormal(true)!.z < 0, 'front gable faces outwards');
    assert.equal(gable.pickedPoint!.z, -2.5);
    building.scaling.set(2, 1, 1.5);
    building.position.x = 8;
    const resized = pick(new Vector3(11, 10, 0), new Vector3(0, -1, 0));
    assert.ok(resized?.hit);
    assert.ok(Math.abs(resized.pickedPoint!.y - 4.75) < 1e-6);
  } finally { scene.dispose(); engine.dispose(); }
});
