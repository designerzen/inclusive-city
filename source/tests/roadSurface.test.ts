import assert from 'node:assert/strict';
import { test } from 'node:test';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Ray } from '@babylonjs/core/Culling/ray';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { createRoadSurface, roadSurfaceData, updateRoadSurface } from '../src/city/roadSurface';
import type { RoadSurfaceData } from '../src/city/roadSurface';

function area(data: RoadSurfaceData) {
  let sum = 0;
  for (let i = 0; i < data.indices.length; i += 3) {
    const a = data.indices[i]! * 3, b = data.indices[i + 1]! * 3, c = data.indices[i + 2]! * 3;
    const cross = (data.positions[b]! - data.positions[a]!) * (data.positions[c + 2]! - data.positions[a + 2]!)
      - (data.positions[b + 2]! - data.positions[a + 2]!) * (data.positions[c]! - data.positions[a]!);
    assert.ok(cross > 0, 'all triangles use Babylon left-handed upward face winding');
    sum += cross / 2;
  }
  return sum;
}

const bend = [
  { id: 'east', minX: -4, maxX: 1, minZ: -1, maxZ: 1 },
  { id: 'north', minX: -1, maxX: 1, minZ: -1, maxZ: 4 },
];

test('overlapping streets and duplicate footprints draw their union exactly once', () => {
  const data = roadSurfaceData([...bend, { ...bend[0]!, id: 'duplicate' }], 0);
  assert.equal([...data.values()].reduce((sum, d) => sum + area(d), 0), 16);
  assert.equal(data.get('duplicate')!.indices.length, 0);
});

test('a bend has a circular corner return tangent to both street edges', () => {
  const data = roadSurfaceData(bend, .5);
  const total = [...data.values()].reduce((sum, d) => sum + area(d), 0);
  assert.ok(Math.abs(total - (16 + .25 * (1 - Math.PI / 4))) < .001);
  const arc = [...data.values()].flatMap(d => Array.from({ length: d.positions.length / 3 }, (_, i) => [d.positions[i * 3]!, d.positions[i * 3 + 2]!]));
  assert.ok(arc.some(([x, z]) => x === -1.5 && z === 1));
  assert.ok(arc.some(([x, z]) => Math.abs(x! + 1) < 1e-8 && Math.abs(z! - 1.5) < 1e-8));
});

test('junctions with unequal widths remain disjoint when another street is widened', () => {
  const cross = [...bend, { id: 'west', minX: 1, maxX: 4, minZ: -.3, maxZ: .3 }];
  const narrow = roadSurfaceData(cross, 0);
  assert.ok(Math.abs([...narrow.values()].reduce((sum, d) => sum + area(d), 0) - 17.8) < 1e-8);
  cross[2] = { ...cross[2]!, minZ: -2, maxZ: 2 };
  const wide = roadSurfaceData(cross, 0);
  assert.equal([...wide.values()].reduce((sum, d) => sum + area(d), 0), 28);
  // Curve area remains small and positive even near narrow neighbouring roads.
  const rounded = roadSurfaceData(cross);
  const total = [...rounded.values()].reduce((sum, d) => sum + area(d), 0);
  assert.ok(total > 28 && total < 29);
});

test('rendered corners are pickable and regenerate in place for width editing', () => {
  const engine = new NullEngine(), scene = new Scene(engine);
  try {
    const road = createRoadSurface('road', scene);
    road.material = new StandardMaterial('pavement', scene);
    road.position.x = -1.5;
    updateRoadSurface(road, roadSurfaceData(bend, .5).get('east')!);
    road.computeWorldMatrix(true);
    const hit = scene.pickWithRay(new Ray(new Vector3(-1.05, 3, 1.05), new Vector3(0, -1, 0)), m => m === road);
    assert.ok(hit?.hit, 'corner fills the gap outside the rectangular streets');
    assert.ok(Math.abs(hit.pickedPoint!.y - .075) < 1e-6);
    assert.ok(hit.getNormal(true)!.y > 0);
    updateRoadSurface(road, roadSurfaceData([bend[0]!], 0).get('east')!);
    road.computeWorldMatrix(true);
    assert.equal(scene.pickWithRay(new Ray(new Vector3(-1.05, 3, 1.05), new Vector3(0, -1, 0)), m => m === road)?.hit, false);
    assert.equal(road.position.x, -1.5);
  } finally { scene.dispose(); engine.dispose(); }
});
