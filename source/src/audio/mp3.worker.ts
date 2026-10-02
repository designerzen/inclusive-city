import { encodeMp3 } from './mp3Encoding';

self.onmessage = ({ data }: MessageEvent<{ left: Float32Array; right: Float32Array; sampleRate: number }>) => {
  try {
    const bytes = encodeMp3(data.left, data.right, data.sampleRate);
    self.postMessage({ bytes }, { transfer: [bytes.buffer] });
  } catch { self.postMessage({ error: 'The song could not be encoded. Please try again.' }); }
};
