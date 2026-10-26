import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bodyFoldingPose } from '../src/robot/bodyFolding';
import { defaultBody, makeBody } from '../src/robot/bodyNet';
import type { Point3 } from '../src/robot/bodyNet';

const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));
const near = (a: Point3, b: Point3) => assert.ok(distance(a, b) < 1e-7, `${a} differs from ${b}`);

test('folding ends at the exact solid geometry and starts at one planar net', () => {
  for (const sides of [4, 8, 12]) for (const taper of [55, 80, 99, 100]) {
    const model = makeBody({ ...defaultBody, sides, taper });
    const flat = bodyFoldingPose(model, 0), closed = bodyFoldingPose(model, 1);
    model.faces.forEach((face, i) => face.solid.forEach((point, j) => near(closed.faces[i][j], point)));
    // At zero, distances across different panels match the single exported sheet.
    model.faces.forEach((face, i) => face.flat.forEach((point, j) => {
      assert.ok(Math.abs(distance(flat.faces[i][j], flat.faces[0][0]) - distance(point, model.faces[0].flat[0])) < 1e-7);
    }));
  }
});

test('every intermediate pose preserves all panel distances and connected hinges', () => {
  for (const taper of [55, 100]) for (const sides of [4, 12]) for (const amount of [0, .1, .5, .9, 1]) {
    const model = makeBody({ ...defaultBody, taper, sides }), pose = bodyFoldingPose(model, amount);
    model.faces.forEach((face, i) => {
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) assert.ok(Math.abs(distance(pose.faces[i][a], pose.faces[i][b]) - distance(face.flat[a], face.flat[b])) < 1e-7);
      if (i) { const band=model.material.bends[i-1];near(pose.bendPoint(i-1,band.flat[0]),pose.faces[i-1][1]);near(pose.bendPoint(i-1,band.flat[3]),pose.faces[i-1][2]);near(pose.bendPoint(i-1,band.flat[1]),pose.faces[i][0]);near(pose.bendPoint(i-1,band.flat[2]),pose.faces[i][3]); }
    });
    model.tabPolygons.forEach(tab => {
      near(pose.point(sides, tab[0]), pose.point(sides - 1, tab[0]));
      near(pose.point(sides, tab[3]), pose.point(sides - 1, tab[3]));
      assert.ok(Math.abs(distance(pose.point(sides, tab[1]), pose.point(sides, tab[2])) - distance(tab[1], tab[2])) < 1e-7);
    });
  }
});

test('pose clamps progress and cannot change fabrication geometry', () => {
  const model = makeBody(defaultBody), before = JSON.stringify(model);
  assert.deepEqual(bodyFoldingPose(model, -1).faces, bodyFoldingPose(model, 0).faces);
  assert.deepEqual(bodyFoldingPose(model, Infinity).faces, bodyFoldingPose(model, 1).faces);
  assert.deepEqual(bodyFoldingPose(model, 2).faces, bodyFoldingPose(model, 1).faces);
  assert.equal(JSON.stringify(model), before);
});
