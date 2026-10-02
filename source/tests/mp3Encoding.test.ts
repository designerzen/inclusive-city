import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pcm16, encodeMp3 } from '../src/audio/mp3Encoding';

test('PCM conversion clips safely and preserves signed full-scale audio', () => {
  assert.deepEqual([...pcm16(new Float32Array([-2, -1, -.5, 0, .5, 1, 2, NaN]))], [-32768, -32768, -16384, 0, 16384, 32767, 32767, 0]);
});

test('MP3 contains stereo MPEG frames including partial input and the flushed tail', () => {
  const samples = Float32Array.from({ length: 44100 + 317 }, (_, i) => Math.sin(i * 2 * Math.PI * 440 / 44100) * .3);
  const bytes = encodeMp3(samples, samples, 44100);
  let offset = 0, frames = 0;
  while (offset < bytes.length) {
    assert.equal(bytes[offset], 255);
    assert.equal(bytes[offset + 1]! & 254, 250, 'MPEG-1 Layer III frame');
    assert.equal(bytes[offset + 2]! >> 4, 11, '192 kbps');
    assert.equal((bytes[offset + 2]! >> 2) & 3, 0, '44.1 kHz');
    assert.notEqual(bytes[offset + 3]! >> 6, 3, 'Stereo channels');
    offset += Math.floor(144 * 192000 / 44100) + ((bytes[offset + 2]! >> 1) & 1);
    frames++;
  }
  assert.equal(offset, bytes.length);
  assert.ok(frames * 1152 >= samples.length + 576, 'Includes the entire recording and encoder delay');
  assert.throws(() => encodeMp3(samples, new Float32Array(1), 44100), /equal/);
});
