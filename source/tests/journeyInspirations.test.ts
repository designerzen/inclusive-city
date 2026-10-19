import assert from 'node:assert/strict';
import { test } from 'node:test';
import { journeyInspiration } from '../src/city/journeyInspirations';
import type { RobotEvent } from '../src/robot/robotState';

const event = (type: RobotEvent['type'], data: RobotEvent['data']): RobotEvent => ({
  type, data, sequence: 1, botId: 1, runId: 1, time: 0, runTime: 0,
  state: 'following', edge: 0, position: { x: 0, y: 0, z: 0 },
});

test('both encounter streams explain the creative effect and keep separate identities', () => {
  const building = journeyInspiration(event('building_encounter', { id: 'Museum', kind: 'museum' }))!;
  const pickup = journeyInspiration(event('pickup', { id: 'Museum', kind: 'harmony' }), 'Museum')!;
  assert.notEqual(building.id, pickup.id);
  assert.match(building.description, /original brush style.*echo/);
  assert.match(pickup.description, /chord voices/);
  assert.match(pickup.name, /Museum/);
  for (const kind of ['art', 'colour', 'music', 'harmony']) {
    assert.ok(journeyInspiration(event('pickup', { id: kind, kind }))?.description);
  }
  assert.equal(journeyInspiration(event('step', {})), null);
  assert.equal(journeyInspiration(event('pickup', { kind: 'unknown' })), null);
  assert.equal(journeyInspiration(event('building_encounter', { kind: 'toString' })), null);
});
