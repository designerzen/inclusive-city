import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { magentaBackingNotes, magentaPhraseNotes, magentaPrimer } from '../src/audio/magentaScore';
import { MagentaAccompaniment } from '../src/audio/MagentaAccompaniment';
import { SoundEffect } from '../src/audio/SoundEffect';
import type { AccompanimentRequest } from '../src/audio/magentaProtocol';

const phrase = { at: 7, phrase: 0, steps: 0, edge: 0, blocked: false, harmony: true };
const generated = [{ pitch: 75, quantizedStartStep: 2, quantizedEndStep: 6 }, { pitch: 79, quantizedStartStep: 14, quantizedEndStep: 20 }];

test('AI follows a connected chord progression, preserves the opening motif and swing, and remains replayable', () => {
  let request: AccompanimentRequest | undefined;
  const c = new JourneyMusicComposer('jazz', 42661, 50, { get: value => { request = value; return generated; } });
  const result = c.compose(phrase);
  assert.equal(request!.chord, 'Bbm7');
  assert.ok(request!.notes.every(n => n.pitch >= 48 && n.pitch <= 83 && n.quantizedEndStep <= request!.primerSteps!));
  const entry = result.find(e => e.label === 'journey:magenta-countermelody:0')!;
  assert.equal(entry.at, 7);
  assert.equal(request!.steps, 64);
  assert.equal(request!.chords!.length, request!.primerSteps! / 16 + 4);
  assert.equal(entry.score.notes[0]!.start, (2 + 2 / 3) * 60 / c.bpm / 4);
  assert.ok(entry.score.notes.every(n => n.start + n.duration <= 4 * 60 / c.bpm + 1e-8));
  assert.ok(entry.score.notes.some(n => ![0, 3, 7, 10].includes(((n.midi - 58) % 12 + 12) % 12)), 'passing tones are not all flattened into chord tones');
  assert.deepEqual(SoundEffect.fromScore(JSON.parse(JSON.stringify(entry.score))).toScore(), entry.score);
  const fallback = new JourneyMusicComposer('jazz', 42661, 50, { get: () => undefined }).compose(phrase);
  assert.deepEqual(result.filter(e => e !== entry), fallback);
  c.compose({ ...phrase, blocked: true });
  assert.equal(request!.chord, 'Fm7'); // Tension preserves this robot's transposed key.
});

test('all genres can develop AI melodies while unavailable inference preserves defining grooves', () => {
  for (const style of ['waltz', 'techno', 'baroque', 'funk', 'reggae'] as const) {
    let requested = false;
    const composer = new JourneyMusicComposer(style, 1, 50, { get: () => { requested = true; return undefined; } });
    const score = composer.preview();
    assert.ok(requested, `${style} prepares connected music`);
    assert.ok(score.length);
    assert.ok(!score.some(entry => entry.label?.includes('magenta')));
  }
  let requested = false;
  const score = new JourneyMusicComposer('jazz', 1, 50, { get: () => { requested = true; return undefined; } })
    .compose({ ...phrase, harmony: false });
  assert.ok(requested, 'the lead can develop before the harmony discovery');
  assert.ok(!score.some(entry => entry.label?.includes('countermelody')), 'harmony discovery still controls the additional voice');
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


test('lead phrases preserve melodic contour, weak passing notes, rests and three-beat boundaries', () => {
  const notes = [
    { pitch: 60, quantizedStartStep: 16, quantizedEndStep: 18 },
    { pitch: 62, quantizedStartStep: 20, quantizedEndStep: 21 },
    { pitch: 65, quantizedStartStep: 23, quantizedEndStep: 25 },
    { pitch: 67, quantizedStartStep: 26, quantizedEndStep: 30 },
  ];
  const lead = magentaPhraseNotes(notes, 60, [0, 4, 7], 120,
    { role: 'lead', centre: 72, beats: 3, offsetSteps: 16, scale: [0, 2, 4, 5, 7, 9, 11] });
  assert.deepEqual(lead.map(note => note.midi), [72, 74, 77, 79]);
  assert.equal(lead[1]!.start - (lead[0]!.start + lead[0]!.duration), .25, 'rests survive');
  assert.ok(lead.every(note => note.start + note.duration <= 1.5));
  assert.equal(lead.at(-1)!.start + lead.at(-1)!.duration, 1.5);
});

test('primers contain the most recent actual melody, preserve pitch by octaves and eliminate overlaps', () => {
  const effect = new SoundEffect().toScore();
  const score = [0, 2, 4].map(at => ({ at, label: `journey:melody:${at}`, score: { ...effect,
    notes: [{ midi: 92, start: 0, duration: 1.5 }, { midi: 95, start: .5, duration: 1 }] } }));
  const saved = structuredClone(score), primer = magentaPrimer(score, 120, 4);
  assert.deepEqual(primer.bars, [2, 4]);
  assert.equal(primer.steps, 32);
  assert.deepEqual(primer.notes.map(note => note.pitch), [80, 83, 80, 83]);
  assert.ok(primer.notes.every((note, i) => note.quantizedEndStep <= (primer.notes[i + 1]?.quantizedStartStep ?? primer.steps)));
  assert.deepEqual(score, saved);
});

test('ready sections develop the lead without replacing the motif or changing the saved synth', () => {
  const response = Array.from({ length: 4 }, (_, bar) => [
    { pitch: 60, quantizedStartStep: bar * 16, quantizedEndStep: bar * 16 + 2 },
    { pitch: 62, quantizedStartStep: bar * 16 + 4, quantizedEndStep: bar * 16 + 5 },
    { pitch: 65, quantizedStartStep: bar * 16 + 8, quantizedEndStep: bar * 16 + 10 },
  ]).flat();
  const composer = new JourneyMusicComposer('melodic', 42661, 50, { get: () => response });
  const fallback = new JourneyMusicComposer('melodic', 42661, 50, { get: () => undefined });
  assert.deepEqual(composer.compose(phrase)[0]!.score, fallback.compose(phrase)[0]!.score);
  const answer = composer.compose({ ...phrase, phrase: 1 })[0]!;
  const procedural = fallback.compose({ ...phrase, phrase: 1 })[0]!;
  assert.ok(answer.label?.endsWith(':magenta'));
  assert.notDeepEqual(answer.score.notes, procedural.score.notes);
  assert.deepEqual(answer.score.voice, procedural.score.voice);
  const saved = structuredClone(answer);
  response[3]!.pitch = 1;
  assert.deepEqual(answer, saved, 'later model output cannot mutate recorded notes');
  assert.deepEqual(saved.score, JSON.parse(JSON.stringify(saved.score)), 'resolved scores can replay without inference');
});

test('urgent requests displace speculative work and section waits ignore unrelated inference', async () => {
  const original = globalThis.Worker;
  const workers: FakeWorker[] = [];
  class FakeWorker {
    onmessage?: (event: { data: unknown }) => void;
    messages: { type: string; chord?: string }[] = [];
    constructor() { workers.push(this); }
    postMessage(value: { type: string; chord?: string }) { this.messages.push(value); }
    terminate() {}
    reply() { this.onmessage!({ data: { type: 'notes', notes: generated, inferenceMs: 123 } }); }
  }
  globalThis.Worker = FakeWorker as unknown as typeof Worker;
  const service = new MagentaAccompaniment();
  const request = (chord: string) => ({ chord, notes: generated });
  try {
    await service.waitFor([request('uninitialized')]);
    assert.equal(workers.length, 0);
    const loading = service.initialize(), worker = workers[0]!;
    worker.onmessage!({ data: { type: 'ready' } }); await loading;
    service.get(request('active'));
    for (let i = 0; i < 8; i++) service.get(request(`speculative${i}`), 1);
    service.get(request('speculative7'), 3); // Upgrade in place, no duplicate.
    service.get(request('discarded'), 1);
    const waiting = service.waitFor([request('audition')]);
    assert.equal(service.diagnostics.queued, 8);
    assert.equal(service.diagnostics.dropped, 2);
    worker.reply();
    assert.equal(worker.messages.at(-1)!.chord, 'audition');
    worker.reply(); await waiting;
    assert.equal(worker.messages.at(-1)!.chord, 'speculative7');
    assert.equal(service.diagnostics.active, true, 'requested wait completes while unrelated work continues');
    assert.equal(service.diagnostics.inferenceMs, 123);
    await service.waitFor([request('deadline')], 1);
    const cancelled = service.waitFor([request('cancelled')]);
    service.dispose(); await cancelled;
    assert.equal(workers.length, 1, 'every request shares the initialized worker');
  } finally { service.dispose(); globalThis.Worker = original; }
});

test('studio uses recorded themes, keeps three-beat bars and ends on the robot tonic', async () => {
  const requests: AccompanimentRequest[] = [];
  const composer = new JourneyMusicComposer('waltz', 42661, 50, { get: request => {
    requests.push(request);
    return Array.from({ length: 4 }, (_, i) => ({ pitch: 62, quantizedStartStep: i * 12, quantizedEndStep: i * 12 + 12 }));
  } });
  const history = composer.preview(2), primer = magentaPrimer(history, composer.bpm, 3);
  requests.length = 0;
  const studio = await composer.studioVerses(13.123, 5, 20, 2, history);
  assert.deepEqual(requests[0]!.notes, primer.notes);
  assert.equal(requests[0]!.primerSteps, 24);
  assert.ok(requests.every(request => request.steps === 48 && request.chords!.length === 6));
  const leads = studio.filter(entry => entry.label?.includes(':melody:'));
  assert.equal(leads.length, 8);
  assert.ok(leads.every(entry => entry.score.notes.every(note => note.start + note.duration <= 3 * 60 / composer.bpm + 1e-8)));
  const final = leads.at(-1)!;
  const harmony = studio.find(entry => entry.at === final.at && entry.label?.includes(':harmony:'))!;
  assert.equal(final.score.notes.at(-1)!.midi % 12, harmony.score.notes[0]!.midi % 12);
  const before = requests.length;
  for (const entry of studio) assert.deepEqual(SoundEffect.fromScore(JSON.parse(JSON.stringify(entry.score))).toScore(), entry.score);
  assert.equal(requests.length, before, 'score replay requires no inference');
});

test('future sections use played themes and mood controls; waltz requests use twelve steps per bar', () => {
  const requests: AccompanimentRequest[] = [];
  const composer = new JourneyMusicComposer('waltz', 42661, 50, { get: request => { requests.push(request); return undefined; } });
  const heard = composer.compose({ ...phrase, mood: 'calm' });
  composer.remember(heard);
  composer.compose({ ...phrase, phrase: 2, mood: 'frustrated', blocked: true });
  const next = requests.at(-1)!;
  assert.equal(next.steps, 48);
  assert.equal(next.primerSteps, 12);
  assert.equal(next.chords!.length, 5);
  assert.equal(next.temperature, .85);
  assert.deepEqual(next.notes, magentaPrimer(heard, composer.bpm, 3).notes);
  assert.notEqual(requests[0]!.temperature, next.temperature);
});
