import type { AccompanimentProvider, AccompanimentRequest, AccompanimentResponse, QuantizedNote } from './magentaProtocol';

/** Startup initializes from persistent storage; inference never initiates a download. */
export class MagentaAccompaniment implements AccompanimentProvider {
  private worker: Worker | null = null;
  private ready = false;
  private unavailable = false;
  private initialization: Promise<void> | null = null;
  private startup: { resolve(): void; reject(error: Error): void } | null = null;
  private readonly idle = new Set<() => void>();
  private readonly cache = new Map<string, QuantizedNote[]>();
  private readonly queue = new Map<string, AccompanimentRequest>();
  private active: string | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  initialize(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.initialization) return this.initialization;
    this.unavailable = false;
    const promise = new Promise<void>((resolve, reject) => {
      this.startup = { resolve, reject };
      try {
        this.createWorker();
        this.timer = setTimeout(() => this.fail('The saved music model took too long to start.'), 45000);
        this.worker!.postMessage({ type: 'initialize' });
      } catch { this.fail('This browser could not start the music model.'); }
    });
    this.initialization = promise;
    void promise.catch(() => { this.initialization = null; });
    return promise;
  }

  whenIdle(): Promise<void> {
    if (!this.active && !this.queue.size) return Promise.resolve();
    return new Promise(resolve => this.idle.add(resolve));
  }

  private createWorker() {
    if (this.worker) return;
    this.worker = new Worker(new URL('./magenta.worker.ts', import.meta.url), { type: 'module', name: 'magenta-accompaniment' });
    this.worker.onmessage = ({ data }: MessageEvent<AccompanimentResponse>) => {
      if (data.type === 'error') { this.fail(data.error); return; }
      clearTimeout(this.timer);
      if (data.type === 'ready') {
        this.ready = true; this.startup?.resolve(); this.startup = null;
      } else if (this.active && Array.isArray(data.notes)) {
        this.cache.set(this.active, data.notes);
        if (this.cache.size > 64) this.cache.delete(this.cache.keys().next().value!);
        this.active = null;
      } else { this.fail('The music model returned an invalid response.'); return; }
      this.pump();
    };
    this.worker.onerror = event => { event.preventDefault(); this.fail('The music model could not start.'); };
    this.worker.onmessageerror = () => this.fail('The music model could not respond.');
  }

  get(request: AccompanimentRequest) {
    const key = JSON.stringify(request), cached = this.cache.get(key);
    if (cached) return cached;
    if (!this.ready || this.unavailable || typeof Worker === 'undefined') return;
    if (key !== this.active && this.queue.size < 8) this.queue.set(key, request);
    this.pump();
  }

  private pump() {
    if (!this.active && !this.queue.size) { this.idle.forEach(resolve => resolve()); this.idle.clear(); }
    if (!this.ready || this.active || !this.queue.size || this.unavailable) return;
    try {
      const [key, request] = this.queue.entries().next().value!;
      this.queue.delete(key); this.active = key;
      this.timer = setTimeout(() => this.fail('Music generation timed out.'), 45000);
      this.worker!.postMessage({ ...request, type: 'generate' });
    } catch { this.fail('The music model could not respond.'); }
  }

  private fail(message: string) {
    this.startup?.reject(new Error(message)); this.startup = null;
    this.dispose();
  }

  dispose() {
    this.startup?.reject(new Error('Music model loading was cancelled.')); this.startup = null;
    clearTimeout(this.timer);
    this.worker?.terminate(); this.worker = null;
    this.queue.clear(); this.active = null; this.unavailable = true; this.ready = false;
    this.initialization = null;
    this.idle.forEach(resolve => resolve()); this.idle.clear();
  }
}

export const magentaAccompaniment = new MagentaAccompaniment();
import.meta.hot?.dispose(() => magentaAccompaniment.dispose());
