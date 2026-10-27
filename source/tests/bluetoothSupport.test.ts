import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bluetoothUnavailableReason } from '../src/robot/physical/transport';

test('Bluetooth warnings distinguish insecure pages from missing browser support', t => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  t.after(() => {
    for (const [key, descriptor] of [['window', originalWindow], ['navigator', originalNavigator]] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  const context = { isSecureContext: true };
  const browser: { bluetooth?: object } = {};
  Object.defineProperty(globalThis, 'window', { configurable: true, value: context });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: browser });

  const unsupported = bluetoothUnavailableReason();
  assert.match(unsupported!, /Web Bluetooth is unavailable in this browser/);
  assert.match(unsupported!, /^Warning:/);
  assert.match(unsupported!, /Google Chrome or Microsoft Edge on Windows or macOS/);
  assert.match(unsupported!, /Google Chrome on Android or ChromeOS/);
  assert.match(unsupported!, /Chrome and Edge on iPhone or iPad do not support Web Bluetooth/);
  assert.doesNotMatch(unsupported!, /HTTPS|localhost|secure context/);

  browser.bluetooth = {};
  assert.equal(bluetoothUnavailableReason(), undefined);

  context.isSecureContext = false;
  assert.match(bluetoothUnavailableReason()!, /secure context.*HTTPS or localhost/);
  delete browser.bluetooth;
  assert.match(bluetoothUnavailableReason()!, /secure context.*HTTPS or localhost/);
});
