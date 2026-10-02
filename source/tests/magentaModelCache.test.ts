import assert from 'node:assert/strict';
import { test } from 'node:test';
import { downloadMagentaModel, hasSavedMagentaModel, savedMagentaFetch } from '../src/audio/magentaModelCache';
import { magentaCheckpoint } from '../src/audio/magentaProtocol';

function fixture() {
  const files = new Map<string, Response>();
  const storage = { open: async () => ({
    match: async (url: string) => files.get(url)?.clone(),
    put: async (url: string, response: Response) => { files.set(url, new Response(await response.arrayBuffer(), { status: response.status })); },
    delete: async (url: string) => files.delete(url),
  }) } as unknown as CacheStorage;
  const requested: string[] = [];
  const fetchFile = (async (input: RequestInfo | URL) => {
    const url = String(input); requested.push(url);
    if (url.endsWith('config.json')) return Response.json({ type: 'MusicRNN', chordEncoder: 'PitchChordEncoder' });
    if (url.endsWith('weights_manifest.json')) return Response.json([{ paths: ['shard-a', 'shard-b'], weights: [] }]);
    return new Response(new Uint8Array([1, 2, 3]));
  }) as typeof fetch;
  return { files, storage, requested, fetchFile };
}

test('persistent model cache stores every file and repeat visits make zero downloads', async () => {
  const f = fixture();
  assert.equal(await hasSavedMagentaModel(f.storage), false);
  const progress: number[] = [];
  await downloadMagentaModel(p => progress.push(p.completed), f.storage, f.fetchFile);
  assert.equal(await hasSavedMagentaModel(f.storage), true);
  assert.equal(f.requested.length, 4);
  assert.equal(progress.at(-1), 4);
  await downloadMagentaModel(() => {}, f.storage, f.fetchFile);
  assert.equal(f.requested.length, 4, 'saved files never revalidate against the network');
  f.files.delete(`${magentaCheckpoint}/shard-b`);
  assert.equal(await hasSavedMagentaModel(f.storage), false, 'missing actual weights must not report ready');
  await downloadMagentaModel(() => {}, f.storage, f.fetchFile);
  assert.equal(f.requested.length, 5, 'repair downloads only the missing file');
});

test('interrupted downloads resume from saved files and do not mark incomplete models ready', async () => {
  const f = fixture(); let failed = false;
  const fetchFile = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).endsWith('shard-b') && !failed) { failed = true; throw new Error('offline'); }
    return f.fetchFile(input, init);
  }) as typeof fetch;
  await assert.rejects(downloadMagentaModel(() => {}, f.storage, fetchFile), /offline/);
  assert.equal(await hasSavedMagentaModel(f.storage), false);
  assert.equal(f.files.size, 3);
  await downloadMagentaModel(() => {}, f.storage, fetchFile);
  assert.equal(await hasSavedMagentaModel(f.storage), true);
  assert.equal(f.requested.length, 4);
});

test('inference reads saved files offline and cannot fetch missing files or external paths', async () => {
  const f = fixture(); await downloadMagentaModel(() => {}, f.storage, f.fetchFile);
  const original = globalThis.caches, originalFetch = globalThis.fetch;
  globalThis.caches = f.storage;
  globalThis.fetch = () => { assert.fail('inference tried to download'); };
  try {
    assert.equal((await savedMagentaFetch(`${magentaCheckpoint}/shard-a`)).ok, true);
    await assert.rejects(savedMagentaFetch(`${magentaCheckpoint}/missing`), /missing/);
    await assert.rejects(savedMagentaFetch('https://example.com/model'), /Unexpected/);
  } finally { globalThis.caches = original; globalThis.fetch = originalFetch; }
});

test('download refuses failed responses, invalid configuration, and escaped shard paths', async () => {
  const f = fixture();
  await assert.rejects(downloadMagentaModel(() => {}, f.storage, (async () => new Response('', { status: 503 })) as typeof fetch), /503/);
  await assert.rejects(downloadMagentaModel(() => {}, f.storage, (async () => Response.json({ type: 'wrong' })) as typeof fetch), /invalid/);
  assert.equal(f.files.size, 0);
  const fetchFile = (async (input: RequestInfo | URL) => String(input).endsWith('weights_manifest.json')
    ? Response.json([{ paths: ['https://example.com/model'] }]) : f.fetchFile(input)) as typeof fetch;
  await assert.rejects(downloadMagentaModel(() => {}, f.storage, fetchFile), /host/);
  assert.ok(!f.files.has(`${magentaCheckpoint}/weights_manifest.json`));
});
