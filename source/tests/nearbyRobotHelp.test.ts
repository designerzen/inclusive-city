import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { robotButtonReach } from '../src/city/proceduralCity';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { applyCityReply, interpretCityReply } from '../src/ui/cityReply';

function fixture(seconds = 10) {
  const bot = new BotHistory(['Curie', 'Einstein'], () => 0).current;
  const j = new PlannedJourney(bot, {
    seed: 1, nodes: [{ id: 'a', label: 'Start', x: 0, y: .125, z: 0 }, { id: 'b', label: 'Goal', x: 4, y: .125, z: 0 }],
    streets: [{ id: 'crossing', a: 'a', b: 'b', kind: 'crossing', width: 4, crossingSeconds: seconds, buttonHeight: robotButtonReach(bot) + .1 }],
    buildings: [], start: 'a', destination: 'b', riverX: 0, rememberedRobots: 1,
  });
  j.setFeature('communication', true); j.setFeature('signals:crossing', true);
  const helper = { id: 'helper', name: 'City robot 1', position: { x: 1, y: .125, z: 0 }, buttonReach: robotButtonReach(bot) + .2 };
  j.nearbyRobots = () => [helper]; j.start(); j.update(.1);
  assert.equal(j.blocked?.id, 'crossing');
  return { j, helper };
}

test('nearby capable robot offers a button press and preserves the city and red-light wait', () => {
  const { j } = fixture();
  const height = j.currentStreet!.buttonHeight;
  assert.match(j.blockedExplanation, /City robot 1.*ask it to press/);
  assert.match(interpretCityReply('why are you stuck?', j).message, /ask it to press/);
  const reply = interpretCityReply('ask somebody to press the button', j);
  assert.equal(reply.action?.kind, 'ask-robot');
  assert.match(applyCityReply(j, reply), /pressed/);
  assert.equal(j.currentStreet!.buttonHeight, height);
  assert.equal(j.hasRequestedCrossing(j.currentStreet!), true);
  j.update(.1); assert.equal(j.waiting, true); assert.equal(j.metrics.distance, 0);
  j.update(30); assert.equal(j.complete, true);
  const event = j.machine.record.events.find(e => e.type === 'crossing_requested');
  assert.equal(event?.data.helper, 'helper');
  assert.ok(j.machine.record.failures.at(-1)?.resolvedAt !== null);
  j.restart(); j.start(); j.update(.1); assert.equal(j.blocked?.id, 'crossing');
});

test('help requires a live nearby robot with enough reach on the same level', () => {
  const { j, helper } = fixture();
  for (const change of [{ x: 3.1, y: .125 }, { x: 1, y: 2 }]) {
    Object.assign(helper.position, change);
    assert.equal(j.nearbyHelp, null); assert.equal(j.askNearbyRobot(), false);
    assert.doesNotMatch(j.blockedExplanation, /ask it to press/);
  }
  helper.position = { x: 1, y: .125, z: 0 }; helper.buttonReach = 0;
  assert.equal(j.nearbyHelp, null);
  helper.buttonReach = 10;
  const reply = interpretCityReply('ask another robot to press the button', j);
  j.nearbyRobots = () => [];
  assert.match(applyCityReply(j, reply), /no longer available/);
  assert.equal(j.hasRequestedCrossing(j.currentStreet!), false);
});

test('a helper does not bypass crossing time or missing signal cues', () => {
  const { j } = fixture(.1);
  assert.equal(j.askNearbyRobot(), true);
  j.update(.1); assert.match(j.blocked!.reason, /green light gives/);
  j.editDimension('crossing:crossing', 10);
  j.setFeature('signals:crossing', false);
  j.bot.profile.enabledFunctions = ['communication', 'hearing', 'memory'];
  j.update(.1); assert.match(j.blocked!.reason, /cannot see the green light/);
  assert.equal(j.metrics.distance, 0);
  assert.equal(j.nearbyHelp, null);
});
