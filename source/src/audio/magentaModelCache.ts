import { magentaCheckpoint } from './magentaProtocol';

export const magentaCacheName = 'inclusive-city-magenta-improv-v1';
const configUrl = `${magentaCheckpoint}/config.json`;
const manifestUrl = `${magentaCheckpoint}/weights_manifest.json`;
export interface ModelDownloadProgress { completed: number; total: number }

function shardUrls(manifest: unknown): string[] {
  if (!Array.isArray(manifest) || !manifest.length) throw new Error('Invalid music model manifest.');
  return [...new Set(manifest.flatMap(group => {
    if (!group || !Array.isArray(group.paths) || !group.paths.length) throw new Error('Invalid music model files.');
    return group.paths.map((path: unknown) => {
      if (typeof path !== 'string') throw new Error('Invalid music model path.');
      const url = new URL(path, `${magentaCheckpoint}/`).href;
      if (!url.startsWith(`${magentaCheckpoint}/`)) throw new Error('Unexpected music model host.');
      return url;
    });
  }))];
}

/** Checks actual files, never a localStorage flag or the browser's expiring HTTP cache. */
export async function hasSavedMagentaModel(storage: CacheStorage = globalThis.caches): Promise<boolean> {
  try {
    const cache = await storage.open(magentaCacheName);
    const config = await cache.match(configUrl), manifest = await cache.match(manifestUrl);
    if (!config?.ok || !manifest?.ok) return false;
    const spec = await config.json();
    if (spec?.type !== 'MusicRNN' || spec.chordEncoder !== 'PitchChordEncoder') return false;
    const urls = shardUrls(await manifest.json());
    for (const url of urls) {
      const response = await cache.match(url);
      if (!response?.ok || !(await response.arrayBuffer()).byteLength) return false;
    }
    return true;
  } catch { return false; }
}

/** Every successful file is retained, including across failed/interrupted downloads. */
export async function downloadMagentaModel(
  onProgress: (progress: ModelDownloadProgress) => void,
  storage: CacheStorage = caches,
  fetchFile: typeof fetch = fetch,
) {
  const download = async () => {
    const cache = await storage.open(magentaCacheName);
    const save = async (url: string) => {
      const saved = await cache.match(url);
      if (saved?.ok && (await saved.clone().arrayBuffer()).byteLength) return saved;
      const response = await fetchFile(url, { signal: AbortSignal.timeout(60000) });
      if (!response.ok) throw new Error(`Music model download failed (${response.status}).`);
      // Fully store the response before reporting progress or opening the app.
      await cache.put(url, response.clone());
      return response;
    };
    onProgress({ completed: 0, total: 2 });
    const config = await save(configUrl);
    let spec;
    try { spec = await config.json(); }
    catch { await cache.delete(configUrl); throw new Error('The downloaded music model is invalid. Please retry.'); }
    if (spec?.type !== 'MusicRNN' || spec.chordEncoder !== 'PitchChordEncoder') {
      await cache.delete(configUrl); throw new Error('The downloaded music model is invalid.');
    }
    const manifest = await save(manifestUrl);
    let urls: string[];
    try { urls = shardUrls(await manifest.json()); }
    catch (error) { await cache.delete(manifestUrl); throw error; }
    const total = urls.length + 2;
    onProgress({ completed: 2, total });
    for (const [index, url] of urls.entries()) {
      await save(url);
      onProgress({ completed: index + 3, total });
    }
    if (!await hasSavedMagentaModel(storage)) throw new Error('The music model could not be saved. Please retry.');
  };
  // Serialize concurrent first launches so two tabs don't download the same files.
  if (typeof navigator !== 'undefined' && navigator.locks) {
    await navigator.locks.request(magentaCacheName, download);
  } else await download();
}

/** Inference is strictly cache-only: it cannot silently download or redownload weights. */
export async function savedMagentaFetch(input: RequestInfo | URL): Promise<Response> {
  const url = input instanceof Request ? input.url : String(input);
  if (!url.startsWith(`${magentaCheckpoint}/`)) throw new Error('Unexpected model request.');
  const response = await (await caches.open(magentaCacheName)).match(url);
  if (!response?.ok) throw new Error('The saved music model is missing. Reload to download it.');
  return response;
}
