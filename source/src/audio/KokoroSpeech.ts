import type { NeuralSpeech } from './ScreenSpeech';
import { voiceLabel } from './speechVoices';
import type { SpeechVoice } from './speechVoices';
import { speechCacheKey } from './speechAudioCache';
import type { SpeechAudio } from './speechAudioCache';

/** Lazy worker: no model download until narration is requested. */
export class KokoroSpeech implements NeuralSpeech {
  private worker?: Worker;
  private id = 0;
  private cached = new Map<string, SpeechAudio>();
  private requests = new Map<string, Promise<SpeechAudio>>();
  private pending = new Map<number, { resolve: (audio: { audio: Float32Array; sampling_rate: number }) => void; reject: (error: Error) => void }>();
  constructor(private status: (message: string) => void = () => {}) {}
  preload(text: string, voice: SpeechVoice, priority = 2) { return this.generate(text, voice, priority).then(() => {}); }
  generate(text: string, voice: SpeechVoice = 'bf_emma', priority = 0): Promise<SpeechAudio> {
    const key = speechCacheKey(voice, text);
    const cached = this.cached.get(key); if (cached) return Promise.resolve(cached);
    const pending = this.requests.get(key);
    if (pending && priority > 0) {
      this.worker?.postMessage({ kind: 'promote', key, priority });
      return pending;
    }
    if (!this.worker) {
      this.status('Loading natural voice… The first use downloads about 92 MB.');
      this.worker = new Worker(new URL('./kokoro.worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => {
        const pending = this.pending.get(data.id); if (!pending) return;
        this.pending.delete(data.id);
        if (data.error) { this.status('Natural voice unavailable. Using the system voice.'); pending.reject(new Error(data.error)); }
        else { this.status(`Natural voice: ${voiceLabel(data.voice)}.`); pending.resolve(data); }
      };
      this.worker.onerror = () => { this.status('Natural voice unavailable. Using the system voice.'); this.dispose(); };
    }
    const request = new Promise<SpeechAudio>((resolve, reject) => {
      const id = ++this.id; this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ id, text, voice, priority });
    });
    this.requests.set(key, request);
    return request.then(audio => {
      if (this.cached.size >= 256) this.cached.delete(this.cached.keys().next().value!);
      this.cached.set(key, audio); this.requests.delete(key); return audio;
    }, error => { this.requests.delete(key); throw error; });
  }
  dispose() {
    this.worker?.terminate(); this.worker = undefined;
    for (const pending of this.pending.values()) pending.reject(new Error('Voice worker stopped'));
    this.pending.clear();
    this.requests.clear(); this.cached.clear();
  }
}
