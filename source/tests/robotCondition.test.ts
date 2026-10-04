import assert from 'node:assert/strict';
import { test } from 'node:test';
import { freshCondition, advanceCondition, directionLabel } from '../src/robot/robotCondition';
import { CharacterAnimation } from '../src/robot/characterAnimation';
import { BotHistory } from '../src/robot/botHistory';
import { CityJourney } from '../src/simulation/cityJourney';

test('feelings accumulate independently of frame rate, stay bounded and recover at rest', () => {
  const a = freshCondition(), b = freshCondition();
  advanceCondition(a, 20, 'blocked');
  for (let i = 0; i < 600; i++) advanceCondition(b, 1 / 30, 'blocked');
  assert.ok(Math.abs(a.fatigue - b.fatigue) < 1e-8);
  assert.ok(Math.abs(a.frustration - b.frustration) < 1e-8);
  assert.equal(a.mood, 'frustrated'); assert.equal(a.frustration, 100);
  advanceCondition(a, 200, 'moving'); assert.equal(a.mood, 'tired'); assert.equal(a.fatigue, 100);
  advanceCondition(a, 200, 'resting'); assert.equal(a.fatigue, 0); assert.equal(a.frustration, 0);
  assert.equal(a.mood, 'curious');
});

test('fatigue and frustration produce distinct readable faces even with reduced motion', () => {
  const animation = new CharacterAnimation();
  const neutral = animation.tick(.1, false, true);
  animation.condition = { ...freshCondition(), mood: 'tired', fatigue: 90 }; animation.mood = 'tired';
  const tired = animation.tick(.1, false, true);
  assert.ok(tired.eyeHeight < neutral.eyeHeight); assert.ok(tired.eyeLid > neutral.eyeLid);
  animation.condition = { ...freshCondition(), mood: 'frustrated', frustration: 90 }; animation.mood = 'frustrated';
  const frustrated = animation.tick(.1, false, true);
  assert.ok(frustrated.brow > 0); assert.ok(frustrated.smile < 0);
  assert.notEqual(frustrated.eyeTilt, tired.eyeTilt); assert.equal(frustrated.twist, 0);
});

test('journey reports actual speed and heading, rests on pause, resets on restart and isolates bots', () => {
  const history = new BotHistory(['Curie', 'Einstein'], () => 0), bot = history.current;
  const journey = new CityJourney(bot);
  journey.update(1);
  assert.ok(bot.record.condition.speed > 0); assert.equal(bot.record.condition.direction, journey.heading);
  journey.update(20); journey.update(10);
  assert.equal(bot.record.condition.speed, 0); assert.equal(bot.record.condition.mood, 'frustrated');
  const fatigue = bot.record.condition.fatigue;
  journey.paused = true; journey.update(5);
  assert.ok(bot.record.condition.fatigue < fatigue);
  const snapshot = journey.machine.snapshot(); snapshot.condition.frustration = 0;
  assert.ok(bot.record.condition.frustration > 0);
  history.next(); assert.deepEqual(history.current.record.condition, freshCondition());
  journey.restart(); assert.deepEqual(bot.record.condition, { ...freshCondition(), direction: journey.heading });
  assert.equal(directionLabel(0), 'North'); assert.equal(directionLabel(-Math.PI / 2), 'East');
});
