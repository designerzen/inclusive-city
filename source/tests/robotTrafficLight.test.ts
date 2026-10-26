import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RobotTrafficLight, trafficLightWaitMs } from '../src/robot/physical/trafficLight';
import type { RobotTransport } from '../src/robot/physical/transport';
import { approachLight } from '../src/ui/configurationSignals';

function fixture() {
  const sent: string[] = [];
  const transport: RobotTransport = {
    id: 'test', name: 'Test robot', onData() {}, onDisconnect() {},
    async send(bytes) { sent.push(new TextDecoder().decode(bytes)); }, disconnect() {},
  };
  const controller = new RobotTrafficLight(transport, () => {});
  const receive = (text: string) => transport.onData(new TextEncoder().encode(text));
  return { controller, transport, sent, receive };
}

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
