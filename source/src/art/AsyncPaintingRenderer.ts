import { PaintingRenderer, ProceduralPainting } from './ProceduralPainting';
import type { PaintingRequest, PaintingResponse } from './paintingWorkerProtocol';

type RequestData = PaintingRequest extends infer R ? R extends PaintingRequest ? Omit<R, 'id'> : never : never;

/** Worker paints; the main thread only copies completed bitmaps onto visible canvases. */
export class AsyncPaintingRenderer {
  private worker: Worker | null = null;
  private readonly fallback: PaintingRenderer;
  private readonly pending = new Map<number, { resolve: (result: PaintingResponse) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  private nextId = 0;
  private sentMarks = 0;
  private busy = false;
  private settled = false;
  private seconds = 0;
  private width = 0;
  private height = 0;
  private disposed = false;

  constructor(private readonly painting: ProceduralPainting) {
    this.fallback = new PaintingRenderer(painting);
    if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return;
    try {
      this.worker = new Worker(new URL('./painting.worker.ts', import.meta.url), { type: 'module', name: 'journey-painting' });
      this.worker.onmessage = ({ data }: MessageEvent<PaintingResponse>) => {
        const pending = this.pending.get(data.id);
        if (!pending) { if (data.type === 'bitmap') data.bitmap.close(); return; }
        clearTimeout(pending.timer); this.pending.delete(data.id);
        if (data.type === 'error') {
          pending.reject(new Error(data.message)); this.disableWorker(new Error(data.message));
        } else pending.resolve(data);
      };
      this.worker.onerror = event => { event.preventDefault(); this.disableWorker(new Error('Painting worker unavailable.')); };
      this.worker.onmessageerror = () => this.disableWorker(new Error('Painting worker message failed.'));
      void this.request({ type: 'init', seed: painting.seed }).catch(() => { /* fallback on the next frame */ });
    } catch { this.disableWorker(new Error('Painting worker unavailable.')); }
  }

  private request(data: RequestData): Promise<PaintingResponse> {
    return new Promise((resolve, reject) => {
      if (!this.worker || this.disposed) { reject(new Error('Painting worker unavailable.')); return; }
      const id = ++this.nextId;
      const timer = setTimeout(() => this.disableWorker(new Error('Painting worker timed out.')), 15000);
      this.pending.set(id, { resolve, reject, timer });
      try { this.worker.postMessage({ ...data, id }); }
      catch { this.disableWorker(new Error('Painting worker message failed.')); }
    });
  }

  private disableWorker(error: Error) {
    this.worker?.terminate(); this.worker = null; this.settled = false;
    for (const pending of this.pending.values()) { clearTimeout(pending.timer); pending.reject(error); }
    this.pending.clear();
  }

  frame(canvas: HTMLCanvasElement, seconds: number, immediate: boolean) {
    if (this.disposed) return;
    this.seconds = Math.min(0.2, this.seconds + Math.max(0, seconds));
    if (this.busy) return; // Backpressure: retain new marks, never queue live frames.
    if (this.settled && this.sentMarks === this.painting.marks.length && this.width === canvas.width && this.height === canvas.height) { this.seconds = 0; return; }
    const context = canvas.getContext('2d');
    if (!context) return;
    if (!this.worker) {
      this.fallback.frame(context, this.seconds, immediate);
      this.seconds = 0; this.sentMarks = this.painting.marks.length;
      this.width = canvas.width; this.height = canvas.height; this.settled = this.fallback.settled;
      return;
    }
    this.busy = true;
    const marks = this.painting.marks.slice(this.sentMarks);
    this.sentMarks = this.painting.marks.length;
    this.width = canvas.width; this.height = canvas.height;
    const elapsed = this.seconds; this.seconds = 0;
    void this.request({ type: 'frame', marks, width: canvas.width, height: canvas.height, seconds: elapsed, immediate }).then(result => {
      if (result.type !== 'bitmap') return;
      try {
        if (!this.disposed) {
          context.clearRect(0, 0, canvas.width, canvas.height); context.drawImage(result.bitmap, 0, 0);
          this.settled = result.settled;
        }
      } finally { result.bitmap.close(); }
    }).catch(() => { this.settled = false; }).finally(() => { this.busy = false; });
  }

  async snapshot(canvas: HTMLCanvasElement) {
    const painting = this.copyPainting();
    if (this.worker) {
      try {
        const result = await this.request({ type: 'snapshot', seed: painting.seed, marks: painting.marks, width: canvas.width, height: canvas.height });
        if (result.type === 'bitmap') {
          try { if (!this.disposed) canvas.getContext('2d')?.drawImage(result.bitmap, 0, 0); }
          finally { result.bitmap.close(); }
          return;
        }
      } catch { /* Render the same saved score with the fallback. */ }
    }
    if (this.disposed) return;
    const context = canvas.getContext('2d');
    if (context) PaintingRenderer.render(context, canvas.width, canvas.height, painting);
  }

  async exportPNG(width = 2400, height = 1200): Promise<Blob> {
    const painting = this.copyPainting(); // Freeze the score before asynchronous encoding.
    if (this.worker) {
      try {
        const result = await this.request({ type: 'export', seed: painting.seed, marks: painting.marks, width, height });
        if (result.type === 'blob') return result.blob;
      } catch { /* Unsupported worker rendering uses the same canvas fallback. */ }
    }
    if (this.disposed) throw new Error('Painting renderer was closed.');
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare the painting.');
    PaintingRenderer.render(context, width, height, painting);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not encode the painting.');
    return blob;
  }

  private copyPainting() {
    const copy = new ProceduralPainting(this.painting.seed);
    copy.marks.push(...structuredClone(this.painting.marks));
    return copy;
  }

  dispose() { this.disposed = true; this.disableWorker(new Error('Painting renderer was closed.')); }
}
