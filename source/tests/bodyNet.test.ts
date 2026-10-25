import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bodySvg, defaultBody, makeBody, normaliseBody, slottedFacePieces } from '../src/robot/bodyNet';
import type { Point } from '../src/robot/bodyNet';

const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));
const cross = (a: Point, b: Point, c: Point) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const inside = (point: Point, polygon: Point[]) => {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
};

test('developed panels are rigidly congruent to the folded body over the parameter range', () => {
  for (let sides = 4; sides <= 12; sides++) for (const taper of [55, 80, 99, 100]) for (const diameter of [100, 180, 260]) for (const height of [90, 300]) {
    const model = makeBody({ ...defaultBody, sides, taper, diameter, height });
    for (const face of model.faces) for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
      assert.ok(Math.abs(distance(face.flat[a], face.flat[b]) - distance(face.solid[a], face.solid[b])) < 1e-7);
    }
    model.faces.slice(1).forEach((face, i) => {
      assert.deepEqual(face.flat[0], model.faces[i].flat[1]); assert.deepEqual(face.flat[3], model.faces[i].flat[2]);
    });
    assert.ok(model.bounds.width > 0 && model.bounds.height > 0);
  }
});

test('fabricable nets have one simple exterior, attached tabs, and slots entirely within face 1', () => {
  for (let sides = 4; sides <= 12; sides++) for (const taper of [55, 75, 100]) for (const diameter of [100, 260]) for (const height of [90, 300]) for (const tabs of [2, 5]) {
    const model = makeBody({ ...defaultBody, sides, taper, diameter, height, tabs });
    if (!model.valid) continue;
    const polygon = model.boundary;
    for (let i = 0; i < polygon.length; i++) for (let j = i + 2; j < polygon.length; j++) {
      if (i === 0 && j === polygon.length - 1) continue;
      const a = polygon[i], b = polygon[(i + 1) % polygon.length], c = polygon[j], d = polygon[(j + 1) % polygon.length];
      assert.ok(!(cross(a, b, c) * cross(a, b, d) < -1e-8 && cross(c, d, a) * cross(c, d, b) < -1e-8), `boundary intersects: ${JSON.stringify(model.p)}`);
    }
    for (const slot of model.slots) for (const point of slot) assert.ok(inside(point, model.faces[0].flat), `slot outside face: ${JSON.stringify(model.p)}`);
    assert.equal(model.tabPolygons.length, tabs); assert.equal(model.slots.length, tabs);
    assert.equal(model.folds.length, sides - 1 + tabs * 2);
  }
});

test('prism limit, invalid seam spacing and conservative skeleton fit', () => {
  const prism = makeBody({ ...defaultBody, taper: 100 });
  assert.equal(prism.faces[0].flat[2][1], defaultBody.height);
  assert.equal(prism.faces[0].flat[1][0], prism.bottom);
  assert.ok(makeBody(defaultBody).fits);
  assert.equal(makeBody({ ...defaultBody, skeletonWidth: 200 }).fits, false);
  assert.equal(makeBody({ ...defaultBody, skeletonHeight: 280 }).fits, false);
  assert.equal(makeBody({ ...defaultBody, height: 90, tabs: 5, taper: 100 }).valid, false);
  assert.equal(makeBody({ ...defaultBody, sides: 12, diameter: 100, taper: 55 }).valid, false);
});

test('SVG exports retain true mm scale, distinct operations and no machine-file annotations', () => {
  const model = makeBody(defaultBody), svg = bodySvg(model), guide = bodySvg(model, true);
  assert.ok(svg.includes(`width="${(model.bounds.width + 10).toFixed(4)}mm"`));
  assert.ok(svg.includes('id="CUT"')); assert.ok(svg.includes('id="SCORE"'));
  assert.equal((svg.match(/<polygon /g) ?? []).length, 1 + defaultBody.tabs);
  assert.ok(!svg.includes('<text')); assert.ok(!svg.includes('stroke-dasharray'));
  assert.ok(guide.includes('<text')); assert.ok(guide.includes('stroke-dasharray'));
});

test('parameters clamp malformed or non-finite data to safe finite values', () => {
  const p = normaliseBody({ sides: 999, taper: NaN, height: Infinity, thickness: -.3 });
  assert.equal(p.sides, 12); assert.equal(p.height, defaultBody.height); assert.equal(p.taper, defaultBody.taper); assert.equal(p.thickness, .2);
});

test('preview removes exactly the exported slot areas from the first face', () => {
  const area = (p: Point[]) => Math.abs(p.reduce((sum, a, i) => { const b = p[(i + 1) % p.length]; return sum + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
  for (const taper of [55, 99, 100]) for (const tabs of [2, 3, 5]) {
    const m = makeBody({ ...defaultBody, taper, tabs });
    const removed = area(m.faces[0].flat) - slottedFacePieces(m).reduce((sum, p) => sum + area(p), 0);
    assert.ok(Math.abs(removed - m.slots.reduce((sum, p) => sum + area(p), 0)) < 1e-7);
  }
});
