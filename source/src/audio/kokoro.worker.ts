import { KokoroTTS } from 'kokoro-js';
import { isSpeechVoice } from './speechVoices';
import type { SpeechVoice } from './speechVoices';
import { savedSpeech, saveSpeech, speechCacheKey } from './speechAudioCache';

let model: Promise<KokoroTTS> | undefined;
type Request = { id: number; text: string; voice: SpeechVoice; priority?: number };
const queue: Request[] = [];
let busy = false;
const cache = new Map<string, { audio: Float32Array; sampling_rate: number }>();
self.onmessage = ({ data }: MessageEvent<Request & { kind?: 'promote'; key?: string }>) => {
  if (data.kind === 'promote') {
    for (const request of queue) if (speechCacheKey(request.voice, request.text) === data.key) request.priority = Math.min(request.priority ?? 0, data.priority ?? 0);
    queue.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    return;
  }
  queue.push(data); queue.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  void drain();
};
async function drain() {
  if (busy) return;
  busy = true;
  while (queue.length) {
    const data = queue.shift()!;
    try {
      if (!isSpeechVoice(data.voice)) throw new Error('Unknown voice');
      const key = speechCacheKey(data.voice, data.text);
      let result = cache.get(key) ?? await savedSpeech(key);
      if (!result) {
        model ??= KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'wasm' });
        const tts = await model;
        const generated = await tts.generate(data.text, { voice: data.voice, speed: 1.03 });
        result = { audio: generated.audio, sampling_rate: generated.sampling_rate };
        await saveSpeech(key, result);
      }
      if (cache.size >= 256) cache.delete(cache.keys().next().value!);
      cache.set(key, result);
      self.postMessage({ id: data.id, voice: data.voice, ...result });
    } catch (error) {
      model = undefined;
      self.postMessage({ id: data.id, error: String(error) });
    }
  }
  busy = false;
}
