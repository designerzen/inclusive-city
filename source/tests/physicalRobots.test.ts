import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity, routeToGoal } from '../src/city/proceduralCity';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { RobotFleet, RobotSession } from '../src/robot/physical/session';
import { encodeControl, encodeFrames, FrameDecoder, parseIdentity, parseReport } from '../src/robot/physical/protocol';
import type { RobotCommand, RobotIdentity, RobotReport } from '../src/robot/physical/protocol';
import type { RobotTransport } from '../src/robot/physical/transport';
import type { PhysicalManifest } from '../src/robot/physical/manifest';
import { defaultProjectionSettings } from '../src/city/projectionSettings';
import { makeManifest, validateCalibration } from '../src/robot/physical/manifest';

class FakeRobot implements RobotTransport {
  identity: RobotIdentity;
  onReport = (_: RobotReport) => {}; onDisconnect = (_: string) => {};
  commands: RobotCommand[] = []; sequence = 0; time = 0; disconnected = false; reject?: string;
  constructor(id = 'one', encoders = true) {
    this.identity = { version: 1, hardwareId: id, bootId: 'boot', name: id, encoders, lease: true, maxSpeedMmS: 1000 };
  }
  async send(command: RobotCommand) {
    this.commands.push(command);
    if (['heartbeat', 'ack'].includes(command.type)) return;
    const state = command.type === 'start' || command.type === 'resume' ? 'following' : command.type === 'hold' ? 'held' : command.type === 'stop' ? 'stopped' : 'ready';
    queueMicrotask(() => this.onReport({ ...command, type: 'result', state, accepted: this.reject !== command.type,
      sequence: ++this.sequence, timeMs: this.time += 10, reason: this.reject === command.type ? 'Denied' : undefined }));
  }
  emit(value: Partial<RobotReport>) {
    const command = this.commands.at(-1)!;
    this.onReport({ version: 1, hardwareId: this.identity.hardwareId, bootId: this.identity.bootId,
      session: command.session, routeHash: command.routeHash, type: 'telemetry', state: 'following',
      sequence: ++this.sequence, timeMs: this.time += 200, ...value });
  }
  disconnect() { this.disconnected = true; }
}
function route() {
  const bot = new BotHistory(['Curie', 'Einstein'], () => 0).current;
  const world = generateCity(42, [bot]);
  const j = new PlannedJourney(bot, world); j.enableLineFollowing();
  j.setRoute(routeToGoal(world, world.start)!);
  world.nodes.find(n => n.id === world.start)!.discovery = 'music';
  return j;
}
function manifest(j: PlannedJourney): PhysicalManifest {
  return { version: 1, worldSeed: j.world.seed, route: [...j.route], points: [], lengthMm: 300,
    projection: { ...defaultProjectionSettings }, calibration: { mmPerCityUnit: 300 / j.trajectory.length,
      minLineMm: 1, minBarMm: 1, maxSpeedMmS: 1000, stoppingDistanceMm: 10, markerToleranceMm: 20, leaseMs: 900 },
    markers: [{ index: 0, code: 8, nodeId: j.world.start, routeIndex: 0, distanceMm: 100, semanticDistanceMm: 100, hold: false },
      { index: 1, code: 12, nodeId: j.world.destination, routeIndex: j.route.length - 1, distanceMm: 200, semanticDistanceMm: 300, hold: false }] };
}
const hash = 'a'.repeat(64);
async function running(encoders = true, now?: () => number) {
  const transport = new FakeRobot('one', encoders), j = route(), session = new RobotSession(transport, undefined, now);
  await session.prepare(manifest(j), hash, j); await session.start(); return { transport, j, session };
}
test('framing preserves UTF-8 and bounds broken, reordered and expired transfers', () => {
  const value = { name: 'Robot 🎨', content: 'x'.repeat(100) }, frames = encodeFrames(value, 7), decoder = new FrameDecoder();
  let result: unknown;
  for (const f of frames) result = decoder.accept(new DataView(f.buffer), 100);
  assert.deepEqual(result, value); assert.ok(frames.every(f => f.length <= 20));
  assert.throws(() => new FrameDecoder().accept(new DataView(frames[1]!.buffer)), /Incomplete/);
  const expired = new FrameDecoder(); expired.accept(new DataView(frames[0]!.buffer), 0);
  assert.throws(() => expired.accept(new DataView(frames[1]!.buffer), 3001), /expired/);
  assert.throws(() => encodeFrames('x'.repeat(17000), 1), /16 KiB/);
  const huge = frames[0]!.slice(); new DataView(huge.buffer).setUint16(6, 65535, true);
  assert.throws(() => new FrameDecoder().accept(new DataView(huge.buffer)), /Incomplete/);
});
test('protocol rejects unsupported firmware, malformed sensor values and absent event identity', () => {
  const robot = new FakeRobot(); assert.equal(parseIdentity(robot.identity).hardwareId, 'one');
  assert.throws(() => parseIdentity({ ...robot.identity, lease: false }), /lease/);
  assert.throws(() => parseIdentity({ ...robot.identity, version: 2 }), /protocol/);
  const report = { version: 1, hardwareId: 'one', bootId: 'boot', session: 'session', routeHash: hash, sequence: 1, timeMs: 1, type: 'telemetry', state: 'following' };
  assert.throws(() => parseReport({ ...report, battery: 101 }), /range/);
  assert.throws(() => parseReport({ ...report, distanceMm: NaN }), /distance/);
  assert.throws(() => parseReport({ ...report, type: 'marker', code: 8, markerIndex: 0 }), /event ID/);
  assert.throws(() => parseReport({ ...report, type: 'result' }), /result/);
});
test('compact stop and heartbeat encode session and command identity in one BLE value', () => {
  const packet = encodeControl({ version: 1, hardwareId: 'one', bootId: 'boot', session: '01234567', routeHash: hash, commandId: 15, type: 'stop' });
  assert.equal(packet.length, 14); assert.equal(packet[1], 1);
  assert.equal(new DataView(packet.buffer).getUint32(2, true), 15);
  assert.equal(new DataView(packet.buffer).getUint32(6, true), 0x01234567);
});
test('physical travel is driven by observations; confirmed discoveries are collected once', async () => {
  const { transport, j, session } = await running();
  j.update(1000); assert.equal(j.metrics.distance, 0);
  transport.emit({ type: 'marker', markerIndex: 0, code: 8, eventId: 0, distanceMm: 100, speedMmS: 100 });
  assert.equal(j.metrics.pickups, 1); const distance = j.metrics.distance;
  transport.emit({ type: 'marker', markerIndex: 0, code: 8, eventId: 0, distanceMm: 100 });
  assert.equal(j.metrics.pickups, 1); assert.equal(j.metrics.distance, distance);
  transport.emit({ type: 'marker', markerIndex: 1, code: 12, eventId: 1, distanceMm: 200 });
  assert.equal(j.complete, false);
  transport.emit({ type: 'arrived', eventId: 2, distanceMm: 300, state: 'stopped' });
  assert.equal(j.complete, true); assert.equal(session.state, 'complete'); assert.equal(j.metrics.journeysCompleted, 1);
  j.update(1000); assert.equal(j.metrics.journeysCompleted, 1);
  session.disconnect();
});
test('wrong session and hardware reports cannot move a run; unexpected markers withdraw the lease', async () => {
  const { transport, j, session } = await running();
  transport.emit({ distanceMm: 100, session: 'other' }); transport.emit({ distanceMm: 100, hardwareId: 'other' });
  assert.equal(j.metrics.distance, 0);
  transport.emit({ type: 'marker', markerIndex: 1, code: 12, eventId: 0, distanceMm: 100 });
  assert.equal(session.state, 'fault'); assert.equal(j.metrics.distance, 0);
  assert.equal(transport.commands.at(-1)!.type, 'stop'); session.disconnect();
});
test('missing reliable events, skipped markers, early arrival and reboot fail safely', async () => {
  for (const report of [{ type: 'marker', markerIndex: 0, code: 8, eventId: 1, distanceMm: 100 },
    { distanceMm: 150 }, { type: 'arrived', eventId: 0, state: 'stopped', distanceMm: 0 }, { bootId: 'new-boot' }]) {
    const { transport, session } = await running(); transport.emit(report as Partial<RobotReport>);
    assert.equal(session.state, 'fault'); assert.equal(transport.commands.at(-1)!.type, 'stop'); session.disconnect();
  }
});
test('telemetry timeout freezes physical progress and sends no further heartbeats', async () => {
  let now = 100; const { transport, j, session } = await running(true, () => now);
  session.tick(); await Promise.resolve(); assert.equal(transport.commands.at(-1)!.type, 'heartbeat');
  now += 1000; session.tick(); assert.equal(session.state, 'stale'); const count = transport.commands.length;
  session.tick(); j.update(100); assert.equal(transport.commands.length, count); assert.equal(j.metrics.distance, 0); session.disconnect();
});
test('hold/resume/stop use application confirmations; rejected holds cannot keep authorising movement', async () => {
  const { transport, session, j } = await running();
  await session.hold(); assert.equal(session.state, 'held'); assert.equal(j.paused, true);
  await session.resume(); assert.equal(session.state, 'running');
  transport.reject = 'hold'; await assert.rejects(session.hold(), /Denied/); assert.equal(session.state, 'fault');
  const heartbeats = transport.commands.filter(c => c.type === 'heartbeat').length; session.tick();
  assert.equal(transport.commands.filter(c => c.type === 'heartbeat').length, heartbeats); session.disconnect();
});
test('robots without encoders advance in confirmed milestones rather than elapsed time', async () => {
  const { transport, j, session } = await running(false);
  transport.emit({ distanceMm: 90, speedMmS: 200 }); j.update(100); assert.equal(j.metrics.distance, 0);
  transport.emit({ type: 'marker', markerIndex: 0, code: 8, eventId: 0 }); assert.ok(j.metrics.distance > 0);
  assert.equal(j.metrics.pickups, 1); session.disconnect();
});
test('fleet isolates commands, sessions, measurements and stop state for each robot', async () => {
  const fleet = new RobotFleet(), a = new FakeRobot('a'), b = new FakeRobot('b');
  const sa = fleet.add(a), sb = fleet.add(b), ja = route(), jb = route();
  await sa.prepare(manifest(ja), hash, ja); await sb.prepare(manifest(jb), hash, jb); await sa.start(); await sb.start();
  assert.notEqual(sa.session, sb.session);
  a.emit({ distanceMm: 50 }); assert.ok(ja.metrics.distance > 0); assert.equal(jb.metrics.distance, 0);
  await sa.stop(); assert.equal(sa.state, 'stopped'); assert.equal(sb.state, 'running');
  const duplicate = new FakeRobot('a'); assert.throws(() => fleet.add(duplicate), /already/); assert.equal(duplicate.disconnected, true);
  await fleet.stopAll('Test stop.'); assert.equal(sb.state, 'stopped'); fleet.disconnectAll(); assert.equal(fleet.sessions.size, 0);
});
test('physical mode locks route drawing and turning radius, and calibration rejects guessed invalid dimensions', () => {
  const j = route(), path = [...j.route]; j.reservePhysical();
  assert.equal(j.start(), false); assert.equal(j.clearRoute(), false); assert.equal(j.setMinimumTurnRadius(12), false); assert.deepEqual(j.route, path);
  assert.throws(() => validateCalibration({ ...manifest(j).calibration, mmPerCityUnit: NaN }), /positive/);
  assert.throws(() => makeManifest(j, defaultProjectionSettings, { ...manifest(j).calibration, minLineMm: 100000 }), /line/);
});
