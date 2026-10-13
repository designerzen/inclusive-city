import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BleRobotTransport, RobotWriteQueue, microbitUart, nordicUart, validateBleSettings } from '../src/robot/physical/transport';
import type { RobotTransport } from '../src/robot/physical/transport';
import { RobotFleet, RobotSession, SensorDecoder, defaultCommands, parseSensorText } from '../src/robot/physical/session';
import { PhysicalJourney } from '../src/robot/physical/physicalJourney';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { generateCity, routeToGoal } from '../src/city/proceduralCity';

class FakeRobot implements RobotTransport {
  name = 'micro:bit robot'; onData = (_: Uint8Array) => {}; onDisconnect = (_: string) => {};
  writes: string[] = []; closed = false;
  constructor(readonly id = 'one') {}
  async send(data: Uint8Array) { this.writes.push(new TextDecoder().decode(data)); }
  disconnect() { this.closed = true; }
  receive(text: string) { this.onData(new TextEncoder().encode(text)); }
}
function journey() {
  const bot = new BotHistory(['Curie', 'Einstein'], () => 0).current, world = generateCity(42, [bot]);
  const j = new PlannedJourney(bot, world); j.enableLineFollowing(); j.setRoute(routeToGoal(world, world.start)!);
  world.nodes.find(n => n.id === world.start)!.discovery = 'music'; return j;
}
test('micro:bit and Nordic presets use the correct opposite characteristic assignments', () => {
  assert.equal(microbitUart.write, '6e400003-b5a3-f393-e0a9-e50e24dcca9e');
  assert.equal(microbitUart.notify, nordicUart.write); assert.equal(microbitUart.namePrefix, 'BBC micro:bit');
  assert.deepEqual(validateBleSettings(microbitUart), microbitUart);
  assert.throws(() => validateBleSettings({ ...microbitUart, service: 'invalid' }), /UUID/);
  assert.equal(validateBleSettings({ ...microbitUart, notify: '' }).notify, '');
});
test('BLE discovery supports micro:bit name advertising and sends raw commands in 20-byte values', async () => {
  class Char extends EventTarget {
    properties = { write: true, writeWithoutResponse: false }; value?: DataView;
    frames: Uint8Array[] = []; subscribed = false;
    async startNotifications() { this.subscribed = true; return this; }
    async writeValueWithResponse(data: Uint8Array) { this.frames.push(data.slice()); }
    async writeValueWithoutResponse(data: Uint8Array) { this.frames.push(data.slice()); }
  }
  const write = new Char(), notify = new Char(); let requested: unknown;
  const device = Object.assign(new EventTarget(), { id: 'microbit', name: 'BBC micro:bit [test]', gatt: {
    connected: true, disconnect() { this.connected = false; }, async connect() { this.connected = true; return {
      async getPrimaryService(uuid: string) { assert.equal(uuid, microbitUart.service); return {
        async getCharacteristic(uuid: string) { return uuid === microbitUart.write ? write : notify; },
      }; },
    }; },
  } });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { bluetooth: { async requestDevice(options: unknown) { requested = options; return device; } } } });
  try {
    const transport = await BleRobotTransport.connect(microbitUart);
    assert.deepEqual(requested, { filters: [{ namePrefix: 'BBC micro:bit' }], optionalServices: [microbitUart.service] });
    assert.equal(notify.subscribed, true); assert.equal(write.frames.length, 0); // No handshake or route upload.
    const command = 'SET SPEED 25;'.repeat(3) + '\n'; await transport.send(new TextEncoder().encode(command));
    assert.ok(write.frames.every(frame => frame.length <= 20));
    assert.equal(new TextDecoder().decode(Uint8Array.from(write.frames.flatMap(f => [...f]))), command);
    let received = ''; transport.onData = bytes => { received = new TextDecoder().decode(bytes); };
    const buffer = new TextEncoder().encode('xxbattery:75\nxx'); notify.value = new DataView(buffer.buffer, 2, buffer.length - 4);
    notify.dispatchEvent(new Event('characteristicvaluechanged')); assert.equal(received, 'battery:75\n');
    await assert.rejects(BleRobotTransport.connect(microbitUart, new Set(['microbit'])), /already connected/);
    assert.equal(device.gatt.connected, true);
    transport.disconnect(); assert.equal(device.gatt.connected, false);
    write.properties.write = false; notify.properties.write = true;
    const oppositeAssignment = await BleRobotTransport.connect(microbitUart);
    await oppositeAssignment.send(new TextEncoder().encode('STOP\n'));
    assert.equal(new TextDecoder().decode(notify.frames.at(-1)), 'STOP\n'); oppositeAssignment.disconnect();
  } finally { if (original) Object.defineProperty(globalThis, 'navigator', original); else Reflect.deleteProperty(globalThis, 'navigator'); }
});
test('urgent Stop cancels queued motion and follows the in-flight write, without interleaving UART bytes', async () => {
  let release!: () => void; const writes: string[] = [];
  const queue = new RobotWriteQueue(async data => { const text = new TextDecoder().decode(data); writes.push(text); if (text === 'in-flight') await new Promise<void>(resolve => { release = resolve; }); });
  const first = queue.send(new TextEncoder().encode('in-flight'));
  const cancelled = Array.from({ length: 16 }, () => assert.rejects(queue.send(new TextEncoder().encode('START')), /Cancelled by Stop/));
  const stop = queue.send(new TextEncoder().encode('STOP'), true); release(); await Promise.all([first, ...cancelled, stop]);
  assert.deepEqual(writes, ['in-flight', 'STOP']); queue.close(); await assert.rejects(queue.send(new Uint8Array([1])), /disconnected/);
});
test('UART decoder handles fragmented UTF-8, CRLF values and complete JSON without a delimiter', () => {
  const decoder = new SensorDecoder(), bytes = new TextEncoder().encode('{"name":"🎨","battery":75}\r\n');
  assert.deepEqual(decoder.accept(bytes.slice(0, 11)), []);
  assert.deepEqual(decoder.accept(bytes.slice(11)), ['{"name":"🎨","battery":75}']);
  assert.deepEqual(decoder.accept(new TextEncoder().encode('{"battery":80}')), ['{"battery":80}']);
  assert.deepEqual(parseSensorText('distance:120'), { distanceMm: 120 }); assert.deepEqual(parseSensorText('status:held'), { status: 'held' });
  assert.deepEqual(parseSensorText('marker:8'), { event: 'marker', code: 8 }); assert.deepEqual(parseSensorText('ARRIVED'), { event: 'arrived', status: 'stopped' });
  assert.throws(() => parseSensorText('battery:101'), /battery/); assert.throws(() => parseSensorText('{"distanceMm":-1}'), /distance/);
  assert.equal(parseSensorText('ordinary robot message'), undefined);
  assert.throws(() => decoder.accept(new Uint8Array(16385)), /large/);
});
test('commands are configurable and do not claim a confirmed motor state', async () => {
  const robot = new FakeRobot(), session = new RobotSession(robot);
  await session.command('start', defaultCommands); await session.command('stop', { ...defaultCommands, stop: 'S', ending: 'none' });
  assert.deepEqual(robot.writes, ['START\n', 'S']); assert.equal(session.report, undefined); assert.match(session.message, /sent/);
  robot.receive('battery:75\n'); assert.equal(session.report?.battery, 75);
  session.disconnect(); await assert.rejects(session.command('start', defaultCommands), /disconnected/);
});
test('fleet keeps independent sensor data, queues and robot identities; Stop reaches all connected robots', async () => {
  const fleet = new RobotFleet(), a = new FakeRobot('a'), b = new FakeRobot('b'), sa = fleet.add(a), sb = fleet.add(b);
  a.receive('battery:75\n'); b.receive('battery:20\n'); assert.equal(sa.report?.battery, 75); assert.equal(sb.report?.battery, 20);
  await sa.command('start', defaultCommands); assert.equal(b.writes.length, 0);
  await fleet.stopAll(defaultCommands); assert.deepEqual(a.writes, ['START\n', 'STOP\n']); assert.deepEqual(b.writes, ['STOP\n']);
  const duplicate = new FakeRobot('a'); assert.throws(() => fleet.add(duplicate), /already/); assert.equal(duplicate.closed, true);
  fleet.disconnectAll(); assert.equal(fleet.sessions.size, 0);
});
test('optional sequence numbers suppress duplicates and malformed sensors do not update game observations', () => {
  const robot = new FakeRobot(), session = new RobotSession(robot); let count = 0; session.onReport = () => count++;
  robot.receive('{"battery":75,"sequence":1}\n'); robot.receive('{"battery":20,"sequence":1}\n');
  robot.receive('battery:500\n'); assert.equal(count, 1); assert.equal(session.report?.battery, 75);
});
test('tracking is optional and hardware reports, not frame timing, advance a physical run', () => {
  const j = journey(), markers = [
    { code: 8, node: 'start', nodeId: j.world.start, routeIndex: 0, milestone: 0, label: 'music', distance: 1, endDistance: 2, bars: [] },
    { code: 12, node: 'goal', nodeId: j.world.destination, routeIndex: j.route.length - 1, milestone: j.trajectory.length, label: 'arrival', distance: j.trajectory.length - 3, endDistance: j.trajectory.length - 2, bars: [] },
  ];
  const run = new PhysicalJourney(j, 10, markers, 100);
  j.update(1000); assert.equal(j.metrics.distance, 0);
  run.observe({ distanceMm: 110, status: 'following' }, 1000); assert.equal(j.metrics.distance, 1);
  run.observe({ status: 'held' }, 1500); run.observe({ battery: 75 }, 1700); assert.equal(j.paused, true);
  run.observe({ event: 'marker', markerIndex: 0, code: 8 }, 2000); assert.equal(j.metrics.pickups, 1);
  run.observe({ event: 'marker', markerIndex: 0, code: 8 }, 2200); assert.equal(j.metrics.pickups, 1);
  assert.throws(() => run.observe({ event: 'marker', markerIndex: 1, code: 7 }, 2500), /barcode/);
  run.freeze(); const distance = j.metrics.distance; run.observe({ distanceMm: 150 }, 3000); j.update(1000); assert.equal(j.metrics.distance, distance);
  run.activate(); run.observe({ event: 'marker', markerIndex: 1, code: 12 }, 3500); assert.equal(j.complete, false);
  run.observe({ event: 'arrived', status: 'stopped' }, 4000); assert.equal(j.complete, true);
});
