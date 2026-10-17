import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudioSpectrum } from '../src/audio/AudioSpectrum';
import { robotInitials } from '../src/robot/robotIdentity';

test('audible outputs share one analyser per context and spectrum follows silence, suspension and disposal', () => {
  const spectrum = new AudioSpectrum();
  let level = 0, reads = 0, creates = 0, disconnected = false;
  const destination = {};
  const node = { fftSize: 0, frequencyBinCount: 1024, connect(target: unknown) { assert.equal(target, destination); },
    disconnect() { disconnected = true; }, getByteFrequencyData(data: Uint8Array) { reads++; data.fill(level); } };
  const context = { state: 'running', sampleRate: 48000, destination, createAnalyser() { creates++; return node; } };
  assert.equal(spectrum.output(context as unknown as AudioContext), node);
  assert.equal(spectrum.output(context as unknown as AudioContext), node);
  assert.equal(creates, 1);
  assert.equal(node.fftSize, 2048);
  assert.ok(spectrum.read(0).every(value => value === 0));
  level = 255;
  assert.ok(spectrum.read(40).every(value => value === 1));
  spectrum.read(41); assert.equal(reads, 2); // Multiple robots reuse the same FFT frame.
  context.state = 'suspended';
  assert.ok(spectrum.read(80).every(value => value === 0));
  context.state = 'running'; level = 0;
  assert.ok(spectrum.read(120).every(value => value === 0));
  spectrum.release(context as unknown as AudioContext);
  assert.equal(disconnected, true);
  assert.ok(spectrum.read(160).every(value => value === 0));
});

test('robot emblems use name initials and retain Unicode letters', () => {
  assert.equal(robotInitials('Ada Lovelace'), 'AL');
  assert.equal(robotInitials('  Marie-Skłodowska Curie '), 'MSC');
  assert.equal(robotInitials("Mary O’Connor"), 'MO');
  assert.equal(robotInitials('Émile'), 'É');
  assert.equal(robotInitials(''), 'AB');
});
