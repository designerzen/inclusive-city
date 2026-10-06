import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { routeCurve } from '../src/city/routeCurve';

const point = (x: number, z: number) => new Vector3(x, .19, z);

test('right-angle turns become smooth tangent bends with preserved endpoints', () => {
  const stops = [point(0, 0), point(8, 0), point(8, 8)];
  const curve = routeCurve(stops);
  assert.deepEqual(curve[0], stops[0]);
  assert.deepEqual(curve.at(-1), stops.at(-1));
  assert.ok(curve.length > 50);
  assert.ok(!curve.some(p => p.equals(stops[1]!)), 'no sharp vertex at the old corner');
  assert.ok(curve[1]!.x < 4.1, 'an eight-metre street starts bending almost four metres before the turn');
  assert.ok(curve.at(-2)!.z > 3.9, 'the sweep continues almost four metres beyond the turn');
  for (let i = 1; i < curve.length - 1; i++) {
    const a = curve[i]!.subtract(curve[i - 1]!).normalize();
    const b = curve[i + 1]!.subtract(curve[i]!).normalize();
    assert.ok(Math.acos(Math.min(1, Vector3.Dot(a, b))) < Math.PI / 90, 'neighbouring segments turn by less than two degrees');
  }
  assert.ok(curve.every(p => p.y === .19 || Math.abs(p.y - .19) < 1e-12));
  assert.deepEqual(stops, [point(0, 0), point(8, 0), point(8, 8)], 'rendering leaves logical stops unchanged');
});

test('successive short corners do not overlap or cross', () => {
  const curve = routeCurve([point(0, 0), point(1, 0), point(1, 1), point(2, 1)], 5);
  for (let i = 1; i < curve.length; i++) {
    assert.ok(curve[i]!.x >= curve[i - 1]!.x - 1e-10);
    assert.ok(curve[i]!.z >= curve[i - 1]!.z - 1e-10);
    assert.ok(Vector3.Distance(curve[i]!, curve[i - 1]!) > 1e-8, 'no zero-length tube segments');
  }
});

test('revisited dots and retraced edges do not draw intersecting tubes', () => {
  const curve = routeCurve([point(0, 0), point(8, 0), point(8, 8), point(0, 8), point(0, 0), point(-8, 0)]);
  assert.deepEqual(curve, [point(0, 0), point(-8, 0)]);
  assert.deepEqual(routeCurve([point(0, 0), point(8, 0), point(0, 0)]), [point(0, 0)]);
});

test('empty, single-dot and straight routes remain valid', () => {
  assert.deepEqual(routeCurve([]), []);
  assert.deepEqual(routeCurve([point(0, 0), point(0, 0)]), [point(0, 0)]);
  const straight = [point(0, 0), point(4, 0), point(8, 0)];
  assert.deepEqual(routeCurve(straight), [straight[0], straight[2]]);
});

test('straight intermediate dots and short platform offsets cannot force tight bends', () => {
  const curve = routeCurve([point(0, 0), point(7, 0), point(8, 0), point(8, 8), point(8, 16)]);
  assert.ok(curve[1]!.x < 4.1, 'the last one-metre straight segment does not constrain the corner');
  const train = routeCurve([point(0, 0), point(8, 0), point(8, 2.6), point(20, -2.6), point(20, 0), point(28, 0)]);
  assert.ok(train.every(p => p.z >= -1.3 - 1e-8 && p.z <= 1.3 + 1e-8), 'small station zigzags blend into the wide approach curve');
});
