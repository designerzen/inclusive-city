import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';
import { journeyFace, MicrobitFace, faceMessageFrames, faceMessageText, type FaceCode } from '../src/robot/microbitFace';
import type { RobotTransport } from '../src/robot/physical/transport';

const codes: FaceCode[] = ['R', 'M', 'B', 'P', 'W', 'H', 'I', 'T', 'F', 'E'];
function board() {
  const handlers: Record<string, () => void> = {}, loops: (() => void)[] = [], sent: string[] = [];
  let input = '', time = 0;
  let duringScroll: (() => void) | undefined;
  let duringTone: (() => void) | undefined;
  const scrolled: string[] = [], mouths: boolean[][] = [];
  const notes: { frequency: number; ms: number }[] = [];
  let soundStops = 0, volume = -1;
  let stops = 0;
  const pixels = Array<boolean>(25).fill(false);
  const context = vm.createContext({
    Math: { idiv: (a: number, b: number) => Math.floor(a / b) },
    basic: {
      clearScreen() { pixels.fill(false); },
      pause(ms: number) { if (ms === 120) mouths.push([...pixels]); },
      showString(text: string) { scrolled.push(text); pixels.fill(false); const callback = duringScroll; duringScroll = undefined; callback?.(); },
      forever(fn: () => void) { loops.push(fn); },
    },
    led: { plot(x: number, y: number) { pixels[y * 5 + x] = true; }, stopAnimation() { stops++; } },
    input: { runningTime: () => time, onButtonPressed(button: string, handler: () => void) { handlers[button] = handler; } },
    Button: { A: 'A', B: 'B', AB: 'AB' },
    music: {
      setVolume(value: number) { volume = value; },
      stopAllSounds() { soundStops++; },
      playTone(frequency: number, ms: number) { notes.push({ frequency, ms }); const callback = duringTone; duringTone = undefined; callback?.(); },
    },
    serial: { delimiters: () => '\n' }, Delimiters: { NewLine: 0 },
    bluetooth: {
      startUartService() {},
      onBluetoothConnected(fn: () => void) { handlers.connect = fn; },
      onBluetoothDisconnected(fn: () => void) { handlers.disconnect = fn; },
      onUartDataReceived(_: string, fn: () => void) { handlers.receive = fn; },
      uartReadUntil: () => input,
      uartWriteString(frame: string) { sent.push(frame); },
    },
  });
  vm.runInContext(stripTypeScriptTypes(readFileSync(new URL('../hardware/microbit/city-face/main.ts', import.meta.url), 'utf8')), context);
  return {
    pixels, sent, scrolled, mouths, notes,
    get volume() { return volume; }, get soundStops() { return soundStops; },
    onTone(callback: () => void) { duringTone = callback; },
    pressB() { handlers.B(); },
    pressA() { handlers.A(); },
    pressAB() { handlers.AB(); },
    get stops() { return stops; },
    onScroll(callback: () => void) { duringScroll = callback; },
    connect: () => handlers.connect(), disconnect: () => handlers.disconnect(),
    receive(frame: string) { input = frame; handlers.receive(); },
    tick(ms = 0) { time += ms; for (let i = 0; i < 12; i++) loops.forEach(loop => loop()); },
    flush(ms = 0) { time += ms; for (let i = 0; i < 12; i++) loops[0](); },
    audio() { loops[1](); },
    display() { loops[2](); },
  };
}

test('journey expressions follow real state precedence, including pause at a barrier', () => {
  const state = { complete: false, ready: false, blocked: null, paused: false, waiting: false };
  assert.equal(journeyFace(), 'I'); assert.equal(journeyFace(state), 'M');
  assert.equal(journeyFace({ ...state, waiting: true }), 'W');
  assert.equal(journeyFace({ ...state, waiting: true, paused: true }), 'P');
  assert.equal(journeyFace({ ...state, blocked: {}, paused: true }), 'B');
  assert.equal(journeyFace({ ...state, ready: true }), 'R');
  assert.equal(journeyFace({ ...state, complete: true, paused: true }), 'E');
  for (const [mood, code] of [['curious', 'M'], ['sad', 'B'], ['happy', 'H'], ['celebrating', 'E'], ['tired', 'T'], ['frustrated', 'F']] as const)
    assert.equal(journeyFace({ ...state, mood }), code);
  assert.equal(journeyFace({ ...state, blocked: {}, mood: 'frustrated' }), 'F');
});

test('actual firmware boots ready to pair, renders distinct expressions and recovers after stale data/reboot', () => {
  const b = board(), pairing = [...b.pixels], expressions = new Set<string>();
  assert.ok(pairing.some(Boolean)); b.connect();
  b.receive('HELLO'); b.tick(); assert.equal(b.sent.at(-1), 'CITYFACE:3\n');
  for (const code of codes) {
    b.receive(`FACE:${code}`); b.tick(); assert.equal(b.sent.at(-1), `ACK:${code}\n`);
    expressions.add(b.pixels.map(Number).join(''));
  }
  assert.equal(expressions.size, codes.length);
  const last = [...b.pixels];
  for (const bad of ['FACE:X', 'FACE:', 'FACE:MM', 'CMD:0', 'FACE:m']) {
    b.receive(bad); b.tick(); assert.equal(b.sent.at(-1), 'ERR:FRAME\n'); assert.deepEqual(b.pixels, last);
  }
  b.tick(4000); assert.deepEqual(b.pixels, last);
  b.receive('FACE:E'); b.tick(2000); assert.deepEqual(b.pixels, last);
  b.tick(3001); assert.deepEqual(b.pixels, pairing);
  b.receive('FACE:M'); b.tick(); assert.notDeepEqual(b.pixels, pairing);
  b.disconnect(); assert.deepEqual(b.pixels, pairing);
  b.connect(); assert.deepEqual(b.pixels, pairing);
});

function transport() {
  const sent: string[] = [];
  const t: RobotTransport = { id: 'test', name: 'Test microbit', onData() {}, onDisconnect() {},
    async send(data) { sent.push(new TextDecoder().decode(data)); }, disconnect() {} };
  return { t, sent, receive(text: string) { t.onData(new TextEncoder().encode(text)); } };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test('browser verifies firmware, handles split replies, coalesces state changes and sends heartbeats', async () => {
  const t = transport(), face = new MicrobitFace(t.t, assert.fail);
  try {
    face.update('M', 0); assert.deepEqual(t.sent, []);
    const started = face.start(); assert.deepEqual(t.sent, ['HELLO\n']);
    t.receive('CITY'); t.receive('FACE:2\n'); await started;
    face.update('M', 1000); face.update('W', 1100); face.update('B', 1200);
    assert.deepEqual(t.sent, ['HELLO\n', 'FACE:M\n']);
    t.receive('ACK:R\n'); await settle(); assert.equal(t.sent.length, 2);
    t.receive('ACK:M\n'); await settle(); assert.equal(t.sent.at(-1), 'FACE:B\n');
    t.receive('ACK:B\n'); await settle();
    face.update('B', Date.now() + 2000); assert.equal(t.sent.at(-1), 'FACE:B\n'); assert.equal(t.sent.length, 4);
    t.receive('ACK:B\n'); await settle();
  } finally { face.disconnect(); }
});

test('wrong firmware, ACK timeout, device loss and disconnect reject cleanly', async () => {
  const t = transport(), errors: string[] = [], face = new MicrobitFace(t.t, reason => errors.push(reason));
  const started = face.start(); t.receive('ERR:FRAME\n');
  await assert.rejects(started); assert.match(errors[0]!, /rejected/);
  const other = transport(), f = new MicrobitFace(other.t, reason => errors.push(reason));
  const ready = f.start(); other.receive('CITYFACE:2\n'); await ready;
  f.update('R'); await new Promise(resolve => setTimeout(resolve, 3100));
  assert.match(errors.at(-1)!, /No face response/);
  const lost = transport(), l = new MicrobitFace(lost.t, reason => errors.push(reason));
  const pending = l.start(); lost.t.onDisconnect('Board lost power');
  await assert.rejects(pending); assert.equal(errors.at(-1), 'Board lost power');
});

test('message encoding preserves punctuation, bounds text, and keeps every frame within 20 bytes', () => {
  assert.equal(faceMessageText('Héllo, “robot”!\nI’m waiting… 🤖'), 'Hello, "robot"! I\'m waiting...');
  assert.equal(faceMessageText('a'.repeat(300)).length, 240);
  assert.deepEqual(faceMessageFrames('🤖', 1), []);
  const frames = faceMessageFrames('The curb is too high.\nI need a ramp.', 42);
  assert.equal(frames[0].frame, 'SAY:002A\n'); assert.equal(frames.at(-1)!.frame, 'END:002A\n');
  assert.ok(frames.every(packet => new TextEncoder().encode(packet.frame).length <= 20));
  assert.equal(frames.slice(1, -1).map(packet => packet.frame.slice(12, -1)).join(''), 'The curb is too high. I need a ramp.');
});

test('actual firmware animates its mouth, scrolls the robot words once, then restores the latest mood', () => {
  const b = board(); b.connect(); b.receive('FACE:B'); b.flush(); const sad = [...b.pixels];
  for (const packet of faceMessageFrames('The curb is too high.', 1)) {
    b.receive(packet.frame.slice(0, -1)); b.flush(); assert.equal(b.sent.at(-1), packet.reply + '\n');
  }
  assert.deepEqual(b.scrolled, []);
  b.onScroll(() => { b.receive('FACE:F'); b.flush(); }); b.display();
  assert.deepEqual(b.scrolled, ['The curb is too high.']); assert.equal(b.mouths.length, 6);
  assert.notDeepEqual(b.mouths[0], b.mouths[1]); assert.notDeepEqual(b.pixels, sad);
  const frustrated = [...b.pixels]; b.receive('FACE:F'); b.tick();
  assert.deepEqual(b.pixels, frustrated); assert.equal(b.scrolled.length, 1);
});

test('new speech, STOP, disconnect and heartbeat loss interrupt stale text without restoring old pixels', () => {
  const b = board(); const pairing = [...b.pixels]; b.connect(); b.receive('FACE:M'); b.flush();
  const send = (text: string, id: number) => { for (const p of faceMessageFrames(text, id)) { b.receive(p.frame.slice(0, -1)); b.flush(); } };
  send('Old message', 1);
  b.onScroll(() => { send('New alert', 2); b.receive('FACE:B'); b.flush(); }); b.display(); b.display();
  assert.deepEqual(b.scrolled, ['Old message', 'New alert']);
  send('Cancelled', 3); b.receive('STOP'); b.flush(); b.display(); assert.equal(b.scrolled.length, 2);
  send('Disconnect', 4); b.onScroll(() => b.disconnect()); b.display(); assert.deepEqual(b.pixels, pairing);
  b.connect(); b.receive('FACE:M'); b.flush(); send('Stale', 5);
  b.onScroll(() => b.flush(5001)); b.display(); assert.deepEqual(b.pixels, pairing);
  assert.ok(b.stops >= 6);
});

test('firmware rejects wrong message IDs, out-of-order chunks, oversized payloads and incomplete commits', () => {
  const b = board(); b.connect();
  for (const invalid of ['SAY:zzzz', 'END:0001', 'TXT:0001:00:hello']) {
    b.receive(invalid); b.flush(); assert.equal(b.sent.at(-1), 'ERR:FRAME\n');
  }
  b.receive('SAY:0001'); b.flush();
  for (const invalid of ['TXT:0002:00:hello', 'TXT:0001:01:hello', 'TXT:0001:00:12345678', 'TXT:0001:00:', 'TXT:0001:00:hi\x01']) {
    b.receive(invalid); b.flush(); assert.equal(b.sent.at(-1), 'ERR:FRAME\n');
  }
  b.receive('END:0001'); b.flush(); assert.equal(b.sent.at(-1), 'ERR:FRAME\n');
  for (const p of faceMessageFrames('x'.repeat(240), 2).slice(0, -1)) { b.receive(p.frame.slice(0, -1)); b.flush(); }
  b.receive('TXT:0002:23:x'); b.flush(); assert.equal(b.sent.at(-1), 'ERR:FRAME\n');
  b.receive('END:0002'); b.flush(); b.display(); assert.equal(b.scrolled.at(-1)!.length, 240);
});

test('browser cancels an in-flight message before sending a newer alert and never repeats identical speech', async () => {
  const t = transport(), f = new MicrobitFace(t.t, assert.fail);
  try {
    const started = f.start(); t.receive('CITYFACE:2\n'); await started;
    f.update('M', 1000, { id: 'old', text: 'An old message.' });
    t.receive('ACK:M\n'); await settle(); assert.equal(t.sent.at(-1), 'SAY:0001\n');
    t.receive('SAY:0001\n'); await settle(); assert.match(t.sent.at(-1)!, /^TXT:0001:00:/);
    f.update('B', 1100, { id: 'barrier', text: 'A wall.' });
    t.receive('TXT:0001:00\n'); await settle(); assert.equal(t.sent.at(-1), 'STOP\n');
    t.receive('STOP\n'); await settle(); assert.equal(t.sent.at(-1), 'FACE:B\n');
    t.receive('ACK:B\n'); await settle(); assert.equal(t.sent.at(-1), 'SAY:0002\n');
    t.receive('SAY:0002\n'); await settle(); assert.equal(t.sent.at(-1), 'TXT:0002:00:A wall.\n');
    t.receive('TXT:0001:00\n'); await settle(); assert.equal(t.sent.at(-1), 'TXT:0002:00:A wall.\n');
    t.receive('TXT:0002:00\n'); await settle(); assert.equal(t.sent.at(-1), 'END:0002\n');
    t.receive('END:0002\n'); await settle();
    const count = t.sent.length; f.update('B', 1200, { id: 'barrier', text: 'A wall.' }); await settle(); assert.equal(t.sent.length, count);
    f.update('I', 1300); assert.equal(t.sent.at(-1), 'STOP\n');
    t.receive('STOP\n'); await settle(); t.receive('ACK:I\n'); await settle();
    assert.equal(t.sent.at(-1), 'FACE:I\n');
  } finally { f.disconnect(); }
});

test('browser session and actual firmware exchange a complete multi-packet city alert end to end', async () => {
  const b = board(); b.connect(); let cursor = 0;
  const t: RobotTransport = { id: 'board', name: 'Firmware harness', onData() {}, onDisconnect() {}, disconnect() { b.disconnect(); },
    async send(data) {
      const frame = new TextDecoder().decode(data);
      assert.ok(data.length <= 20);
      b.receive(frame.slice(0, -1)); b.flush();
      while (cursor < b.sent.length) t.onData(new TextEncoder().encode(b.sent[cursor++]));
    } };
  const f = new MicrobitFace(t, assert.fail), text = 'The green light does not last long enough to cross.';
  try {
    await f.start(); f.update('B', 1000, { id: 'crossing-alert', text }); await settle();
    b.display(); assert.deepEqual(b.scrolled, [text]); assert.equal(b.mouths.length, 6);
    f.update('F', 1100, { id: 'crossing-alert', text }); await settle(); b.display();
    assert.equal(b.scrolled.length, 1);
    f.update('M', 1200, { id: 'access-improved', text: 'City changed. Your robot can continue.' }); await settle(); b.display();
    assert.equal(b.scrolled.at(-1), 'City changed. Your robot can continue.');
    f.update('I', 1300); await settle(); b.display(); assert.equal(b.scrolled.length, 2);
  } finally { f.disconnect(); }
});

test('speaker cues are brief, follow mood changes and messages, and do not repeat on heartbeats', () => {
  const b = board(); assert.equal(b.volume, 64); b.tick(); assert.deepEqual(b.notes, []);
  b.connect(); b.receive('FACE:B'); b.flush(); b.audio();
  assert.deepEqual(b.notes.map(note => note.frequency), [392, 330, 262]);
  b.receive('FACE:B'); b.tick(); assert.equal(b.notes.length, 3);
  b.receive('FACE:E'); b.flush(); b.audio();
  assert.deepEqual(b.notes.slice(-4).map(note => note.frequency), [523, 659, 784, 1047]);
  for (const p of faceMessageFrames('Hello!', 1)) { b.receive(p.frame.slice(0, -1)); b.flush(); }
  b.audio(); b.display();
  assert.deepEqual(b.notes.slice(-3).map(note => note.frequency), [523, 659, 587]);
  assert.deepEqual(b.scrolled, ['Hello!']); assert.equal(b.mouths.length, 6);
  assert.ok(b.notes.every(note => note.ms === 70));
});

test('A+B mutes only musical notes, and STOP/disconnect/watchdog interrupt a tune', () => {
  const b = board(); b.connect(); b.receive('FACE:E'); b.flush();
  b.pressAB(); b.audio(); assert.equal(b.notes.length, 0);
  for (const p of faceMessageFrames('Still speaking', 1)) { b.receive(p.frame.slice(0, -1)); b.flush(); }
  b.audio(); b.display(); assert.deepEqual(b.scrolled, ['Still speaking']); assert.equal(b.notes.length, 0);
  b.pressAB(); b.audio(); assert.equal(b.notes.length, 4);
  for (const interrupt of [() => b.receive('STOP'), () => b.disconnect(), () => b.flush(5001)]) {
    b.connect(); b.receive('FACE:E'); b.flush(); const before = b.notes.length;
    b.onTone(interrupt); b.audio(); assert.equal(b.notes.length, before + 1);
    b.audio(); assert.equal(b.notes.length, before + 1);
  }
  assert.ok(b.soundStops > 0);
});

test('board buttons request fix/repeat only in a live city session, including during scrolling', () => {
  const b = board(); b.pressA(); b.pressB(); b.flush(); assert.deepEqual(b.sent, []);
  b.connect(); b.pressA(); b.pressB(); b.flush(); assert.deepEqual(b.sent, []);
  b.receive('FACE:B'); b.flush();
  for (const p of faceMessageFrames('The curb is too high.', 1)) { b.receive(p.frame.trimEnd()); b.flush(); }
  b.onScroll(() => { b.pressA(); b.pressB(); b.flush(); }); b.display();
  assert.deepEqual(b.sent.slice(-2), ['BTN:A\n', 'BTN:B\n']);
  const count = b.sent.length;
  b.receive('FACE:I'); b.flush(); b.pressA(); b.pressB(); b.flush(); assert.equal(b.sent.length, count + 1);
  b.receive('FACE:B'); b.flush(5001); const stale = b.sent.length;
  b.pressA(); b.pressB(); b.flush(); assert.equal(b.sent.length, stale);
});

test('movement phrases vary, are spaced apart, and stop immediately on pause, idle or mute', () => {
  const b = board(); b.connect(); b.receive('FACE:H'); b.flush(); b.audio();
  b.receive('RUN:1'); b.flush(); const start = b.notes.length; b.audio();
  const first = b.notes.slice(start).map(n => n.frequency); assert.equal(first.length, 4);
  b.audio(); assert.equal(b.notes.length, start + 4);
  b.flush(2400); b.audio(); assert.notDeepEqual(b.notes.slice(-4).map(n => n.frequency), first);
  b.flush(2400); const before = b.notes.length;
  b.onTone(() => { b.receive('RUN:0'); b.flush(); }); b.audio();
  assert.equal(b.notes.length, before + 1);
  b.flush(2400); b.audio(); assert.equal(b.notes.length, before + 1);
  b.receive('RUN:1'); b.flush(); b.pressAB(); b.audio(); assert.equal(b.notes.length, before + 1);
  b.receive('FACE:I'); b.flush(); b.pressAB(); b.audio(); assert.equal(b.notes.length, before + 1);
});

test('v3 board buttons reach the browser during ACKs and replay identical issue text with a new identity', async () => {
  const b = board(); b.connect(); let cursor = 0, repeats = 0, fixes = 0;
  const text = 'The curb is too high.';
  const drain = () => { while (cursor < b.sent.length) t.onData(new TextEncoder().encode(b.sent[cursor++])); };
  const t: RobotTransport = { id: 'board', name: 'Firmware harness', onData() {}, onDisconnect() {}, disconnect() { b.disconnect(); },
    async send(data) { b.receive(new TextDecoder().decode(data).slice(0, -1)); b.flush(); drain(); } };
  const f = new MicrobitFace(t, assert.fail, action => {
    if (action === 'repeat') f.update('B', 1100, { id: `repeat:${++repeats}`, text });
    else { fixes++; f.update('M', 1200, undefined, true); }
  });
  try {
    await f.start(); f.update('B', 1000, { id: 'barrier', text }); await settle(); b.display();
    b.pressB(); b.flush(); drain(); await settle(); b.display();
    assert.equal(repeats, 1); assert.deepEqual(b.scrolled, [text, text]);
    b.pressA(); b.flush(); drain(); await settle(); assert.equal(fixes, 1);
    b.audio(); assert.ok(b.notes.length > 0);
    f.update('I', 1300); await settle(); const count = b.notes.length; b.audio(); assert.equal(b.notes.length, count);
    // Ignore unsolicited, malformed and post-disconnect input; never treat buttons as an ACK.
    t.onData(new TextEncoder().encode('BTN:A\nBTN:X\n')); assert.equal(fixes, 1);
    f.disconnect(); t.onData(new TextEncoder().encode('BTN:B\n')); assert.equal(repeats, 1);
  } finally { f.disconnect(); }
});

test('button events do not consume an in-flight ACK and older v2 firmware receives no RUN commands', async () => {
  const t = transport(), actions: string[] = [], f = new MicrobitFace(t.t, assert.fail, action => actions.push(action));
  try {
    t.receive('BTN:A\n'); assert.deepEqual(actions, []);
    const started = f.start(); t.receive('CITYFACE:2\n'); await started;
    f.update('M', 1000, undefined, true);
    t.receive('BTN:B\n'); await settle(); assert.deepEqual(actions, ['repeat']);
    assert.equal(t.sent.at(-1), 'FACE:M\n');
    t.receive('ACK:M\n'); await settle(); assert.equal(t.sent.length, 2);
  } finally { f.disconnect(); }
});
