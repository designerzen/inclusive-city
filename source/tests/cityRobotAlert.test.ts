import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity, robotButtonReach, robotFootprint } from '../src/city/proceduralCity';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { cityRobotAlert } from '../src/ui/cityRobotAlert';

function fixture() {
  const bot = new BotHistory(['Curie', 'Einstein'], () => 0).current;
  return new PlannedJourney(bot, generateCity(1, [bot]));
}

test('physics obstacles keep their explanation even on streets with other barriers', () => {
  const j = fixture(), street = j.world.streets.find(s => s.kind === 'width')!;
  j.blocked = { id: street.id, reason: 'A solid object blocks this street.' };
  assert.equal(cityRobotAlert(j), 'There is an object in the way.');
  j.blocked = { id: 'wall:Studio:front', reason: 'Building collision' };
  assert.equal(cityRobotAlert(j), 'There is a wall in the way.');
  j.blocked = { id: 'bicycle-1', reason: 'Bicycle barrier' };
  assert.equal(cityRobotAlert(j), 'There is a bicycle in the way');
  j.blocked = null;
  assert.equal(cityRobotAlert(j), null);
});

test('crossing alerts distinguish button reach, signal cues and crossing time', () => {
  const j = fixture(), street = j.world.streets.find(s => s.kind === 'crossing')!;
  j.blocked = { id: street.id, reason: 'Crossing barrier' };
  street.buttonHeight = robotButtonReach(j.bot) + 1;
  assert.equal(cityRobotAlert(j), 'The crossing button is too high.');
  street.buttonHeight = .1;
  j.bot.profile.enabledFunctions = j.bot.profile.enabledFunctions.filter(f => f !== 'vision' && f !== 'hearing');
  assert.equal(cityRobotAlert(j), 'The crossing has no sound or touch signals.');
  j.repaired.add(`signals:${street.id}`);
  assert.equal(cityRobotAlert(j), 'The green light does not last long enough to cross.');
});

test('studio and street alerts use plain issue wording without reassurance or appeals', () => {
  const j = fixture();
  j.world.studioEntrance = { width: .1, doorType: 'revolving' };
  j.blocked = { id: 'studio-entrance', reason: 'Studio barrier' };
  assert.match(cityRobotAlert(j)!, /doorway is too narrow/);
  j.world.studioEntrance.width = robotFootprint(j.bot) + 1;
  assert.match(cityRobotAlert(j)!, /revolving door/);
  j.world.studioEntrance.doorType = 'push';
  assert.equal(cityRobotAlert(j), 'The push door cannot be opened.');
  for (const street of j.world.streets.filter(s => s.kind !== 'clear')) {
    j.blocked = { id: street.id, reason: 'Street barrier' };
    assert.doesNotMatch(cityRobotAlert(j)!, /help|worr|\d|\b(I|my|me|your|robot)\b/i);
  }
});
