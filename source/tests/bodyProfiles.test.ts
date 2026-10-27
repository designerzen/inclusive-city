import assert from 'node:assert/strict';
import { test } from 'node:test';
import { defaultBody, makeBody } from '../src/robot/bodyNet';
import { bodyFoldingPose } from '../src/robot/bodyFolding';
import { defaultExposure } from '../src/robot/bodyExposure';
import { defaultDecoration } from '../src/robot/bodyDecoration';
const distance = (a: number[], b: number[]) => Math.hypot(...a.map((v, i) => v - b[i]));

test('sculpted cross-sections, leaning walls and angled rims develop and close rigidly', () => {
  for (const section of [0, 1, 2, 3]) for (const rim of [0, 1, 2, 3]) for (const taper of [75, 100, 130]) for (const sides of [5, 8]) {
    const model = makeBody({ ...defaultBody, section, rim, taper, sides, aspect: 145, lean: 20, ridge: 30, height: 280 });
    for (const face of model.faces) for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) assert.ok(Math.abs(distance(face.flat[a], face.flat[b]) - distance(face.solid[a], face.solid[b])) < 1e-6);
    for (const fraction of [0, .4, 1]) {
      const pose = bodyFoldingPose(model, fraction);
      pose.faces.forEach((points, i) => {
        if (fraction === 1) points.forEach((p, j) => assert.ok(distance(p, model.faces[i].solid[j]) < 1e-6, `Closure ${section}/${rim}/${taper}/${sides}`));
        if (i) { const band=model.material.bends[i-1];assert.ok(distance(pose.bendPoint(i-1,band.flat[1]),points[0])<1e-6);assert.ok(distance(pose.bendPoint(i-1,band.flat[2]),points[3])<1e-6); }
      });
    }
  }
});
test('sculpted presets retain a connected fabrication net and distinct silhouettes', () => {
  const silhouettes = new Set<string>();
  for (const [index, p] of [
    { section: 2, sides: 6, diameter: 240, height: 280, taper: 120, aspect: 165, lean: 0, rim: 1, ridge: 25 },
    { section: 1, sides: 8, diameter: 240, height: 280, taper: 90, aspect: 80, lean: -12, rim: 2, ridge: 25 },
    { section: 3, sides: 5, diameter: 240, height: 280, taper: 85, aspect: 110, lean: 0, rim: 1, ridge: 25 },
  ].entries()) {
    const model = makeBody({ ...defaultBody, ...p }, defaultExposure, { ...defaultDecoration, ornament: (['wing', 'horn', 'bolt'] as const)[index], height: 100, angle: index === 0 ? 80 : 45, span: 75, layout: 'pair', offset: 1, windows: (['slash', 'chevron', 'visor'] as const)[index], windowSize: 45, windowAngle: index === 0 ? 30 : 0 });
    assert.ok(model.geometryValid, `${JSON.stringify(p)}: ${model.exposure.reason} components ${model.exposure.net.length}`); assert.ok(model.fits); assert.equal(model.exposure.net.length, 1);
    silhouettes.add(JSON.stringify(model.faces.map(f => f.solid)));
  }
  assert.equal(silhouettes.size, 3);
  assert.equal(makeBody({ ...defaultBody, height: 200, rim: 2, ridge: 40 }).fits, false);
});
