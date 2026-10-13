import { KokoroTTS } from 'kokoro-js';

let model: Promise<KokoroTTS> | undefined;
let queue = Promise.resolve();
const cache = new Map<string, { audio: Float32Array; sampling_rate: number }>();
self.onmessage = ({ data }: MessageEvent<{ id: number; text: string }>) => {
  queue = queue.then(async () => {
    try {
      let result = cache.get(data.text);
      if (!result) {
        model ??= KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'wasm' });
        const tts = await model;
        const generated = await tts.generate(data.text, { voice: 'bf_emma', speed: 0.95 });
        result = { audio: generated.audio, sampling_rate: generated.sampling_rate };
        if (cache.size >= 32) cache.delete(cache.keys().next().value!);
        cache.set(data.text, result);
      }
      self.postMessage({ id: data.id, ...result });
    } catch (error) {
      model = undefined;
      self.postMessage({ id: data.id, error: String(error) });
    }
  });
};
