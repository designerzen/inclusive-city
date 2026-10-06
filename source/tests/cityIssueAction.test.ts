import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity, robotButtonReach, robotFootprint } from '../src/city/proceduralCity';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { cityIssueAction } from '../src/ui/cityIssueAction';

function fixture() {
  const bot = new BotHistory(['Curie', 'Einstein'], () => 0).current;
  return new PlannedJourney(bot, generateCity(1, [bot]));
}

test('crossing action follows each remaining barrier and repairs the advertised setting', () => {
  const j = fixture(), street = j.world.streets.find(s => s.kind === 'crossing')!;
  j.bot.profile.enabledFunctions = j.bot.profile.enabledFunctions.filter(f => f !== 'vision');
  street.buttonHeight = robotButtonReach(j.bot) + 1;
  street.crossingSeconds = 1;
  j.blocked = { id: street.id, reason: 'Crossing barrier' };
  assert.equal(cityIssueAction(j), 'Lower the crossing button');
  assert.equal(j.repair(street.id), true);
  assert.equal(j.reachProblem(street), null);
  assert.equal(cityIssueAction(j), 'Add sound and touch signals');
  assert.equal(j.repair(street.id), true);
  assert.ok(j.hasCrossingCues(street));
  j.blocked = { id: street.id, reason: 'Crossing barrier' };
  assert.equal(cityIssueAction(j), 'Give more time to cross');
  assert.equal(j.repair(street.id), true);
  assert.equal(j.problem(street), null);
});

test('studio action widens the door before changing its mechanism', () => {
  const j = fixture();
  j.world.studioEntrance = { width: .1, doorType: 'revolving' };
  j.blocked = { id: 'studio-entrance', reason: 'Studio barrier' };
  assert.equal(cityIssueAction(j), 'Widen the studio doorway');
  assert.equal(j.repair('studio-entrance'), true);
  assert.ok(j.world.studioEntrance.width >= robotFootprint(j.bot) + .15);
  j.blocked = { id: 'studio-entrance', reason: 'Studio barrier' };
  assert.equal(cityIssueAction(j), 'Add an automatic door');
  assert.equal(j.repair('studio-entrance'), true);
  assert.equal(j.world.studioEntrance.doorType, 'automatic');
});

test('physical obstacles never offer an unrelated street repair', () => {
  const j = fixture(), street = j.world.streets.find(s => s.kind === 'width')!;
  for (const id of [street.id, 'wall:Studio:front', 'robot:other']) {
    j.blocked = { id, reason: 'A solid object blocks this street.' };
    assert.equal(cityIssueAction(j), null);
  }
  j.blocked = { id: 'communication', reason: 'No board' };
  assert.equal(cityIssueAction(j), 'Add a symbol board');
  j.blocked = { id: 'bicycle-1', reason: 'Bicycle barrier' };
  assert.equal(cityIssueAction(j), 'Move bicycle out of the way');
  j.blocked = null;
  assert.equal(cityIssueAction(j), null);
});
