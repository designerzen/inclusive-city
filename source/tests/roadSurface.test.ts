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

const openBend = [
  { id: 'east', minX: -9, maxX: 1, minZ: -1, maxZ: 1 },
  { id: 'north', minX: -1, maxX: 1, minZ: -1, maxZ: 9 },
];

test('roomy road corners sweep broadly instead of being limited by street width', () => {
  const data = roadSurfaceData(openBend, 4);
  const total = [...data.values()].reduce((sum, d) => sum + area(d), 0);
  assert.ok(Math.abs(total - (36 + 16 * (1 - Math.PI / 4))) < .01);
  const positions = [...data.values()].flatMap(d => Array.from({ length: d.positions.length / 3 }, (_, i) =>
    [d.positions[i * 3]!, d.positions[i * 3 + 2]!]));
  assert.ok(positions.some(([x, z]) => x === -5 && z === 1));
  assert.ok(positions.some(([x, z]) => Math.abs(x! + 1) < 1e-8 && Math.abs(z! - 5) < 1e-8));
});

test('building clearance limits a broad return and resizing frees the corner again', () => {
  const building = { minX: -5, maxX: -2.5, minZ: 2.5, maxZ: 5 };
  const limited = roadSurfaceData(openBend, 4, [building]);
  const total = [...limited.values()].reduce((sum, d) => sum + area(d), 0);
  assert.ok(Math.abs(total - (36 + 1.5 ** 2 * (1 - Math.PI / 4))) < .002);
  for (const data of limited.values()) for (let i = 0; i < data.positions.length; i += 3) {
    const x = data.positions[i]!, z = data.positions[i + 2]!;
    assert.ok(x >= building.maxX || x <= building.minX || z <= building.minZ || z >= building.maxZ);
  }
  const freed = roadSurfaceData(openBend, 4, [{ ...building, minX: -8, maxX: -6 }]);
  assert.ok([...freed.values()].reduce((sum, d) => sum + area(d), 0) > total + 2);
});

test('broad returns stop at street ends and neighbouring returns stay disjoint', () => {
  const short = roadSurfaceData(bend, 4);
  assert.ok(Math.abs([...short.values()].reduce((sum, d) => sum + area(d), 0) - (16 + 9 * (1 - Math.PI / 4))) < .01);
  const cross = [
    { id: 'horizontal', minX: -9, maxX: 9, minZ: -1, maxZ: 1 },
    { id: 'vertical', minX: -1, maxX: 1, minZ: -9, maxZ: 9 },
  ];
  const data = roadSurfaceData(cross, 4);
  // Each of the four empty quadrants can have the full radius independently.
  assert.ok(Math.abs([...data.values()].reduce((sum, d) => sum + area(d), 0) - (68 + 64 * (1 - Math.PI / 4))) < .03);
});
