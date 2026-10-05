import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CityVoiceReply } from '../src/audio/CityVoiceReply';
import type { VoiceEvents } from '../src/audio/CityVoiceReply';

test('only Done dispatches final lines, with duplicate ids replaced and partials excluded', async () => {
  let events!: VoiceEvents;
  const submitted: string[] = [];
  const voice = new CityVoiceReply({ status() {}, transcript() {}, active() {}, submit: text => submitted.push(text) }, async callbacks => {
    events = callbacks;
    return { async load() {}, async start() {}, async stop() { events.line('9007199254740993', 'add a ramp'); }, close() {} };
  });
  await voice.start(); events.text('add a bridge'); events.line('9007199254740993', 'add');
  assert.deepEqual(submitted, []); await voice.finish();
  assert.deepEqual(submitted, ['add a ramp']); await voice.finish(); assert.equal(submitted.length, 1);
});
test('cancellation during model load never opens the microphone or dispatches', async () => {
  let loaded!: () => void, starts = 0, closes = 0;
  const voice = new CityVoiceReply({ status() {}, transcript() {}, active() {}, submit() { assert.fail('Cancelled turn dispatched'); } }, async () => ({
    load: () => new Promise<void>(resolve => { loaded = resolve; }),
    async start() { starts++; }, async stop() {}, close() { closes++; },
  }));
  const start = voice.start(); await new Promise(resolve => setTimeout(resolve, 0));
  voice.cancel(); loaded(); await start;
  assert.equal(starts, 0); assert.ok(closes > 0); assert.equal(voice.busy, false);
});
test('late callbacks after cancellation and errors cannot edit the city', async () => {
  let events!: VoiceEvents, stopped = 0;
  const submitted: string[] = [];
  const voice = new CityVoiceReply({ status() {}, transcript() {}, active() {}, submit: text => submitted.push(text) }, async callbacks => {
    events = callbacks; return { async load() {}, async start() {}, async stop() { stopped++; }, close() {} };
  });
  await voice.start(); events.error(new Error('Microphone disconnected')); events.line('old', 'add a ramp');
  await voice.finish(); assert.deepEqual(submitted, []); assert.equal(stopped, 1);
});
