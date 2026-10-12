import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readZebraPairs } from '../src/app/zebraPreferences';

test('zebra pair preferences default to four and retain saved quantities up to twelve', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let saved: string | null = null;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => saved } });
  try {
    assert.equal(readZebraPairs(), 4);
    for (let count = 0; count <= 12; count++) {
      saved = String(count);
      assert.equal(readZebraPairs(), count);
    }
    saved = '99'; assert.equal(readZebraPairs(), 12);
    saved = 'invalid'; assert.equal(readZebraPairs(), 4);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
