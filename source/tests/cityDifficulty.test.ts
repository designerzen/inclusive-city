import assert from 'node:assert/strict';
import { test } from 'node:test';
import { generateCityWithBarriers, isBarrierAmount } from '../src/city/cityDifficulty';
import { generateCity, robotFootprint } from '../src/city/proceduralCity';
import { BotHistory } from '../src/robot/botHistory';
import { PlannedJourney } from '../src/simulation/plannedJourney';

test('barrier amounts preserve seeded layouts and keep an exact number of challenge locations', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  bot.profile.enabledFunctions = bot.profile.enabledFunctions.filter(f => f !== 'communication');
  for (let seed = 0; seed < 30; seed++) {
    const original = generateCity(seed, [bot]);
    assert.deepEqual(generateCityWithBarriers(seed, [bot], 'all'), original);
    for (const amount of ['0', '3', '6', '12'] as const) {
      const world = generateCityWithBarriers(seed, [bot], amount);
      assert.deepEqual(world.nodes, original.nodes);
      assert.deepEqual(world.buildings, original.buildings);
      assert.deepEqual(generateCityWithBarriers(seed, [bot], amount), world);
      const remaining = world.streets.filter(s => s.kind !== 'clear' && !world.initialImprovements?.includes(s.id)).length
        + (world.bicycles?.length ?? 0)
        + Number(world.studioEntrance!.width < robotFootprint(bot) + .15)
        + Number(!world.initialImprovements?.includes('communication'));
      assert.equal(remaining, Number(amount));
    }
  }
});

test('open cities can be completed without repairs, including communication and train boarding', () => {
  const bot = new BotHistory(['Curie', 'Einstein']).current;
  bot.profile.enabledFunctions = bot.profile.enabledFunctions.filter(f => f !== 'communication');
  const profile = structuredClone(bot.profile);
  for (let seed = 0; seed < 30; seed++) {
    const world = generateCityWithBarriers(seed, [bot], '0');
    const journey = new PlannedJourney(bot, world);
    journey.start();
    journey.update(10000);
    assert.equal(journey.blocked, null, `seed ${seed}`);
    assert.equal(journey.complete, true, `seed ${seed}`);
    assert.equal(journey.metrics.interventions, 0);
    journey.restart(); journey.start(); journey.update(10000);
    assert.equal(journey.complete, true);
  }
  assert.deepEqual(bot.profile, profile);
});

test('stored barrier choices accept only supported values', () => {
  for (const value of ['all', '0', '3', '6', '12']) assert.equal(isBarrierAmount(value), true);
  for (const value of [null, '', '-1', 'NaN', '4']) assert.equal(isBarrierAmount(value), false);
});

