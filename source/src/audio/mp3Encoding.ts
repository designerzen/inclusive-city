import { Mp3Encoder } from '@breezystack/lamejs';

export function pcm16(samples: Float32Array): Int16Array {
  return Int16Array.from(samples, sample => {
    const value = Math.max(-1, Math.min(1, Number.isFinite(sample) ? sample : 0));
    return Math.round(value * (value < 0 ? 32768 : 32767));
  });
}

/** Encode every sample, including the final partial frame and encoder tail. */
export function encodeMp3(left: Float32Array, right: Float32Array, sampleRate: number): Uint8Array<ArrayBuffer> {
  if (!left.length || left.length !== right.length) throw new Error('Stereo audio channels must have equal nonzero lengths.');
  const encoder = new Mp3Encoder(2, sampleRate, 192);
  const chunks: Uint8Array[] = [];
  for (let offset = 0; offset < left.length; offset += 1152) {
    chunks.push(new Uint8Array(encoder.encodeBuffer(pcm16(left.subarray(offset, offset + 1152)), pcm16(right.subarray(offset, offset + 1152)))));
  }
  chunks.push(new Uint8Array(encoder.flush()));
  const result = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
