import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { MultiPolygon } from 'polygon-clipping';
import { narrowMaterial, checkBodyStructure } from '../src/robot/bodyStructure';
import { defaultBody, makeBody } from '../src/robot/bodyNet';
import { defaultDecoration } from '../src/robot/bodyDecoration';
import { defaultExposure } from '../src/robot/bodyExposure';

const box = (x: number, y: number, w: number, h: number): [number, number][] => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];

test('structural bridge checks use retained card, distinguish slot waste and catch thin necks', () => {
  assert.equal(narrowMaterial([[box(0, 0, 4, 100)]], 8), 4, 'a whole long narrow strip is weak even without any holes');
  assert.equal(narrowMaterial([[box(0, 0, 80, 100), box(25, 20, 1, 40)]], 8), undefined, 'a narrow hole is not a narrow bridge');
  assert.equal(narrowMaterial([[box(0, 0, 80, 100), box(4, 20, 20, 40)]], 8), 4);
  assert.equal(narrowMaterial([[box(0, 0, 80, 100), box(20, 20, 20, 40), box(44, 20, 20, 40)]], 8), 4);
  const neck: MultiPolygon = [[[[0, 0], [30, 0], [30, 20], [60, 20], [60, 0], [90, 0], [90, 50], [60, 50], [60, 24], [30, 24], [30, 50], [0, 50]]]];
  assert.equal(narrowMaterial(neck, 8), 4, 'a connected outline can still have a fragile neck');
  const angle = .73;
  const rotated = neck.map(p => p.map(r => r.map(([x, y]): [number, number] => [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)])));
  assert.ok(Math.abs(narrowMaterial(rotated, 8)! - 4) < 1e-6);
  assert.equal(narrowMaterial([[box(0, 0, 80, 100), box(10, 20, 20, 40), box(50, 20, 20, 40)]], 8), undefined);
});

test('post-cut checks block fragile hardware cutouts and pass a stronger shell without disabling sensors', () => {
  const thin = makeBody(defaultBody, defaultExposure);
  assert.equal(thin.geometryValid, true, 'the old connected-sheet check passes');
  assert.equal(thin.structure.valid, false);
  assert.equal(thin.valid, false, 'random selection and cutting exports use this gate');
  assert.match(thin.structure.reason, /bridge/);
  const strong = makeBody({ ...defaultBody, sides: 4, diameter: 240, height: 280, taper: 100, thickness: 1 }, defaultExposure);
  assert.equal(strong.valid, true, strong.structure.issues.join(' '));
  assert.deepEqual(strong.exposure.settings.enabled, thin.exposure.settings.enabled);
});

test('long loaded appendages and downstream joints require enough root width and card thickness', () => {
  const details = { ...defaultDecoration, ornament: 'wing' as const, height: 100, layout: 'pair' as const };
  const thin = makeBody({ ...defaultBody, height: 280, taper: 100 }, undefined, details);
  assert.equal(thin.geometryValid, true);
  assert.equal(thin.valid, false);
  assert.ok(thin.structure.issues.some(s => s.includes('too long or heavy')));
  const short = makeBody({ ...defaultBody, height: 280, taper: 100 }, undefined, { ...details, height: 50 });
  assert.equal(short.valid, true, short.structure.reason);
  const thick = makeBody({ ...defaultBody, height: 280, taper: 100, thickness: 1 }, undefined, details);
  assert.equal(thick.valid, true, thick.structure.reason);
  assert.ok(thick.structure.maximumFreeSpan > thin.structure.maximumFreeSpan);
});

test('small disconnected hinge fragments do not add up to one load-bearing strip', () => {
  const model = makeBody({ ...defaultBody, taper: 100 });
  const edge = model.material.bends[0].edge;
  const [a, b] = edge, axis = b.map((v, i) => v - a[i]), length = Math.hypot(...axis);
  const at = (s: number, offset: number): [number, number] => [a[0] + axis[0] * s / length - axis[1] * offset / length, a[1] + axis[1] * s / length + axis[0] * offset / length];
  // Keep 5 mm fragments separated by through-openings along the whole hinge.
  const cuts = Array.from({ length: Math.ceil(length / 10) }, (_, i) => [at(i * 10 + 5, -10), at(i * 10 + 10, -10), at(i * 10 + 10, 10), at(i * 10 + 5, 10)]);
  const structure = checkBodyStructure(model, { ...model.exposure, cuts });
  assert.equal(structure.valid, false);
  assert.ok(structure.issues.some(s => s.includes('body fold needs one continuous')));
});

test('roofs require retained supports and flat lids need stiffness across their span', () => {
  const p = { ...defaultBody, sides: 4, diameter: 240, height: 280, taper: 100, thickness: 1.2 };
  const strong = makeBody(p, defaultExposure, { ...defaultDecoration, roof: 'lid' });
  assert.equal(strong.valid, true, strong.structure.reason);
  const thin = makeBody({ ...p, thickness: .5 }, undefined, { ...defaultDecoration, roof: 'lid' });
  assert.equal(thin.geometryValid, true);
  assert.equal(thin.valid, false);
  assert.match(thin.structure.issues.join(' '), /lid span/);
  const incomplete = makeBody({ ...defaultBody, taper: 100 }, defaultExposure, { ...defaultDecoration, roof: 'lid' });
  assert.equal(incomplete.valid, false);
  assert.match(incomplete.structure.issues.join(' '), /lost a supporting section/);
});
