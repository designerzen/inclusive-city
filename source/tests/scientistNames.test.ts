import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseScientistSurnames } from '../src/robot/scientistNames';

const text = readFileSync(new URL('../src/data/scientist-surnames.txt', import.meta.url), 'utf8');

test('the separate text file contains over 1,000 unique valid surname entries', () => {
  const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  const names = parseScientistSurnames(text);
  assert.ok(names.length > 1000);
  assert.equal(names.length, lines.length);
  assert.equal(new Set(names.map(name => name.toLocaleLowerCase('en'))).size, names.length);
  for (const name of names) {
    assert.match(name, /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u);
    assert.ok(name.length <= 60);
  }
});

test('all shipped surnames have a Wikidata family-name source', () => {
  const csv = readFileSync(new URL('../src/data/scientist-surnames-sources.csv', import.meta.url), 'utf8');
  const sources = new Set(csv.split(/\r?\n/).flatMap(line => {
    const row = line.match(/^"([^"]+)","https:\/\/www\.wikidata\.org\/entity\/Q\d+"$/);
    return row ? [row[1]!.normalize('NFC').toLocaleLowerCase('en')] : [];
  }));
  for (const name of parseScientistSurnames(text)) assert.ok(sources.has(name.toLocaleLowerCase('en')), name);
});

test('parsing preserves compound surnames and handles text-file formatting', () => {
  assert.deepEqual(parseScientistSurnames('\uFEFFCurie\r\n\r\n# comment\r\n de Broglie \r\nCURIE\r\n'), ['CURIE', 'de Broglie']);
  assert.throws(() => parseScientistSurnames('Curie'));
  assert.throws(() => parseScientistSurnames(`Curie\n${'a'.repeat(61)}`));
});
