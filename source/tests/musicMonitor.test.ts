import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeMusicMonitor } from '../src/app/musicMonitorPreferences';
import { musicNotation } from '../src/ui/musicNotation';
import { CityMusicCues } from '../src/ui/cityMusicCues';
import { SoundEffect } from '../src/audio/SoundEffect';

test('monitor is opt-in and invalid saved choices recover to supported defaults', () => {
  assert.deepEqual(normalizeMusicMonitor(null), { enabled: false, mode: 'notes' });
  assert.deepEqual(normalizeMusicMonitor({ enabled: 'on', mode: 'unknown' }), { enabled: false, mode: 'notes' });
  assert.deepEqual(normalizeMusicMonitor({ enabled: true, mode: 'notation' }), { enabled: true, mode: 'notation' });
});

test('notation receives scheduled pitches, durations and simultaneous onsets at playback time', () => {
  const cues = new CityMusicCues();
  const score = new SoundEffect().toScore();
  score.notes = [{ midi: 60, start: 0, duration: .5 }, { midi: 64, start: 0, duration: 1 }, { midi: 48, start: 1, duration: 2 }];
  cues.add([{ at: 2, score }]);
  assert.deepEqual(cues.advance(1.9).onsets, []);
  const chord = cues.advance(2).onsets;
  assert.deepEqual(chord, [{ at: 2, midi: 60, duration: .5 }, { at: 2, midi: 64, duration: 1 }]);
  const svg = musicNotation(chord, 120);
  assert.match(svg, /Recent notes: C4, E4/);
  assert.match(svg, /cx="62" cy="88"/); // Middle C ledger line.
  assert.match(svg, /cx="62" cy="78"/); // E4 at the same chord position.
  assert.deepEqual(cues.advance(3).onsets, [{ at: 3, midi: 48, duration: 2 }]);
});

test('rolling notation keeps twelve latest onsets and fits ledger lines for extreme pitches', () => {
  const notes = Array.from({ length: 14 }, (_, at) => ({ at, midi: at === 13 ? 127 : 0, duration: .2 }));
  const svg = musicNotation(notes, 120);
  assert.equal((svg.match(/<ellipse/g) ?? []).length, 12);
  const [, top, height] = svg.match(/viewBox="0 ([-\d]+) 640 (\d+)"/)!;
  assert.ok(Number(top) < -107 && Number(top) + Number(height) > 283, 'both extreme notes fit inside the staff viewport');
});
