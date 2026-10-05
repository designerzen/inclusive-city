import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadMoonshineModel, hasSavedMoonshineModel } from '../src/audio/moonshineModelCache';

function fixture() {
  const files = new Map<string, Response>();
  const storage = { open: async () => ({
    match: async (url: string) => files.get(url)?.clone(),
    put: async (url: string, response: Response) => { files.set(url, new Response(await response.arrayBuffer())); },
    delete: async (url: string) => files.delete(url),
    keys: async () => [...files.keys()].map(url => new Request(url)),
  }) } as unknown as CacheStorage;
  const urls = ['https://download.moonshine.ai/test/a', 'https://download.moonshine.ai/test/b'];
  const manifest = async () => JSON.stringify({ groups: [{ files: urls.map(url => ({ url, name: url.split('/').at(-1), size: 3 })) }] });
  const requested: string[] = [];
  const fetchFile = (async (input: RequestInfo | URL) => {
    requested.push(String(input)); return new Response(new Uint8Array([1, 2, 3]));
  }) as typeof fetch;
  return { files, storage, urls, manifest, requested, fetchFile };
}

test('speech setup validates saved files, skips downloads and repairs only missing bytes', async () => {
  const f = fixture();
  assert.equal(await hasSavedMoonshineModel(f.storage, f.manifest), false);
  const progress: number[] = [];
  await downloadMoonshineModel(p => progress.push(p), f.storage, f.fetchFile, f.manifest);
  assert.equal(await hasSavedMoonshineModel(f.storage, async () => { throw new Error('must not load runtime'); }), true);
  assert.equal(progress.at(-1), 1);
  assert.ok(progress.every((value, index) => !index || value >= progress[index - 1]!));
  await downloadMoonshineModel(() => {}, f.storage, f.fetchFile, f.manifest);
  assert.equal(f.requested.length, 2);
  f.files.set(f.urls[1]!, new Response(new Uint8Array([1])));
  assert.equal(await hasSavedMoonshineModel(f.storage, f.manifest), false);
  await downloadMoonshineModel(() => {}, f.storage, f.fetchFile, f.manifest);
  assert.equal(f.requested.length, 3);
});

test('interrupted speech downloads keep completed files and resume on retry', async () => {
  const f = fixture();
  await assert.rejects(downloadMoonshineModel(() => {}, f.storage, (async input => {
    if (String(input) === f.urls[1]) throw new Error('offline');
    return f.fetchFile(input);
  }) as typeof fetch, f.manifest), /offline/);
  assert.equal(await hasSavedMoonshineModel(f.storage, f.manifest), false);
  await downloadMoonshineModel(() => {}, f.storage, f.fetchFile, f.manifest);
  assert.equal(f.requested.length, 2);
  assert.equal(await hasSavedMoonshineModel(f.storage, f.manifest), true);
});

test('speech caches from the previous voice flow are recognised without downloading', async () => {
  const f = fixture();
  for (const url of f.urls) f.files.set(url, new Response(new Uint8Array([1, 2, 3])));
  assert.equal(await hasSavedMoonshineModel(f.storage, f.manifest), true);
  assert.equal(f.requested.length, 0);
});

test('failed, empty and truncated speech responses never mark setup complete', async () => {
  for (const response of [new Response('', { status: 503 }), new Response(''), new Response('x')]) {
    const f = fixture();
    await assert.rejects(downloadMoonshineModel(() => {}, f.storage, (async () => response.clone()) as typeof fetch, f.manifest));
    assert.equal(await hasSavedMoonshineModel(f.storage, f.manifest), false);
  }
});
