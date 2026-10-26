import assert from 'node:assert/strict';
import { test } from 'node:test';
import { microcontrollerPreset, readMicrocontrollerSettings, setMicrocontrollerSettings, getMicrocontrollerSettings, microcontrollerChanges } from '../src/robot/physical/microcontroller';
import { validateBleSettings, nordicUart } from '../src/robot/physical/transport';

test('board presets keep micro:bit directions distinct from Arduino Nordic UART firmware', () => {
  const microbit = microcontrollerPreset('microbit'), arduino = microcontrollerPreset('nano33ble');
  assert.equal(microbit.ble.write, arduino.ble.notify);
  assert.equal(microbit.ble.swapUart, true); assert.equal(arduino.ble.swapUart, undefined);
  assert.equal(arduino.ble.namePrefix, undefined);
  for (const board of ['nano33iot', 'mkrwifi1010']) assert.deepEqual(microcontrollerPreset(board).ble, nordicUart);
  arduino.ble.write = 'changed'; assert.deepEqual(microcontrollerPreset('nano33ble').ble, nordicUart);
});

test('saved board settings validate and recover from missing, corrupt or unsupported profiles', () => {
  for (const value of [null, '{broken', JSON.stringify({ board: 'old', ble: nordicUart }), JSON.stringify({ board: 'custom' })]) {
    assert.equal(readMicrocontrollerSettings({ getItem: () => value }).board, 'microbit');
  }
  const settings = { board: 'custom', ble: { ...nordicUart, service: 'FFE0', write: 'FFE1', notify: '', chunkSize: 8, writeMode: 'without-response' } };
  const saved = readMicrocontrollerSettings({ getItem: () => JSON.stringify(settings) });
  assert.equal(saved.ble.service, '0000ffe0-0000-1000-8000-00805f9b34fb');
  assert.equal(saved.ble.notify, ''); assert.equal(saved.ble.chunkSize, 8);
  assert.equal(readMicrocontrollerSettings({ getItem() { throw new Error('denied'); } }).board, 'microbit');
});

test('setting changes publish once, preserve validated session settings and reject invalid edits', () => {
  let changes = 0; const listener = () => changes++;
  microcontrollerChanges.addEventListener('change', listener);
  try {
    const selected = microcontrollerPreset('nano33ble'); setMicrocontrollerSettings(selected); setMicrocontrollerSettings(selected);
    assert.equal(changes, 1); assert.deepEqual(getMicrocontrollerSettings(), selected);
    const copy = getMicrocontrollerSettings(); copy.ble.write = 'bad'; assert.notEqual(getMicrocontrollerSettings().ble.write, 'bad');
    assert.throws(() => setMicrocontrollerSettings(copy), /UUID/);
    assert.equal(changes, 1); assert.deepEqual(getMicrocontrollerSettings(), selected);
  } finally { microcontrollerChanges.removeEventListener('change', listener); setMicrocontrollerSettings(microcontrollerPreset('microbit')); }
});

test('BLE settings handle short UUIDs and reject invalid packet limits and write modes', () => {
  for (const chunkSize of [0, -1, 1.5, NaN, 513]) assert.throws(() => validateBleSettings({ ...nordicUart, chunkSize }), /Packet size/);
  assert.throws(() => validateBleSettings({ ...nordicUart, writeMode: 'bad' as never }), /write mode/);
  assert.equal(validateBleSettings({ ...nordicUart, write: '12345678' }).write, '12345678-0000-1000-8000-00805f9b34fb');
});
