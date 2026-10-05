export const moonshineCacheName = 'moonshine-models-v1';
const manifestUrl = 'https://download.moonshine.ai/inclusive-city/tiny-streaming-en-wasm-0.1.5.json';
type ModelFile = { url: string; size?: number };

function modelFiles(manifest: string): ModelFile[] {
  const groups = JSON.parse(manifest).groups;
  if (!Array.isArray(groups) || !groups.length) throw new Error('Invalid speech model manifest.');
  return groups.flatMap(group => {
    if (!Array.isArray(group.files) || !group.files.length) throw new Error('Invalid speech model files.');
    return group.files.map((file: { name: string; url?: string; size?: number }) => {
      const url = file.url ?? `${group.base_url.replace(/\/+$/, '')}/${file.name.replace(/^\/+/, '')}`;
      if (!url.startsWith('https://download.moonshine.ai/')) throw new Error('Unexpected speech model host.');
      return { url, size: file.size };
    });
  });
}

async function catalogManifest(): Promise<string> {
  if (!crossOriginIsolated) throw new Error('Model setup needs cross-origin isolation. Please reload or open the app on a supported host.');
  const url = `${import.meta.env.BASE_URL}moonshine/index.js`;
  const moonshine: typeof import('@moonshine-ai/moonshine-wasm') = await import(/* @vite-ignore */ url);
  const module = await moonshine.loadMoonshineModule();
  return module.sttDependencies('en', String(moonshine.ModelArch.TinyStreaming), false);
}

async function savedFile(cache: Cache, file: ModelFile): Promise<boolean> {
  const response = await cache.match(file.url);
  if (!response?.ok) return false;
  const size = (await response.arrayBuffer()).byteLength;
  return size > 0 && (file.size === undefined || size === file.size);
}

/** Validate actual bytes; the manifest is an inventory, not a ready flag. */
export async function hasSavedMoonshineModel(storage: CacheStorage = globalThis.caches, resolveManifest: () => Promise<string> = catalogManifest): Promise<boolean> {
  try {
    const cache = await storage.open(moonshineCacheName);
    let manifest = await cache.match(manifestUrl);
    if (!manifest) {
      // Recognise models downloaded by the old voice-on-first-use flow too.
      if (!(await cache.keys()).length) return false;
      const text = await resolveManifest();
      modelFiles(text);
      await cache.put(manifestUrl, new Response(text));
      manifest = new Response(text);
    }
    for (const file of modelFiles(await manifest.text())) if (!await savedFile(cache, file)) return false;
    return true;
  } catch { return false; }
}

/** Use the runtime catalog and cache URLs so voice reuses the same files. */
export async function downloadMoonshineModel(
  onProgress: (fraction: number) => void, storage: CacheStorage = caches,
  fetchFile: typeof fetch = fetch, resolveManifest: () => Promise<string> = catalogManifest,
): Promise<void> {
  const download = async () => {
    const cache = await storage.open(moonshineCacheName);
    const manifest = await resolveManifest();
    const files = modelFiles(manifest);
    await cache.put(manifestUrl, new Response(manifest));
    const weights = files.map(file => file.size ?? 1);
    const total = weights.reduce((sum, size) => sum + size, 0);
    let completed = 0;
    onProgress(0);
    for (const [index, file] of files.entries()) {
      if (!await savedFile(cache, file)) {
        await cache.delete(file.url);
        const response = await fetchFile(file.url, { signal: AbortSignal.timeout(120000) });
        if (!response.ok) throw new Error(`Speech model download failed (${response.status}). Please retry.`);
        const chunks: Uint8Array[] = [];
        const reader = response.body?.getReader();
        let loaded = 0;
        if (reader) {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value); loaded += value.byteLength;
            if (file.size) onProgress(Math.min(.99, (completed + Math.min(loaded, file.size)) / total));
          }
        } else { const bytes = new Uint8Array(await response.arrayBuffer()); chunks.push(bytes); loaded = bytes.length; }
        if (!loaded || (file.size !== undefined && loaded !== file.size)) throw new Error('The speech model download is incomplete. Please retry.');
        const bytes = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        await cache.put(file.url, new Response(bytes));
      }
      completed += weights[index]!;
      onProgress(completed / total);
    }
    if (!await hasSavedMoonshineModel(storage, resolveManifest)) throw new Error('The speech model could not be saved. Please retry.');
  };
  if (typeof navigator !== 'undefined' && navigator.locks) await navigator.locks.request('inclusive-city-moonshine-setup', download);
  else await download();
}
