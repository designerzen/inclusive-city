import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readVoiceCommandModel, saveVoiceCommandModel } from '../src/audio/voiceCommandSettings';

test('command model defaults to Moonshine, persists both supported models and rejects unknown settings', () => {
  let saved: string | null = null;
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
  assert.equal(readVoiceCommandModel(storage), 'moonshine');
  saveVoiceCommandModel('neudecide', storage); assert.equal(readVoiceCommandModel(storage), 'neudecide');
  saveVoiceCommandModel('moonshine', storage); assert.equal(readVoiceCommandModel(storage), 'moonshine');
  saved = 'other'; assert.equal(readVoiceCommandModel(storage), 'moonshine');
});
test('blocked preference storage does not prevent voice commands', () => {
  assert.equal(readVoiceCommandModel({ getItem() { throw new Error('Denied'); } }), 'moonshine');
  assert.doesNotThrow(() => saveVoiceCommandModel('neudecide', { setItem() { throw new Error('Denied'); } }));
});
