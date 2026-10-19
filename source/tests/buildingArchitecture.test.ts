import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity } from '../src/city/proceduralCity';
import { createBuildingArchitecture, type BuildingArchitecture } from '../src/city/buildingArchitecture';

test('every generated skyline retains two towers and creative landmarks after station clearance', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  for (let seed = 1; seed <= 250; seed++) {
    const world = generateCity(seed, [bot]);
    assert.equal(world.buildings.filter(b => b.architecture === 'skyscraper').length, 2, `seed ${seed}`);
    assert.ok(world.buildings.some(b => b.h >= 13));
    for (const role of ['gallery', 'record-store', 'museum']) assert.ok(world.buildings.some(b => b.creativeRole === role));
    assert.deepEqual(generateCity(seed, [bot]).buildings, world.buildings);
  }
});

test('all architectural styles merge details and follow resized footprints', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  try {
    const glass = new StandardMaterial('glass', scene), trim = new StandardMaterial('trim', scene), roof = new StandardMaterial('roof', scene);
    for (const architecture of ['skyscraper', 'apartments', 'shop', 'civic', 'house'] as BuildingArchitecture[]) {
      const building = { name: 'Tower', x: 0, z: 0, w: 4, d: 3, h: architecture === 'skyscraper' ? 13.5 : 6, architecture };
      const root = createBuildingArchitecture(building, scene, glass, trim, roof);
      const meshes = root.getChildMeshes();
      assert.ok(meshes.length > 0 && meshes.length <= 3, 'bounded draw calls per building');
      assert.ok(meshes.every(mesh => !mesh.isPickable));
      root.scaling.set(1.5, 1, 2); root.position.set(8, 0, 4);
      for (const mesh of meshes) {
        mesh.computeWorldMatrix(true);
        const bounds = mesh.getBoundingInfo().boundingBox;
        assert.ok(bounds.minimumWorld.x >= 8 - 3.4 && bounds.maximumWorld.x <= 8 + 3.4);
        assert.ok(bounds.minimumWorld.z >= 4 - 4 && bounds.maximumWorld.z <= 4 + 4);
        assert.ok(bounds.minimumWorld.y >= 0);
      }
      if (architecture === 'skyscraper') assert.ok(meshes.some(mesh => mesh.getBoundingInfo().boundingBox.maximumWorld.y > building.h + 3));
      root.dispose();
    }
  } finally { scene.dispose(); engine.dispose(); }
});
