import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bodySvg, defaultBody, makeBody } from '../src/robot/bodyNet';
import { defaultDecoration, normaliseDecoration, ornamentPoint } from '../src/robot/bodyDecoration';
import { bodyFoldingPose } from '../src/robot/bodyFolding';
import { defaultExposure } from '../src/robot/bodyExposure';

test('roof panels stay rigid and unfold into one connected sheet across regular body sizes', () => {
  for (const roof of ['flaps', 'lid', 'pyramid'] as const) for (const sides of [4, 6, 8, 12]) for (const taper of [55, 100, 140]) {
    const model = makeBody({ ...defaultBody, sides, taper }, undefined, { ...defaultDecoration, roof });
    assert.ok(model.geometryValid, `${roof}/${sides}/${taper}: ${model.exposure.reason}`);
    assert.equal(model.exposure.net.length, 1);
    for (const fraction of [0, .5, 1]) {
      const pose = bodyFoldingPose(model, fraction);
      for (const facet of model.decoration.ornaments) {
        const points = facet.flat.map(p => ornamentPoint(model, facet, p, fraction, pose));
        for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
          const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, k) => v - b[k]));
          assert.ok(Math.abs(distance(points[i], points[j]) - distance(facet.flat[i], facet.flat[j])) < 1e-6);
        }
        if (fraction === 1 && roof !== 'lid') {
          const tip = points[2];
          assert.ok(Math.hypot(tip[0], tip[2]) < 2, 'roof tips meet near the centre');
          assert.ok(Math.abs(tip[1] - model.p.height - (roof === 'pyramid' ? 45 : 0)) < 2);
        }
      }
    }
    const svg = bodySvg(model);
    assert.ok(svg.includes(`Roof: ${roof}`));
    for (const p of model.exposure.net.flat(2)) {
      assert.ok(p[0] >= model.bounds.x - 1e-4 && p[0] <= model.bounds.x + model.bounds.width + 1e-4);
      assert.ok(p[1] >= model.bounds.y - 1e-4 && p[1] <= model.bounds.y + model.bounds.height + 1e-4);
    }
  }
});

test('roof settings migrate old designs and reject unsupported profiles without changing protections', () => {
  assert.equal(normaliseDecoration({ ornament: 'wing' }).roof, 'open');
  assert.equal(normaliseDecoration({ roof: '<script>', roofRise: Infinity }).roof, 'open');
  assert.equal(normaliseDecoration({ roofRise: 1000 }).roofRise, 100);
  for (const change of [{ sides: 5 }, { lean: 10 }, { section: 2 }, { aspect: 120 }, { rim: 1, ridge: 20 }]) {
    const model = makeBody({ ...defaultBody, ...change }, defaultExposure, { ...defaultDecoration, roof: 'lid' });
    assert.equal(model.valid, false);
    assert.ok(model.decoration.roofReason);
    assert.deepEqual(model.exposure.settings.enabled, defaultExposure.enabled);
  }
  for (const roof of ['flaps', 'lid', 'pyramid'] as const) {
    const model = makeBody({ ...defaultBody, height: 240, taper: 100 }, defaultExposure, { ...defaultDecoration, roof });
    assert.ok(model.geometryValid, model.exposure.reason);
    assert.deepEqual(model.exposure.settings.enabled, defaultExposure.enabled);
  }
});
