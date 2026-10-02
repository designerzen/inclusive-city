import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ArtworkTitleGenerator } from '../src/art/ArtworkTitleGenerator';

const journey = { steps: 80, discoveries: 4, improvements: 6, marks: [] };
test('title remixes two different artworks and replays through JSON', () => {
  const generator = new ArtworkTitleGenerator(4321);
  const title = generator.generate(journey);
  assert.deepEqual(generator.generate(structuredClone(journey)), title);
  assert.deepEqual(JSON.parse(JSON.stringify(title)), title);
  assert.notEqual(title.inspirations[0], title.inspirations[1]);
  assert.ok(title.text.length > 10); assert.ok(title.text.length < 90);
  assert.ok(!title.inspirations.includes(title.text));
});

test('robot identity and journey outcomes produce a broad title vocabulary', () => {
  const titles = new Set(Array.from({ length: 200 }, (_, seed) => new ArtworkTitleGenerator(seed).generate(journey).text));
  assert.ok(titles.size > 100);
  const generator = new ArtworkTitleGenerator(4321);
  const journeys = new Set(Array.from({ length: 40 }, (_, steps) => generator.generate({ ...journey, steps }).text));
  assert.ok(journeys.size > 25);
});
