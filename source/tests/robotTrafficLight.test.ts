import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RobotTrafficLight, trafficLightWaitMs } from '../src/robot/physical/trafficLight';
import type { RobotTransport } from '../src/robot/physical/transport';
import { approachLight } from '../src/ui/configurationSignals';
import { defaultTrafficLightCommands, validateTrafficLightCommands, type TrafficLightCommands } from '../src/robot/physical/trafficLightCommands';

function fixture(commands?: () => TrafficLightCommands, log?: (event: string, data?: unknown) => void) {
  const sent: string[] = [];
  const transport: RobotTransport = {
    id: 'test', name: 'Test robot', onData() {}, onDisconnect() {},
    async send(bytes) { sent.push(new TextDecoder().decode(bytes)); }, disconnect() {},
  };
  const controller = new RobotTrafficLight(transport, () => {}, commands, log);
  const receive = (text: string) => transport.onData(new TextEncoder().encode(text));
  return { controller, transport, sent, receive };
}

test('event audit retains raw partial data, unknown frames, commands, timers, state changes and stop failures', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const events: { event: string; data?: unknown }[] = [];
  const { controller, transport, receive } = fixture(undefined, (event, data) => events.push({ event, data }));
  await controller.start();
  receive('ACK:'); receive('1\nunknown\nSIG:2\n');
  t.mock.timers.tick(trafficLightWaitMs);
  receive('ACK:4\n');
  assert.equal(events.filter(entry => entry.event === 'Bluetooth RX bytes').length, 3);
  assert.ok(events.some(entry => entry.event === 'Bluetooth RX frame' && JSON.stringify(entry.data) === JSON.stringify({ text: 'unknown', frame: null })));
  assert.equal(events.filter(entry => entry.event === 'Bluetooth TX command').length, 2);
  assert.ok(events.some(entry => entry.event === 'Continue timer scheduled'));
  assert.ok(events.some(entry => entry.event === 'Robot state' && (entry.data as { phase: string }).phase === 'waiting'));
  transport.send = async () => { throw new Error('Link lost'); };
  controller.close();
  await Promise.resolve(); await Promise.resolve();
  assert.ok(events.some(entry => entry.event === 'Bluetooth TX stop failed'));
});

test('pairing starts; complete stop signal waits two seconds and resumes only once; green requires ACK', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { controller, receive, sent } = fixture();
  await controller.start(); assert.deepEqual(sent, ['CMD:1\n']);
  receive('ACK:1\n'); assert.equal(controller.phase, 'following');
  receive('SIG:'); t.mock.timers.tick(3000); assert.equal(controller.phase, 'following');
  receive('2\n'); assert.equal(controller.phase, 'waiting');
  assert.match(controller.message, /Robot awaiting instruction/);
  receive('SIG:2\nSIG:2\n');
  t.mock.timers.tick(trafficLightWaitMs - 1); assert.equal(sent.length, 1);
  t.mock.timers.tick(1); assert.deepEqual(sent, ['CMD:1\n', 'CMD:4\n']);
  assert.equal(controller.phase, 'resuming');
  receive('SIG:2\nACK:1\n'); assert.equal(controller.phase, 'resuming');
  receive('ACK:4\n'); assert.equal(controller.phase, 'following');
  // A subsequent barcode creates a fresh cycle.
  receive('SIG:2\n'); t.mock.timers.tick(trafficLightWaitMs);
  assert.equal(sent.at(-1), 'CMD:4\n'); assert.equal(sent.length, 3);
  controller.close();
});

test('click fulfils the wait immediately, selects its approach, and prevents a second timed command', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const commands = { start: 5, stop: 3, approaches: [6, 7] };
  const { controller, receive, sent } = fixture(() => commands);
  await controller.start(); receive('ACK:5\nSIG:2\n');
  t.mock.timers.tick(500);
  await controller.fulfill(1);
  assert.equal(controller.barcodeStop, 1);
  assert.equal(controller.phase, 'following');
  assert.deepEqual(sent, ['CMD:5\n', 'CMD:7\n']);
  await controller.fulfill(0); // No duplicate write while the first is unconfirmed.
  assert.equal(sent.length, 2);
  t.mock.timers.tick(trafficLightWaitMs); assert.equal(sent.length, 2);
  receive('ACK:7\n'); assert.equal(controller.canFulfill, true);
  receive('SIG:2\n'); // Next approach wraps to 0; use an edited mapping live.
  commands.approaches[0] = 8;
  t.mock.timers.tick(trafficLightWaitMs); assert.equal(sent.at(-1), 'CMD:8\n');
  receive('ACK:8\n');
  await controller.fulfill(0); assert.equal(sent.at(-1), 'CMD:8\n');
  controller.close(); assert.equal(sent.at(-1), 'CMD:3\n');
  t.mock.timers.tick(10000); assert.equal(controller.phase, 'disconnected');
});

test('manual lights require a live ready connection and valid approach; edited commands still require acknowledgement', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { controller, receive, sent } = fixture();
  await controller.fulfill(0); assert.equal(sent.length, 0);
  await controller.start(); await controller.fulfill(0); assert.equal(sent.length, 1);
  receive('ACK:1\n');
  for (const index of [-1, 1, 1.5, NaN]) await controller.fulfill(index);
  assert.equal(sent.length, 1);
  await controller.fulfill(0); assert.equal(sent.length, 2);
  t.mock.timers.tick(5000); assert.equal(controller.phase, 'fault');
  await controller.fulfill(0); assert.equal(sent.length, 2);
  controller.close(); await controller.fulfill(0); assert.equal(sent.length, 3);
});

test('command mappings reject malformed saved data and preserve independent approaches', () => {
  assert.deepEqual(validateTrafficLightCommands({ start: 15, stop: 0, approaches: [3, 8] }, 2), { start: 15, stop: 0, approaches: [3, 8] });
  for (const value of [null, {}, { start: -1, stop: 2, approaches: [4] }, { start: 1, stop: 16, approaches: [4] }, { start: 1, stop: 2, approaches: [1.5] }, { start: 1, stop: 2, approaches: [] }]) {
    assert.throws(() => validateTrafficLightCommands(value as TrafficLightCommands, 1));
  }
  assert.deepEqual(defaultTrafficLightCommands(2), { start: 1, stop: 2, approaches: [4, 4] });
});

test('disconnect and Stop cancel scheduled movement, including stale signals', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const disconnect of [false, true]) {
    const { controller, transport, receive, sent } = fixture();
    await controller.start(); receive('ACK:1\nSIG:2\n');
    if (disconnect) transport.onDisconnect('Link lost'); else controller.close();
    receive('SIG:2\nACK:4\n'); t.mock.timers.tick(10000);
    assert.equal(controller.phase, 'disconnected');
    assert.deepEqual(sent, ['CMD:1\n', 'CMD:2\n']);
  }
});

test('missing acknowledgement, firmware errors and failed writes never show green or retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { controller, receive, sent } = fixture();
  await controller.start(); t.mock.timers.tick(5000);
  assert.equal(controller.phase, 'fault'); receive('ACK:1\nSIG:2\n');
  t.mock.timers.tick(10000); assert.equal(sent.length, 1);
  const other = fixture(); await other.controller.start(); other.receive('ACK:1\nSIG:2\nERR:FRAME\n');
  t.mock.timers.tick(10000); assert.equal(other.controller.phase, 'fault'); assert.equal(other.sent.length, 1);
  const failed = fixture(); failed.transport.send = async () => { throw new Error('write failed'); };
  await failed.controller.start(); assert.equal(failed.controller.phase, 'fault');
});

test('stop signal received during initial command cancels its ACK timeout without restarting the wait', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { controller, receive } = fixture();
  await controller.start(); receive('SIG:2\nACK:1\n');
  assert.equal(controller.phase, 'waiting'); t.mock.timers.tick(trafficLightWaitMs);
  receive('ACK:4\n'); assert.equal(controller.phase, 'following');
  controller.close();
});

test('two intersection sets alternate by barcode stop, ignore duplicates and never both turn green', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const { controller, receive } = fixture();
  await controller.start(); receive('ACK:1\n');
  for (let stop = 0; stop < 4; stop++) {
    receive('SIG:2\nSIG:2\n');
    assert.equal(controller.barcodeStop, stop);
    assert.deepEqual([0, 1].map(i => approachLight('red', controller.barcodeStop, i, 2)), stop % 2 === 0 ? ['red', 'green'] : ['green', 'red']);
    t.mock.timers.tick(trafficLightWaitMs); receive('ACK:4\n');
    assert.deepEqual([0, 1].map(i => approachLight('green', controller.barcodeStop, i, 2)), stop % 2 === 0 ? ['green', 'red'] : ['red', 'green']);
  }
  assert.equal(approachLight('green', 3, 0, 1), 'green');
  assert.deepEqual([0, 1].map(i => approachLight('off', 3, i, 2)), ['off', 'off']);
  controller.close();
});
