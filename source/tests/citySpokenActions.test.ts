import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BotHistory } from '../src/robot/botHistory';
import { generateCity } from '../src/city/proceduralCity';
import { PlannedJourney } from '../src/simulation/plannedJourney';
import { citySpokenChoices, spokenTools, validateSpokenCall } from '../src/ui/citySpokenActions';
import { interpretCityReply, applyCityReply } from '../src/ui/cityReply';
import { NeuTokenizer, serializeTools } from '../src/audio/neudecideTokenizer';
import { hasCommandSpeech, resampleCommand } from '../src/audio/CitySpokenCommand';
import { cityCommandVariations } from '../src/ui/cityCommandPhrases';

test('all advertised variations and polite requests resolve to the same contextual action', () => {
  const { journey } = fixture('curb');
  const targets = [...journey.world.streets.map(street => street.id), ...(journey.world.bicycles ?? []).map(bike => bike.id), 'studio-entrance'];
  const tested = new Set<string>();
  for (const id of targets) {
    journey.blocked = { id, reason: 'Barrier' };
    for (const choice of citySpokenChoices(journey)) {
      if (['noAction', 'explainCurrentBarrier'].includes(choice.name)) continue;
      tested.add(choice.name);
      const expected = interpretCityReply(choice.phrase, journey).action;
      assert.ok(expected, choice.name);
      for (const phrase of choice.variations ?? []) {
        for (const request of [phrase, `Could you ${phrase.toLowerCase()} please?`, `Please ${phrase.toLowerCase()}.`])
          assert.deepEqual(interpretCityReply(request, journey).action, expected, `${choice.name}: ${request}`);
      }
    }
  }
  assert.ok(tested.has('addRamp')); assert.ok(tested.has('extendCrossingTime')); assert.ok(tested.has('openStudioEntrance'));
});
test('expanded vocabulary preserves negation, ambiguity and single-request checks', () => {
  const { journey } = fixture('curb');
  for (const phrase of ["Don't flatten the curb", 'Avoid building a ramp', 'Keep the city unchanged and lower the curb', 'Install a ramp and build a lift', 'Undo that then install a ramp', 'Build a ramp and broaden the passage', 'Is a ramp needed?', 'Do you need a ramp?', 'The curb is high'])
    assert.equal(interpretCityReply(phrase, journey).action, undefined, phrase);
  for (const phrase of cityCommandVariations.noAction!) {
    const reply = interpretCityReply(phrase, journey); assert.equal(reply.action, undefined); assert.match(reply.message, /No city change/);
  }
  for (const phrase of cityCommandVariations.explainCurrentBarrier!) assert.equal(interpretCityReply(phrase, journey).action, undefined);
});
test('new request verbs and extra-time phrasing preserve dimension units', () => {
  const { journey, street } = fixture('crossing');
  assert.deepEqual(interpretCityReply('Please give me 15 seconds of extra time to cross', journey).action, { kind: 'dimension', id: `crossing:${street.id}`, value: 15 });
  assert.deepEqual(interpretCityReply('Could you install audible crossing signals?', journey).action, { kind: 'feature', id: `signals:${street.id}` });
  assert.equal(interpretCityReply('Please broaden this passage to 2 seconds', journey).action, undefined);
});

function fixture(kind: string) {
  const history = new BotHistory(['Curie', 'Einstein']); history.selectPreset('monet'); const bot = history.all[0]!;
  const journey = new PlannedJourney(bot, generateCity(42, [bot]));
  const street = journey.world.streets.find(s => s.kind === kind)!; assert.ok(street);
  journey.blocked = { id: street.id, reason: 'Barrier' }; return { journey, street };
}
test('curb phrases share the existing reversible dropped-curb action', () => {
  for (const phrase of ['add a cut curb', 'add a ramp', 'lower the curb', 'add a dropped kerb', 'add a curb ramp']) {
    const { journey, street } = fixture('curb');
    assert.deepEqual(interpretCityReply(phrase, journey).action, { kind: 'feature', id: street.id }, phrase);
    applyCityReply(journey, interpretCityReply(phrase, journey)); assert.ok(journey.repaired.has(street.id));
    assert.ok(journey.undoRepair()); assert.equal(journey.repaired.has(street.id), false);
  }
});
test('tools are contextual, bounded and cannot provide arbitrary arguments or targets', () => {
  const { journey } = fixture('curb'); const choices = citySpokenChoices(journey);
  assert.ok(choices.some(c => c.name === 'lowerCurb')); assert.ok(!choices.some(c => c.name === 'addElevator'));
  assert.ok(spokenTools(choices).length <= 10);
  const valid = { name: 'addRamp', arguments: {} };
  assert.equal(validateSpokenCall([valid], choices)?.name, 'addRamp');
  for (const value of [null, [], [valid, valid], [{ name: 'evil', arguments: {} }], [{ ...valid, arguments: { id: 'other' } }], [{ ...valid, arguments: [] }], [{ name: 'addRamp' }], [{ ...valid, extra: true }]])
    assert.equal(validateSpokenCall(value, choices), undefined);
  journey.blocked = { id: 'robot:other', reason: 'Robot' };
  assert.deepEqual(citySpokenChoices(journey).map(c => c.name), ['explainCurrentBarrier', 'noAction']);
});
test('long prompts and negated curb requests cannot edit', () => {
  const { journey } = fixture('curb');
  for (const phrase of ["don't lower the curb", 'add a ramp and a beeper', 'add a ramp ' + 'please '.repeat(100)]) assert.equal(interpretCityReply(phrase, journey).action, undefined);
});
test('tool serialization uses Python spacing and ASCII escapes', () => {
  assert.equal(serializeTools([{ name: 'café', parameters: { additionalProperties: false } }]), '[{"name": "caf\\u00e9", "parameters": {"additionalProperties": false}}]');
});
test('BPE prefers highest scores with leftmost ties and normalizes spaces', () => {
  const tokenizer = new NeuTokenizer({ model_type: 'bpe', unk_id: 0, pieces: [['?', 0, 'UNKNOWN'], ['▁', 0, 'NORMAL'], ['a', 0, 'NORMAL'], ['b', 0, 'NORMAL'], ['▁a', 1, 'NORMAL'], ['ab', 2, 'NORMAL']] });
  assert.deepEqual(tokenizer.encode('  ab  '), [1, 5]); assert.equal(tokenizer.decode([1, 5]), 'ab');
});
test('capture resampling preserves duration and rejects empty or quiet audio', () => {
  const input = new Float32Array(48000).fill(.1); const output = resampleCommand(input, 48000);
  assert.equal(output.length, 16000); assert.ok(Math.abs(output[0]! - .1) < .00001); assert.ok(hasCommandSpeech(output));
  assert.equal(hasCommandSpeech(new Float32Array(16000)), false); assert.equal(hasCommandSpeech(new Float32Array(100).fill(.1)), false);
});
