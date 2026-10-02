import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { CityJourney } from '../src/simulation/cityJourney';
import { robotGuidance } from '../src/ui/robotGuidance';

test('planning preserves guessing while requested hints and encountered barriers explain the fix', () => {
  const journey = new CityJourney(new BotHistory(['Curie', 'Einstein'], () => 0).current, true);
  assert.match(robotGuidance(journey, 'curb', false), /Help me decide/);
  assert.doesNotMatch(robotGuidance(journey, 'curb', false), /too high/);
  assert.match(robotGuidance(journey, 'curb', true), /too high.*Lower curb/);
  journey.start(); journey.update(1000);
  assert.match(robotGuidance(journey, 'curb', false), /^This curb is too high for my wheels!.*Lower curb/);
  journey.edit('curb', true);
  assert.match(robotGuidance(journey, 'curb', true), /I can use/);
});
