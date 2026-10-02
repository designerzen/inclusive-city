import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMotionPreference, defaultAccessibility, normalizeAccessibility, savedAccessibility } from '../src/app/accessibilityPreferences';

test('saved accessibility choices accept supported values and recover from invalid data', () => {
  assert.deepEqual(normalizeAccessibility({ textSize: 200, typeface: 'verdana', textSpacing: 'spacious', motion: 'reduce' }),
    { textSize: 200, typeface: 'verdana', textSpacing: 'spacious', motion: 'reduce' });
  for (const value of [null, [], 'large', { textSize: -1, typeface: '__proto__', textSpacing: true, motion: 'animate' }]) {
    assert.deepEqual(normalizeAccessibility(value), defaultAccessibility);
  }
  assert.deepEqual(normalizeAccessibility({ textSize: 150 }), { ...defaultAccessibility, textSize: 150 });
  assert.deepEqual(savedAccessibility(), defaultAccessibility, 'unavailable browser storage falls back safely');
});

test('motion changes are live, follow the device, and never override its reduced-motion request', () => {
  const device = Object.assign(new EventTarget(), { matches: false });
  const preference = createMotionPreference(device);
  let changes = 0;
  preference.addEventListener('change', () => changes++);
  assert.equal(preference.matches, false);
  preference.setReduced(true);
  assert.equal(preference.matches, true);
  preference.setReduced(true);
  assert.equal(changes, 1, 'unchanged effective preference does not restart animations');
  device.matches = true; device.dispatchEvent(new Event('change'));
  preference.setReduced(false);
  assert.equal(preference.matches, true, 'device reduction still applies after reset');
  device.matches = false; device.dispatchEvent(new Event('change'));
  assert.equal(preference.matches, false);
  assert.equal(changes, 2);
});
