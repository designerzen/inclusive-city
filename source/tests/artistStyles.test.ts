import assert from 'node:assert/strict';
import { test } from 'node:test';
import { painterStyles, musicianStyles, normaliseArtist } from '../src/art/artistStyles';
import { ProceduralPainting, PaintingRenderer } from '../src/art/ProceduralPainting';
import { JourneyMusicComposer } from '../src/art/JourneyMusicComposer';
import { JourneyCreativity } from '../src/art/JourneyCreativity';
import { BotHistory } from '../src/robot/botHistory';
import { defaultAbilities } from '../src/robot/abilities';
import { createRobotProfile, defaultFunctions } from '../src/robot/functions';
import { SoundEffect } from '../src/audio/SoundEffect';
import type { RobotEvent } from '../src/robot/robotState';

function events(): RobotEvent[] {
  return Array.from({ length: 20 }, (_, i) => ({ sequence: i + 1, botId: 1, runId: 1, time: i, runTime: i,
    type: i === 0 ? 'pickup' : i === 10 ? 'blocked' : i === 12 ? 'intervention' : 'step', state: 'following', edge: Math.floor(i / 5),
    position: { x: i, y: 0, z: Math.sin(i) * 8 }, data: i === 0 ? { kind: 'colour' } : { step: i } }));
}

function drawingTrace(painting: ProceduralPainting) {
  const trace: unknown[] = [];
  const context = new Proxy({}, {
    get(_target, property) {
      if (property === 'createRadialGradient') return (...args: unknown[]) => {
        trace.push([property, args]); return { addColorStop(...stops: unknown[]) { trace.push(['stop', stops]); } };
      };
      return (...args: unknown[]) => trace.push([property, args]);
    },
    set(_target, property, value) { trace.push([property, typeof value === 'object' ? 'gradient' : value]); return true; },
  }) as CanvasRenderingContext2D;
  PaintingRenderer.render(context, 480, 240, painting);
  return JSON.stringify(trace);
}

test('every painter uses a distinct brush language and replays its saved strokes exactly', () => {
  const languages = new Set<string>();
  for (const style of painterStyles) {
    const painting = new ProceduralPainting(42661, .7, style.id);
    for (const event of events()) painting.consume(event);
    const replay = new ProceduralPainting(painting.seed);
    replay.marks.push(...JSON.parse(JSON.stringify(painting.marks)));
    assert.equal(painting.marks[0]!.style, style.id);
    const trace = drawingTrace(painting);
    assert.equal(drawingTrace(replay), trace, `${style.label} replay`);
    languages.add(trace);
  }
  assert.equal(languages.size, painterStyles.length);
});

test('every musician produces a distinct valid reproducible score within its measure', () => {
  const phrases = new Set<string>();
  for (const style of musicianStyles) {
    const composer = new JourneyMusicComposer(style.id, 42661);
    const data = { at: 10, phrase: 2, steps: 20, edge: 3, blocked: false, harmony: false };
    const phrase = composer.compose(data);
    assert.deepEqual(new JourneyMusicComposer(style.id, 42661).compose(data), phrase);
    for (const entry of phrase) {
      assert.deepEqual(SoundEffect.fromScore(JSON.parse(JSON.stringify(entry.score))).toScore(), entry.score);
      for (const note of entry.score.notes) assert.ok(note.start >= 0 && note.start < composer.beats * 60 / composer.bpm);
    }
    phrases.add(JSON.stringify(phrase));
    const sad = composer.compose({ ...data, blocked: true, harmony: true });
    const harmony = sad.find(entry => entry.label!.includes('harmony'))!;
    const pitches = harmony.score.notes.map(note => note.midi);
    const root = 45 + ((42661 >>> 5) % 12) - 5;
    assert.ok(pitches.includes(root + 3));
    assert.ok(!pitches.includes(root + 4));
  }
  assert.equal(phrases.size, musicianStyles.length);
});

test('artist settings survive cached robot navigation, city records, and ability edits', () => {
  const history = new BotHistory(['Curie', 'Einstein'], () => .5);
  history.updateProfile(createRobotProfile(defaultAbilities(), defaultFunctions(), { painter: 'surrealist', musician: 'waltz' }));
  const first = structuredClone(history.current);
  history.next();
  history.updateProfile(createRobotProfile({ ...defaultAbilities(), speed: 75 }, defaultFunctions(), { painter: 'pop', musician: 'chiptune' }));
  assert.deepEqual(history.previous(), first);
  const creation = new JourneyCreativity(history.current);
  assert.deepEqual(creation.artist, first.profile.artist);
  assert.equal(first.record.metadata.creative!.artStyle, 'surrealist');
  creation.music = true;
  assert.equal(creation.advance(0).length > 0, true);
  const nextBar = 3 * 60 / creation.bpm;
  assert.deepEqual(creation.advance(nextBar - .2), []);
  assert.ok(creation.advance(nextBar - .1).length > 0);
  assert.deepEqual(creation.advance(nextBar), []);
  assert.deepEqual(normaliseArtist({ painter: 'unknown' as any, musician: 'unknown' as any }), { painter: 'impressionist', musician: 'melodic' });
});
