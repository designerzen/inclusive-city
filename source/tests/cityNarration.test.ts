import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { cityAlertNarration, upcomingCityNarration } from '../src/ui/cityNarration';
import type { PlannedJourney } from '../src/simulation/plannedJourney';
import { speechCacheKey } from '../src/audio/speechAudioCache';

test('every fixed action alert has a pre-generation entry', () => {
  const source = readFileSync(new URL('../src/ui/cityRobotAlert.ts', import.meta.url), 'utf8');
  for (const match of source.matchAll(/return\s*'([^'\n]+)'|^\s+[?:]\s*'([^'\n]+)'/gm)) {
    const text = match[1] ?? match[2];
    assert.ok(cityAlertNarration.includes(text as typeof cityAlertNarration[number]), `Uncached alert: ${text}`);
  }
});
test('route lookahead prepares crossing variants before arrival without changing journey state', () => {
  const journey = { edge: 0, route: ['a', 'b', 'c'], world: { streets: [
    { id: 'road', a: 'a', b: 'b', kind: 'ordinary' }, { id: 'crossing', a: 'b', b: 'c', kind: 'crossing' },
  ] } } as unknown as PlannedJourney;
  const before = JSON.stringify(journey);
  const lines = upcomingCityNarration(journey);
  assert.ok(lines.includes('The crossing button is too high.'));
  assert.ok(lines.includes('The crossing has no sound or touch signals.'));
  assert.equal(JSON.stringify(journey), before);
});
test('persistent audio keys separate voices and utterances', () => {
  assert.notEqual(speechCacheKey('bf_emma', 'Hello'), speechCacheKey('bm_fable', 'Hello'));
  assert.notEqual(speechCacheKey('bf_emma', 'Hello'), speechCacheKey('bf_emma', 'Goodbye'));
});
