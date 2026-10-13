import type { NeuralSpeech } from './ScreenSpeech';

/** Lazy worker: no model download until narration is requested. */
export class KokoroSpeech implements NeuralSpeech {
  private worker?: Worker;
  private id = 0;
  private pending = new Map<number, { resolve: (audio: { audio: Float32Array; sampling_rate: number }) => void; reject: (error: Error) => void }>();
  constructor(private status: (message: string) => void = () => {}) {}
  generate(text: string) {
    if (!this.worker) {
      this.status('Loading natural voice… The first use downloads about 92 MB.');
      this.worker = new Worker(new URL('./kokoro.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => {
        const pending = this.pending.get(data.id); if (!pending) return;
        this.pending.delete(data.id);
        if (data.error) { this.status('Natural voice unavailable. Using the system voice.'); pending.reject(new Error(data.error)); }
        else { this.status('Natural voice: Emma (British English).'); pending.resolve(data); }
      };
      this.worker.onerror = () => { this.status('Natural voice unavailable. Using the system voice.'); this.dispose(); };
    }
    return new Promise<{ audio: Float32Array; sampling_rate: number }>((resolve, reject) => {
      const id = ++this.id; this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ id, text });
    });
  }
  dispose() {
    this.worker?.terminate(); this.worker = undefined;
    for (const pending of this.pending.values()) pending.reject(new Error('Voice worker stopped'));
    this.pending.clear();
  }
}
