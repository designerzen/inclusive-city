import assert from 'node:assert/strict';
import { test } from 'node:test';
import earcut from 'earcut';
import type { Polygon } from 'polygon-clipping';
import { bodySvg, defaultBody, makeBody } from '../src/robot/bodyNet';
import type { Point3 } from '../src/robot/bodyNet';
import { defaultExposure, exposureLabels, materialArea, normaliseExposure, trimFold } from '../src/robot/bodyExposure';
import type { ExposureKey } from '../src/robot/bodyExposure';
import { bodyFoldingPose } from '../src/robot/bodyFolding';
import { defaultDecoration, ornamentPoint } from '../src/robot/bodyDecoration';

const dot = (a: Point3, b: Point3) => a.reduce((s, v, i) => s + v * b[i], 0);
const sub = (a: Point3, b: Point3) => a.map((v, i) => v - b[i]) as Point3;
const cross = (a: Point3, b: Point3): Point3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function hit(origin: Point3, direction: Point3, a: Point3, b: Point3, c: Point3) {
  const ab = sub(b, a), ac = sub(c, a), p = cross(direction, ac), det = dot(ab, p);
  if (Math.hypot(...cross(ab, ac)) < 1e-5) return false;
  if (Math.abs(det) < 1e-9) return false;
  const t = sub(origin, a), u = dot(t, p) / det;
  if (u < -1e-8 || u > 1 + 1e-8) return false;
  const q = cross(t, ab), v = dot(direction, q) / det;
  return v >= -1e-8 && u + v <= 1 + 1e-8 && dot(ac, q) / det > 1e-6;
}
function triangles(polygon: Polygon) {
  const rings = polygon.map(ring => ring.length > 1 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1] ? ring.slice(0, -1) : ring);
  const points = rings.flat(), holes: number[] = []; let count = rings[0].length;
  for (const ring of rings.slice(1)) { holes.push(count); count += ring.length; }
  return { points, indices: earcut(points.flat(), holes, 2) };
}
test('rays from every enabled sensor and the LED face pass through the actual retained card', () => {
  const settings = normaliseExposure(defaultExposure);
  for (const key of Object.keys(exposureLabels) as ExposureKey[]) settings.enabled[key] = true;
  let populated=0;
  for(let scenario=0;scenario<12;scenario++) {
    const sides=[4,5,8,12][scenario%4], taper=[85,100,130][scenario%3], section=scenario%4, ornament=(['plain','wing','horn','bolt','mixed'] as const)[scenario%5];
    const model = makeBody({ ...defaultBody, sides, taper, section, diameter:240, aspect: 135, thickness:[.3,1,2.5][scenario%3], lean: 0, rim: 2, ridge: 25, height: 280 }, settings, { ...defaultDecoration, ornament, height: 100 }), pose = bodyFoldingPose(model, 1);
    if(model.exposure.panelPolygons.some(p=>p.length))populated++;
    const surfaces = [...model.exposure.panelPolygons.map((polygons, face) => ({ polygons, point: (p: [number, number]) => pose.point(face, p) })), ...model.exposure.tabs.map(polygons => ({ polygons, point: (p: [number, number]) => pose.point(sides, p) })), ...model.exposure.ornaments.map((polygons, i) => ({ polygons, point: (p: [number, number]) => ornamentPoint(model, model.decoration.ornaments[i], p, 1, pose) })),...model.exposure.bands];
    const card: Point3[][] = [];
    for (const surface of surfaces) for (const polygon of surface.polygons) {
      const { points, indices } = triangles(polygon), vertices = points.map(surface.point);
      for (let i = 0; i < indices.length; i += 3) card.push(indices.slice(i, i + 3).map(index => vertices[index]));
    }
    for (const zone of model.exposure.zones) for (const x of [-.99, 0, .99]) for (const y of [-.99, 0, .99]) {
      const origin = zone.origin.map((v, i) => v + zone.right[i] * zone.halfWidth * x + zone.up[i] * zone.halfHeight * y) as Point3;
      const direction = zone.forward.map((v, i) => v + zone.right[i] * zone.spread * x + zone.up[i] * zone.spread * y) as Point3;
      const obstruction = card.find(t => hit(origin, direction, t[0], t[1], t[2]));
      assert.ok(!obstruction, `${zone.key} obstructed for ${sides} panels / ${taper}% taper: ${JSON.stringify({origin,direction,obstruction})}`);
    }
  }
  assert.ok(populated>=10,'sensor checks must exercise actual retained card');
});
test('matrix toggle removes material, survives size changes, and SVG uses the same net contours', () => {
  const settings = normaliseExposure(defaultExposure);
  for (const key of Object.keys(exposureLabels) as ExposureKey[]) settings.enabled[key] = false;
  const closed = makeBody(defaultBody, settings);
  settings.enabled.matrix = true;
  for (const sides of [4, 6, 8, 12]) {
    const model = makeBody({ ...defaultBody, sides }, settings);
    assert.ok(model.exposure.zoneCuts.find(z => z.key === 'matrix')!.area > 0);
    assert.ok(model.valid); assert.equal(model.exposure.net.length, 1);
    const svg = bodySvg(model);
    assert.ok(svg.includes('Protected: matrix'));
    assert.equal((svg.match(/<polygon /g) ?? []).length, model.exposure.net.reduce((s, p) => s + p.length, 0));
  }
  const open = makeBody(defaultBody, settings);
  assert.ok(materialArea(open.exposure.net) < materialArea(closed.exposure.net));
  assert.equal(settings.enabled.matrix, true);
});
test('unusable exposure combinations are rejected without silently disabling protections', () => {
  const settings = normaliseExposure(defaultExposure);
  for (const key of Object.keys(exposureLabels) as ExposureKey[]) settings.enabled[key] = true;
  const short = makeBody(defaultBody, settings), tall = makeBody({ ...defaultBody, height: 280 }, settings);
  assert.equal(short.valid, false); assert.ok(short.exposure.reason.includes('separate pieces'));
  assert.ok(tall.valid); assert.equal(tall.exposure.net.length, 1);
  assert.deepEqual(short.exposure.settings.enabled, settings.enabled);
  assert.equal(short.exposure.zones.length, Object.keys(exposureLabels).length);
});
test('score segments stop at openings and retain only material', () => {
  const result = trimFold([[0, 0], [0, 100]], [[[-10, 30], [10, 30], [10, 70], [-10, 70]]]);
  assert.deepEqual(result, [[[0, 0], [0, 30]], [[0, 70], [0, 100]]]);
});
test('normalisation retains explicit off states and bounds malformed calibration', () => {
  const e = normaliseExposure({ enabled: { matrix: false, laser: 'false' }, margin: Infinity, matrixHeight: -99, laserTilt: 1000 });
  assert.equal(e.enabled.matrix, false); assert.equal(e.enabled.laser, true); assert.equal(e.margin, 5);
  assert.equal(e.matrixHeight, 35); assert.equal(e.laserTilt, 30);
});

test('exposure geometry stays finite at parameter and calibration extremes', () => {
  for (const sides of [4, 7, 12]) for (const diameter of [100, 260]) for (const height of [90, 300]) for (const taper of [55, 100]) for (const laserTilt of [-30, 30]) {
    const settings = normaliseExposure({ ...defaultExposure, margin: 10, matrixHeight: 35, frontOffset: 70, laserTilt });
    const model = makeBody({ ...defaultBody, sides, diameter, height, taper }, settings);
    assert.ok(model.exposure.net.flat(3).every(Number.isFinite));
    if (model.valid) assert.equal(model.exposure.net.length, 1);
  }
});
