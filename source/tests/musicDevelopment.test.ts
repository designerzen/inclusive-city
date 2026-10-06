import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MusicDevelopment, MusicRandom, MotifMarkovChain, nextMusicCells } from '../src/art/MusicDevelopment';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { musicianStyles } from '../src/art/artistStyles';
import { SoundEffect } from '../src/audio/SoundEffect';

const motif = [0, 2, 4, 3, 2, 1, 0, 4];
const notes = motif.map((degree, i) => ({ midi: 60 + degree, start: i * .25, duration: .2 }));
const context = { phrase: 5, beat: .5, root: 48, scale: [0, 2, 4, 5, 7, 9, 11], motif,
  harmony: true, restrained: false, sparse: false, cadence: false, swing: false };

test('seeded categorical, normal and exponential draws have repeatable distribution properties', () => {
  const sample = (seed: number) => {
    const random = new MusicRandom(seed);
    return Array.from({ length: 4000 }, () => [random.uniform(), random.normal(), random.exponential(2), random.weighted([0, 1], [1, 4])]);
  };
  const values = sample(42);
  assert.deepEqual(values, sample(42));
  const mean = (column: number) => values.reduce((sum, row) => sum + row[column]!, 0) / values.length;
  assert.ok(values.every(row => row[0]! >= 0 && row[0]! < 1 && row[2]! >= 0 && row.every(Number.isFinite)));
  assert.ok(Math.abs(mean(1)) < .06);
  assert.ok(Math.abs(values.reduce((sum, row) => sum + row[1]! ** 2, 0) / values.length - 1) < .1);
  assert.ok(Math.abs(mean(2) - 2) < .1);
  assert.ok(mean(3) > .77 && mean(3) < .83);
});

test('Markov transitions favour observed successors and depend on the previous note', () => {
  const chain = new MotifMarkovChain([0, 4, 0, 4, 0, 4, 2, 1, 2, 1, 2, 1]);
  const random = new MusicRandom(42);
  const fromZero = Array.from({ length: 1000 }, () => chain.next(0, random));
  const fromTwo = Array.from({ length: 1000 }, () => chain.next(2, random));
  assert.ok(fromZero.filter(note => note === 4).length > 800);
  assert.ok(fromTwo.filter(note => note === 1).length > 800);
  assert.ok([...fromZero, ...fromTwo].every(note => [0, 1, 2, 4].includes(note)));
});

test('cellular rhythm updates are synchronous and wrap at the meter boundary', () => {
  const cells = [0, 0, 1, 0, 0];
  assert.deepEqual(nextMusicCells(cells, 150), [0, 1, 1, 1, 0]);
  assert.deepEqual(nextMusicCells([1, 0, 0, 0], 150), [1, 1, 0, 1]);
  assert.deepEqual(cells, [0, 0, 1, 0, 0]);
  assert.deepEqual(nextMusicCells(cells, 0), [0, 0, 0, 0, 0]);
});

test('evolution selects fitter motif variants with fixed anchors and bounded work', () => {
  const evolution = new MusicDevelopment(42, 'jazz', 4);
  const plan = evolution.plan(motif, 8);
  assert.equal(plan.generation, 8);
  assert.equal(plan.fitness.length, 9);
  assert.ok(plan.fitness.every((score, i) => !i || score >= plan.fitness[i - 1]!));
  assert.ok(plan.fitness.at(-1)! > plan.fitness[0]!);
  assert.equal(plan.genes[0], motif[0]);
  assert.equal(plan.genes.at(-1), motif.at(-1));
  assert.notDeepEqual(plan.genes, motif);
  assert.equal(evolution.plan(motif, 1_000_000).generation, 12);
  assert.equal(evolution.plan(motif, 1_000_000).cells.length, 16);
  assert.ok(evolution.plan(motif, 7).density < evolution.plan(motif, 6).density, 'a release section leaves space');
  assert.notDeepEqual(evolution.plan(motif, 1).cells, evolution.plan(motif, 2).cells);
  assert.deepEqual(plan, new MusicDevelopment(42, 'jazz', 4).plan(motif, 8));
  assert.notDeepEqual(plan, new MusicDevelopment(13, 'jazz', 4).plan(motif, 8));
  (plan.genes as number[])[0] = 99;
  assert.equal(evolution.plan(motif, 8).genes[0], motif[0], 'callers cannot alter cached populations');
});

test('development is independent of call order, leaves its source intact and respects discovery and cadence', () => {
  const evolution = new MusicDevelopment(42, 'jazz', 4), saved = structuredClone(notes);
  const answer = evolution.develop(notes, context);
  evolution.develop(notes, { ...context, phrase: 80 });
  for (let section = 0; section < 40; section++) evolution.plan(motif, section);
  assert.deepEqual(evolution.develop(notes, context), answer, 'recomputation after eviction is identical');
  assert.deepEqual(new MusicDevelopment(42, 'jazz', 4).develop(notes, context), answer);
  assert.deepEqual(notes, saved);
  assert.equal(answer.lead[0]!.midi, notes[0]!.midi);
  assert.equal(answer.lead.at(-1)!.midi, notes.at(-1)!.midi);
  assert.deepEqual(evolution.develop(notes, { ...context, phrase: 0 }), { lead: notes, counter: [] });
  assert.deepEqual(evolution.develop(notes, { ...context, cadence: true }), { lead: notes, counter: [] });
  assert.deepEqual(evolution.develop(notes, { ...context, harmony: false }).counter, []);
  let active = 0, quiet = 0;
  for (let phrase = 32; phrase < 64; phrase++) {
    active += evolution.develop(notes, { ...context, phrase }).counter.length;
    quiet += evolution.develop(notes, { ...context, phrase, restrained: true }).counter.length;
  }
  assert.ok(active > quiet && active > 0);
});

test('all 55 styles grow across sections, preserve their grooves and replay without generation', () => {
  let openingDensity = 0, matureDensity = 0;
  for (const style of musicianStyles) {
    const composer = new JourneyMusicComposer(style.id, 42661, 50, { get: () => undefined });
    const at = 0, base = { at, phrase: 0, steps: 0, edge: 0, blocked: false, harmony: true };
    const measure = composer.beats * 60 / composer.bpm;
    const signatures = new Set<string>();
    let layers = 0;
    for (let phrase = 0; phrase < 40; phrase++) {
      const score = composer.compose({ ...base, phrase, at: phrase * measure }, false, false);
      const lead = score[0]!.score;
      if (phrase < 4) openingDensity += lead.notes.length;
      if (phrase >= 32 && phrase < 36) matureDensity += lead.notes.length;
      const layer = score.find(entry => entry.label?.includes('evolution-countermelody'));
      if (phrase % 4 === 1) signatures.add(JSON.stringify([lead.notes, layer?.score.notes]));
      if (layer) { layers++; if (phrase >= 32 && phrase < 36) matureDensity += layer.score.notes.length; }
      for (const entry of score) assert.deepEqual(SoundEffect.fromScore(JSON.parse(JSON.stringify(entry.score))).toScore(), entry.score);
      for (const entry of [score[0]!, ...(layer ? [layer] : [])]) {
        assert.ok(entry.score.notes.length <= 256);
        if (phrase >= 4) assert.ok(entry.score.notes.every(note => note.start >= 0 && note.duration > 0 && note.start + note.duration <= measure + 1e-9), style.id);
      }
      // The original bass, drums and chord placements stay stable each four-bar cycle.
      if (phrase >= 4 && style.id !== 'blues') {
        const groove = (entries: typeof score) => entries.filter(entry => !entry.label?.includes('melody') && !entry.label?.includes('counterpoint')).map(entry => entry.score);
        assert.deepEqual(groove(score), groove(composer.compose({ ...base, phrase: phrase % 4 }, false, false)), style.id);
      }
    }
    assert.ok(layers > 0, `${style.id} develops accompaniment`);
    assert.ok(signatures.size > 3, `${style.id} develops more than an alternating loop`);
  }
  assert.ok(matureDensity > openingDensity, 'later sections add bounded melodic detail and voices');
});
