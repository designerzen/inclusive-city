import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bodySvg, defaultBody, makeBody } from '../src/robot/bodyNet';
import { appendageLayouts, defaultDecoration, normaliseDecoration, ornamentPoint, ornamentStyles, surpriseDecoration, windowStyles } from '../src/robot/bodyDecoration';
import { defaultExposure } from '../src/robot/bodyExposure';
import { bodyFoldingPose } from '../src/robot/bodyFolding';
const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));

test('ornamental panels remain rigid, share their creases and flatten to the cutting net', () => {
  for (const ornament of Object.keys(ornamentStyles) as (keyof typeof ornamentStyles)[]) for (const taper of [55, 100]) for (const fraction of [0, .3, .7, 1]) {
    const model = makeBody({ ...defaultBody, taper }, undefined, { ...defaultDecoration, ornament }), pose = bodyFoldingPose(model, fraction);
    model.decoration.ornaments.forEach((facet, i) => {
      const points = facet.flat.map(p => ornamentPoint(model, facet, p, fraction, pose));
      for (let a = 0; a < points.length; a++) for (let b = a + 1; b < points.length; b++) assert.ok(Math.abs(distance(points[a], points[b]) - distance(facet.flat[a], facet.flat[b])) < 1e-7);
      for (const p of facet.hinges.at(-1)!.edge) {
        const actual = ornamentPoint(model, facet, p, fraction, pose,true);
        const expected = facet.hinges.length === 1 ? pose.point(facet.face, p) : ornamentPoint(model, model.decoration.ornaments[i - 1], p, fraction, pose);
        assert.ok(distance(actual, expected) < 1e-7);
      }
      if (fraction === 0) points.forEach((p, j) => assert.ok(distance(p, pose.point(facet.face, facet.flat[j])) < 1e-7));
    });
  }
});
test('appendage layouts and variation alter the sheet while preserving connected roots', () => {
  const signatures = new Set<string>();
  for (const layout of Object.keys(appendageLayouts) as (keyof typeof appendageLayouts)[]) {
    const model = makeBody({ ...defaultBody, height: 280 }, defaultExposure, { ...defaultDecoration, ornament: 'mixed', layout, variation: 80, offset: 3 });
    assert.ok(model.valid, `${layout}: ${model.exposure.reason}`);
    assert.equal(model.exposure.net.length, 1);
    signatures.add(JSON.stringify(model.exposure.net));
    if (layout === 'pair') assert.equal(new Set(model.decoration.ornaments.map(p => p.group)).size, 2);
  }
  assert.equal(signatures.size, Object.keys(appendageLayouts).length);
  const plain = makeBody(defaultBody, undefined, defaultDecoration);
  assert.equal(plain.decoration.ornaments.length, 0); assert.equal(plain.decoration.windows.length, 0);
});
test('surprises change appendage and window families and respect exclusions', () => {
  let seed = 42, previous = defaultDecoration;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const families = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const next = surpriseDecoration(previous, true, true, random);
    assert.notEqual(next.ornament, previous.ornament); assert.notEqual(next.windows, previous.windows);
    assert.notEqual(next.ornament, 'plain'); assert.notEqual(next.windows, 'none');
    families.add(next.ornament); previous = next;
  }
  assert.equal(families.size, Object.keys(ornamentStyles).length - 1);
  const excluded = surpriseDecoration(previous, false, false, random);
  assert.equal(excluded.ornament, 'plain'); assert.equal(excluded.windows, 'none');
});
test('every ornament and window family produces a connected sheet with matching SVG stock extents', () => {
  for (const ornament of Object.keys(ornamentStyles) as (keyof typeof ornamentStyles)[]) for (const windows of Object.keys(windowStyles) as (keyof typeof windowStyles)[]) {
    const model = makeBody({ ...defaultBody, height: 280 }, defaultExposure, { ...defaultDecoration, ornament, windows });
    assert.ok(model.valid, `${ornament}/${windows}: ${model.exposure.reason}`); assert.equal(model.exposure.net.length, 1);
    const svg = bodySvg(model);
    assert.ok(svg.includes(`Ornament: ${ornament}`)); assert.ok(svg.includes(`ornamental windows: ${windows}`));
    assert.ok(!svg.includes('<text'));
    if (ornament !== 'plain') assert.ok(bodySvg(model, true).includes('OUT '));
    if (ornament === 'accordion') assert.ok(bodySvg(model, true).includes('REV '));
    assert.ok(svg.includes(`width="${(model.bounds.width + 10).toFixed(4)}mm"`));
    for (const p of model.exposure.net.flat(2)) {
      assert.ok(p[0] >= model.bounds.x - 1e-4 && p[0] <= model.bounds.x + model.bounds.width + 1e-4);
      assert.ok(p[1] >= model.bounds.y - 1e-4 && p[1] <= model.bounds.y + model.bounds.height + 1e-4);
    }
    if (windows !== 'none') assert.ok(model.decoration.windows.length > 0);
  }
});
test('sensor constraints can omit detached rim motifs without disabling protection', () => {
  const model = makeBody(defaultBody, defaultExposure, { ...defaultDecoration, ornament: 'crown' });
  assert.ok(model.valid); assert.ok(model.exposure.omittedOrnaments > 0);
  assert.ok(model.exposure.settings.enabled.laser); assert.ok(model.exposure.settings.enabled.matrix);
  assert.equal(model.exposure.net.length, 1);
  model.exposure.ornaments.forEach((polygons, i) => {
    if (!polygons.length) assert.ok(model.exposure.ornaments.every((other, j) => model.decoration.ornaments[j].group !== model.decoration.ornaments[i].group || !other.length));
  });
});
test('detail controls clamp malformed input and preserve finite geometry at range extremes', () => {
  assert.deepEqual(normaliseDecoration(null), defaultDecoration);
  const settings = normaliseDecoration({ ornament: 'unknown', windows: '<script>', height: 999, rows: -10, angle: NaN });
  assert.equal(settings.ornament, 'plain'); assert.equal(settings.windows, 'none'); assert.equal(settings.height, 120); assert.equal(settings.rows, 1); assert.equal(settings.angle, 45);
  for (const sides of [4, 12]) for (const taper of [55, 100]) for (const diameter of [100, 260]) {
    const model = makeBody({ ...defaultBody, sides, taper, diameter }, defaultExposure, { ...defaultDecoration, ornament: 'accordion', height: 48, angle: 65, windows: 'star', windowSize: 24, rows: 4 });
    assert.ok(model.exposure.net.flat(3).every(Number.isFinite));
    if (model.valid) assert.equal(model.exposure.net.length, 1);
  }
});
