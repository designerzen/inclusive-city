import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { createStudioBuilding } from '../src/city/studioBuilding';

test('studio encloses the goal with walls, floor and roof and keeps every supported doorway clear', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const entrance = new TransformNode('entrance', scene), material = new StandardMaterial('material', scene);
    const studio = createStudioBuilding(scene, entrance, material, material, material);
    for (const width of [.5, 2, 6]) {
      studio.sync(width, false);
      assert.equal(studio.roof.isEnabled(), true);
      for (const mesh of studio.parts) mesh.computeWorldMatrix(true);
      for (const mesh of studio.parts.slice(0, 5)) {
        const { minimumWorld: min, maximumWorld: max } = mesh.getBoundingInfo().boundingBox;
        assert.ok(min.x >= width / 2 || max.x <= -width / 2 || min.z > 2, `${mesh.name} leaves the approach and destination clear`);
      }
      const floor = studio.parts[5]!.getBoundingInfo().boundingBox;
      assert.ok(floor.minimumWorld.x < -3 && floor.maximumWorld.x > 3 && floor.minimumWorld.z === 0 && floor.maximumWorld.z === 6);
    }
    studio.sync(6, true);
    assert.equal(studio.roof.isEnabled(), false, 'arrival camera can see into the completed studio');
    assert.ok(studio.parts.every(mesh => mesh.isEnabled()), 'cutaway retains the building');
  } finally { scene.dispose(); engine.dispose(); }
});
