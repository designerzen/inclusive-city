import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { stripTypeScriptTypes } from 'node:module';
import { CommsDecoder, commsMessages, encodeCommand, messagePixels, parseCommsFrame } from '../src/robot/commsProtocol';

test('all 16 command codes round trip and invalid codes/frames are rejected', () => {
  for (let code = 0; code < 16; code++) {
    assert.deepEqual(parseCommsFrame(encodeCommand(code).trim()), { kind: 'CMD', code });
    assert.deepEqual(parseCommsFrame(`SIG:${code.toString(16).toUpperCase()}`), { kind: 'SIG', code });
  }
  for (const code of [-1, 16, 1.5, NaN]) assert.throws(() => encodeCommand(code));
  for (const frame of ['CMD:10', 'SIG:a', 'ACK:-1', 'AUTO:2', 'CMD:0 extra']) assert.equal(parseCommsFrame(frame), undefined);
});

test('decoder handles arbitrary notification boundaries, CRLF and oversized input recovery', () => {
  const decoder = new CommsDecoder(), bytes = new TextEncoder();
  assert.deepEqual(decoder.accept(bytes.encode('SI')), []);
  assert.deepEqual(decoder.accept(bytes.encode('G:F\r\nACK:0\nSIG:')), ['SIG:F', 'ACK:0']);
  assert.deepEqual(decoder.accept(bytes.encode('A\n')), ['SIG:A']);
  assert.deepEqual(decoder.accept(bytes.encode('x'.repeat(1000) + '\nSIG:1\n')), ['SIG:1']);
  assert.deepEqual(decoder.accept(new Uint8Array([255, 10, ...bytes.encode('SIG:2\n')])), ['SIG:2']);
});

function firmware() {
  const source = readFileSync(new URL('../public/firmware/robot-comms/main.ts', import.meta.url), 'utf8');
  const handlers: Record<string, () => void> = {}, loops: (() => void)[] = [], sent: string[] = [];
  let frame = '', time = 0, pixels = Array<boolean>(25).fill(false);
  const context = vm.createContext({
    bluetooth: {
      onBluetoothConnected: (fn: () => void) => { handlers.connect = fn; },
      onBluetoothDisconnected: (fn: () => void) => { handlers.disconnect = fn; },
      onUartDataReceived: (_: string, fn: () => void) => { handlers.receive = fn; },
      uartReadUntil: () => frame, uartWriteString: (s: string) => sent.push(s), startUartService() {},
    },
    basic: { clearScreen: () => { pixels.fill(false); }, showIcon() {}, pause() {}, forever: (fn: () => void) => loops.push(fn) },
    led: { plot: (x: number, y: number) => { pixels[y * 5 + x] = true; } },
    input: { onButtonPressed: (button: string, fn: () => void) => { handlers[button] = fn; }, runningTime: () => time },
    serial: { delimiters: () => '\n' }, Delimiters: { NewLine: 0 },
    Button: { A: 'A', B: 'B', AB: 'AB' }, IconNames: { No: 0 }, randint: () => 15,
  });
  vm.runInContext(stripTypeScriptTypes(source), context);
  return {
    press: (button: string) => handlers[button]!(),
    receive(text: string) { frame = text; handlers.receive!(); },
    tick(ms = 0) { time += ms; loops[1]!(); for (let i = 0; i < 20; i++) loops[0]!(); },
    get pixels() { return pixels; }, sent,
    labels: () => JSON.parse(vm.runInContext('JSON.stringify(messages)', context)),
  };
}

test('actual firmware source acknowledges all 16 commands, matches LED preview and sends selection via B', () => {
  const board = firmware(); board.press('connect');
  assert.deepEqual(board.labels(), [...commsMessages]);
  for (let code = 0; code < 16; code++) {
    board.receive(encodeCommand(code).trim()); board.tick();
    assert.equal(board.sent.at(-1), `ACK:${code.toString(16).toUpperCase()}\n`);
    assert.deepEqual(board.pixels, messagePixels(code));
    board.press('B'); board.tick(); assert.equal(board.sent.at(-1), `SIG:${code.toString(16).toUpperCase()}\n`);
  }
  board.press('A'); board.press('B'); board.tick(); assert.equal(board.sent.at(-1), 'SIG:0\n');
  board.receive('CMD:Z'); board.tick(); assert.equal(board.sent.at(-1), 'ERR:FRAME\n');
});

test('firmware demo is explicit, stops on disconnect, and supports page and A+B controls', () => {
  const board = firmware(); board.press('connect'); board.tick(16000); assert.equal(board.sent.length, 0);
  board.receive('AUTO:1'); board.tick(); assert.equal(board.sent.at(-1), 'AUTO:1\n');
  board.tick(8000); assert.equal(board.sent.at(-1), 'SIG:F\n');
  board.press('AB'); board.tick(); assert.equal(board.sent.at(-1), 'AUTO:0\n');
  const count = board.sent.length; board.tick(16000); assert.equal(board.sent.length, count);
  board.receive('AUTO:1'); board.tick(); board.press('disconnect'); board.press('B'); board.tick(8000);
  const afterDisconnect = board.sent.length; board.press('connect'); board.tick(16000); assert.equal(board.sent.length, afterDisconnect);
});
