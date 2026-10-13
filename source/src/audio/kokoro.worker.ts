import { KokoroTTS } from 'kokoro-js';
import { isSpeechVoice } from './speechVoices';
import type { SpeechVoice } from './speechVoices';

let model: Promise<KokoroTTS> | undefined;
let queue = Promise.resolve();
const cache = new Map<string, { audio: Float32Array; sampling_rate: number }>();
self.onmessage = ({ data }: MessageEvent<{ id: number; text: string; voice: SpeechVoice }>) => {
  queue = queue.then(async () => {
    try {
      if (!isSpeechVoice(data.voice)) throw new Error('Unknown voice');
      const key = `${data.voice}:${data.text}`;
      let result = cache.get(key);
      if (!result) {
        model ??= KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'wasm' });
        const tts = await model;
        const generated = await tts.generate(data.text, { voice: data.voice, speed: 1.03 });
        result = { audio: generated.audio, sampling_rate: generated.sampling_rate };
        if (cache.size >= 32) cache.delete(cache.keys().next().value!);
        cache.set(key, result);
      }
      self.postMessage({ id: data.id, voice: data.voice, ...result });
    } catch (error) {
      model = undefined;
      self.postMessage({ id: data.id, error: String(error) });
    }
  });
};
