import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { magentaBackingNotes } from '../src/audio/magentaScore';
import { MagentaAccompaniment } from '../src/audio/MagentaAccompaniment';
import { SoundEffect } from '../src/audio/SoundEffect';
import type { AccompanimentRequest } from '../src/audio/magentaProtocol';

const phrase = { at: 7, phrase: 0, steps: 0, edge: 0, blocked: false, harmony: true };
const generated = [{ pitch: 75, quantizedStartStep: 2, quantizedEndStep: 6 }, { pitch: 79, quantizedStartStep: 14, quantizedEndStep: 20 }];

test('AI follows chord, tempo and bar limits, preserves the lead, and remains replayable', () => {
  let request: AccompanimentRequest | undefined;
  const c = new JourneyMusicComposer('jazz', 42661, 50, { get: value => { request = value; return generated; } });
  const result = c.compose(phrase);
  assert.equal(request!.chord, 'Bbm7');
  assert.ok(request!.notes.every(n => n.pitch >= 48 && n.pitch <= 83 && n.quantizedEndStep <= 16));
  const entry = result.find(e => e.label === 'journey:magenta-countermelody:0')!;
  assert.equal(entry.at, 7);
  assert.equal(entry.score.notes[0]!.start, 2 * 60 / c.bpm / 4);
  assert.ok(entry.score.notes.every(n => n.start + n.duration <= 4 * 60 / c.bpm + 1e-8));
  assert.ok(entry.score.notes.every(n => [0, 3, 7, 10].includes(((n.midi - 58) % 12 + 12) % 12)));
  assert.deepEqual(SoundEffect.fromScore(JSON.parse(JSON.stringify(entry.score))).toScore(), entry.score);
  const fallback = new JourneyMusicComposer('jazz', 42661, 50, { get: () => undefined }).compose(phrase);
  assert.deepEqual(result.filter(e => e !== entry), fallback);
  c.compose({ ...phrase, blocked: true });
  assert.equal(request!.chord, 'Fm7'); // Tension preserves this robot's transposed key.
});

test('unavailable models preserve music; styles with defining rhythms never request AI', () => {
  const c = new JourneyMusicComposer('jazz', 1, 50, { get: () => undefined });
  assert.ok(c.compose(phrase).length);
  assert.ok(!c.compose(phrase).some(e => e.label?.includes('magenta')));
  for (const style of ['waltz', 'techno', 'baroque', 'funk', 'reggae'] as const) {
    new JourneyMusicComposer(style, 1, 50, { get: () => { assert.fail(`${style} requested AI`); } }).preview();
  }
  new JourneyMusicComposer('jazz', 1, 50, { get: () => assert.fail('no harmony requested AI') }).compose({ ...phrase, harmony: false });
});

test('invalid generated notes are discarded and valid notes stay within the bar', () => {
  const notes = magentaBackingNotes([...generated,
    { pitch: NaN, quantizedStartStep: 0, quantizedEndStep: 4 },
    { pitch: 130, quantizedStartStep: 0, quantizedEndStep: 4 },
    { pitch: 60, quantizedStartStep: 16, quantizedEndStep: 18 },
    { pitch: 60, quantizedStartStep: 4, quantizedEndStep: 4 },
  ], 60, [0, 4, 7], 120);
  assert.equal(notes.length, 2);
  assert.equal(notes[1]!.start + notes[1]!.duration, 2);
});

test('worker service requires startup, deduplicates, caches, and falls back after errors', async () => {
  const original = globalThis.Worker;
  const workers: FakeWorker[] = [];
  class FakeWorker {
    onmessage?: (event: { data: unknown }) => void;
    onerror?: (event: { preventDefault(): void }) => void;
    onmessageerror?: () => void;
    messages: unknown[] = [];
    terminated = false;
    constructor() { workers.push(this); }
    postMessage(value: unknown) { this.messages.push(value); }
    terminate() { this.terminated = true; }
  }
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  const service = new MagentaAccompaniment();
  try {
    const a = { chord: 'C', notes: generated }, b = { chord: 'Am', notes: generated };
    assert.equal(service.get(a), undefined);
    assert.equal(workers.length, 0, 'generation cannot silently load a model before startup');
    const loading = service.initialize();
    assert.equal(service.initialize(), loading, 'concurrent startup shares initialization');
    assert.deepEqual(workers[0]!.messages, [{ type: 'initialize' }]);
    workers[0]!.onmessage!({ data: { type: 'ready' } });
    await loading;
    assert.equal(service.get(a), undefined);
    service.get(a); service.get(b);
    assert.equal(workers.length, 1);
    assert.equal(workers[0]!.messages.length, 2);
    const idle = service.whenIdle();
    workers[0]!.onmessage!({ data: { type: 'notes', notes: generated } });
    assert.deepEqual(service.get(a), generated);
    assert.equal(workers[0]!.messages.length, 3);
    workers[0]!.onmessage!({ data: { type: 'error', error: 'offline' } });
    await idle;
    assert.equal(workers[0]!.terminated, true);
    assert.equal(service.get(b), undefined);
    assert.deepEqual(service.get(a), generated);
    assert.equal(workers.length, 1);
  } finally { service.dispose(); globalThis.Worker = original; }
});
