import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cityVoice, defaultRoleVoices, speechVoices } from '../src/audio/speechVoices';
import { ScreenSpeech } from '../src/audio/ScreenSpeech';

test('all English voices are available and default roles have distinct voices', () => {
  assert.equal(speechVoices.length, 28);
  assert.equal(new Set(speechVoices.map(([id]) => id)).size, 28);
  assert.equal(new Set(Object.values(defaultRoleVoices)).size, 4);
  for (const voice of Object.values(defaultRoleVoices)) assert.ok(speechVoices.some(([id]) => id === voice));
  for (const voice of Object.values(defaultRoleVoices)) assert.ok(voice.startsWith('b'));
});
test('role changes never change the city guide voice', () => {
  const speech = new ScreenSpeech(null);
  speech.setRoleVoice('editor', 'am_echo');
  assert.equal(speech.voiceForRole('editor'), 'am_echo');
  assert.equal(speech.voiceForRole('city'), cityVoice);
  speech.dispose();
});
