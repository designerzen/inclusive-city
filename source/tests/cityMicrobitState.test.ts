import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity } from '../src/city/proceduralCity';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { cityFaceContext, cityFaceSnapshot } from '../src/ui/cityMicrobitState';
import { cityRobotAlert } from '../src/ui/cityRobotAlert';
import { journeyFace } from '../src/robot/microbitFace';

function fixture() {
  const bot = new BotHistory(['Curie', 'Einstein'], () => 0).current;
  return new PlannedJourney(bot, generateCity(1, [bot]));
}
test('microbit mirrors the actual condition and exact obstacle speech, even when web narration is muted', () => {
  const journey = fixture(); journey.blocked = { id: 'wall:Studio:front', reason: 'Building collision' };
  journey.machine.record.condition.mood = 'frustrated';
  const snapshot = cityFaceSnapshot(journey);
  assert.equal(snapshot.message?.text, cityRobotAlert(journey)); assert.equal(snapshot.mood, 'frustrated');
  assert.equal(journeyFace(snapshot), 'F');
  const intro = { id: 'introduction', text: 'Hello!', context: cityFaceContext(journey) };
  assert.equal(cityFaceSnapshot(journey, intro).message?.text, 'There is a wall in the way.');
  journey.blocked = null;
  assert.equal(cityFaceSnapshot(journey, intro).message, undefined);
});
test('spoken city messages keep their event identity and are discarded after the encounter changes', () => {
  const journey = fixture(), spoken = { id: 'speech:1', text: 'Here we go!', context: cityFaceContext(journey) };
  assert.equal(cityFaceSnapshot(journey, spoken).message, spoken);
  assert.equal(cityFaceSnapshot(journey, spoken).message?.id, 'speech:1');
  journey.blocked = { id: 'bicycle-1', reason: 'Bicycle barrier' };
  const first = cityFaceSnapshot(journey).message;
  assert.equal(first?.text, 'There is a bicycle in the way');
  journey.blocked = { id: 'wall:Studio:front', reason: 'Building collision' };
  assert.notEqual(cityFaceSnapshot(journey).message?.id, first?.id);
});

test('repeating the current issue gets a fresh scroll identity and stops movement music', () => {
  const journey = fixture(); journey.start();
  assert.equal(cityFaceSnapshot(journey).moving, true);
  journey.blocked = { id: 'wall:Studio:front', reason: 'Building collision' };
  const first = cityFaceSnapshot(journey);
  assert.equal(first.moving, false);
  const repeated = { id: 'speech:repeat', text: first.message!.text, context: cityFaceContext(journey) };
  assert.equal(cityFaceSnapshot(journey, repeated).message, repeated);
  assert.notEqual(repeated.id, first.message!.id);
  journey.blocked = null; journey.setPaused(true);
  assert.equal(cityFaceSnapshot(journey).moving, false);
  assert.notEqual(cityFaceSnapshot(journey, repeated).message?.id, repeated.id);
});
