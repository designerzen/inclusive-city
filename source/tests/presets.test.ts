import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { robotPresets } from '../src/robot/presets';
import { CityJourney } from '../src/simulation/cityJourney';
import { JourneyCreativity } from '../src/art/JourneyCreativity';
import { SoundEffect } from '../src/audio/SoundEffect';

test('five presets have distinct abilities, three functions and saved creative metadata', () => {
  const history = new BotHistory(['Curie', 'Einstein']);
  assert.equal(robotPresets.length, 5);
  const profiles = new Set<string>();
  for (const preset of robotPresets) {
    const bot = history.selectPreset(preset.id);
    assert.equal(bot.name, preset.name);
    assert.equal(new Set(bot.profile.enabledFunctions).size, 3);
    assert.equal(bot.profile.abilities.speed + bot.profile.abilities.routeMemory, 100);
    profiles.add(JSON.stringify(bot.profile.abilities));
    assert.deepEqual(bot.record.metadata.creative, bot.creative);
    assert.equal(bot.record.metadata.wheelCount, 4);
  }
  assert.equal(profiles.size, 5);
});

test('presets are cached with edits and records, without replacing random robots', () => {
  const history = new BotHistory(['Curie', 'Einstein']);
  const original = history.current;
  const monet = history.selectPreset('monet');
  history.rename('My Monet');
  history.selectPreset('donk');
  assert.equal(history.selectPreset('monet'), monet);
  assert.equal(history.current.name, 'My Monet');
  assert.equal(history.previous(), original);
  assert.equal(history.next(), monet);
  assert.throws(() => history.selectPreset('missing'));
});

test('creative personalities survive city entry and generate reproducible exportable styles', () => {
  const history = new BotHistory(['Curie', 'Einstein']);
  for (const preset of robotPresets) {
    const bot = history.selectPreset(preset.id);
    const journey = new CityJourney(bot);
    assert.deepEqual(journey.bot.creative, bot.creative);
    journey.update(100);
    const a = new JourneyCreativity(journey.bot), b = new JourneyCreativity(structuredClone(journey.bot));
    for (const event of journey.events) { a.consume(event); b.consume(event); }
    assert.deepEqual(a.marks, b.marks);
    assert.ok(a.marks.length > 0);
    assert.equal(a.marks[0]!.style, bot.creative!.artStyle);
    a.music = b.music = true;
    const phrase = a.advance(0);
    assert.deepEqual(phrase, b.advance(0));
    for (const entry of phrase) assert.deepEqual(SoundEffect.fromScore(entry.score).toScore(), entry.score);
    if (preset.id === 'donk') {
      assert.equal(a.bpm, 140);
      assert.equal(phrase.length, 3);
      assert.equal(phrase[1]!.score.notes.length, 4);
      assert.ok(phrase[2]!.label!.includes('donk-bass'));
    }
    assert.deepEqual(JSON.parse(JSON.stringify(bot.record)).metadata.creative, bot.creative);
  }
});
