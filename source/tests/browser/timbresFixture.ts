import { SoundEffect } from '../../src/audio/SoundEffect';
import { timbres } from '../../src/audio/timbres';
import { JourneyMusicComposer } from '../../src/art/JourneyMusicComposer';

async function check() {
  const results: { name: string; peak: number; rms: number }[] = [];
  const inspect = (name: string, buffer: AudioBuffer) => {
    let peak = 0, energy = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      for (const sample of buffer.getChannelData(channel)) {
        if (!Number.isFinite(sample)) throw new Error(`${name}: non-finite sample`);
        peak = Math.max(peak, Math.abs(sample)); energy += sample * sample;
      }
    }
    const rms = Math.sqrt(energy / (buffer.length * buffer.numberOfChannels));
    if (peak < .001 || peak > 1 || rms < .0001) throw new Error(`${name}: invalid level ${peak}, ${rms}`);
    results.push({ name, peak, rms });
  };
  for (const [name, voice] of Object.entries(timbres)) {
    // Overlapping chords exercise independent note sweeps and all unison layers.
    const effect = new SoundEffect({ ...voice, root: 60, intervals: [0, 4, 7], pattern: 'up', stepBeats: .15 });
    inspect(name, await SoundEffect.renderSequence([{ at: 0, score: effect.toScore() }], 24000));
  }
  // Compare identical pitches and envelopes: spectra must alter the actual PCM.
  const buffers: Float32Array[] = [];
  for (const partials of [timbres.piano.partials, timbres.reed.partials, timbres.organ.partials]) {
    const effect = new SoundEffect({ partials, intervals: [0], root: 60, echoGain: 0, vibratoDepth: 0 });
    buffers.push((await SoundEffect.renderSequence([{ at: 0, score: effect.toScore() }], 24000)).getChannelData(0));
  }
  for (let i = 1; i < buffers.length; i++) {
    let delta = 0;
    for (let n = 0; n < buffers[0]!.length; n++) delta += (buffers[0]![n]! - buffers[i]![n]!) ** 2;
    if (delta < .01) throw new Error('Distinct harmonic spectra rendered the same sound');
  }
  for (const style of ['classical', 'jazz', 'ambient', 'electronic', 'calypso', 'gamelan', 'irish', 'funk'] as const) {
    const score = new JourneyMusicComposer(style, 42, 50, { get: () => undefined }).preview(2);
    inspect(style, await SoundEffect.renderSequence(score, 24000));
  }
  return results;
}

check().then(results => {
  document.querySelector('#results')!.textContent = JSON.stringify({ passed: true, results });
}).catch(error => {
  document.querySelector('#results')!.textContent = JSON.stringify({ passed: false, error: String(error) });
});
