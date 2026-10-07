import { AudioMix } from './AudioMix';
import { SoundEffect } from './SoundEffect';
import type { SoundSequenceEntry } from './SoundEffect';
import { musicDuration } from '../art/finishedJourney';

/** Export the frozen arrangement, independent of live volume, mute or playback. */
export async function exportSongMp3(score: readonly SoundSequenceEntry[], signal?: AbortSignal): Promise<Blob> {
  signal?.throwIfAborted();
  if (!score.length) throw new Error('This journey has no song to download.');
  const sampleRate = 44100;
  const context = new OfflineAudioContext(2, Math.ceil(musicDuration(score) * sampleRate), sampleRate);
  const master = context.createGain(); master.gain.value = .55;
  master.connect(context.destination);
  const mix = new AudioMix(context, master);
  const origin = score[0]!.at;
  SoundEffect.scheduleSequence(context, master, score.map(entry => ({ ...entry, at: entry.at - origin })), 0, entry => mix.input(entry.label));
  const audio = await context.startRendering().finally(() => mix.dispose());
  signal?.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./mp3.worker.ts', import.meta.url), { type: 'module', name: 'song-mp3-export' });
    const finish = () => { worker.terminate(); signal?.removeEventListener('abort', abort); };
    const abort = () => { finish(); reject(new DOMException('Song export cancelled.', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    worker.onmessage = ({ data }: MessageEvent<{ bytes?: Uint8Array<ArrayBuffer>; error?: string }>) => {
      finish();
      if (data.bytes) resolve(new Blob([data.bytes], { type: 'audio/mpeg' }));
      else reject(new Error(data.error ?? 'Song export failed.'));
    };
    worker.onerror = () => { finish(); reject(new Error('Song export failed. Please try again.')); };
    worker.onmessageerror = () => { finish(); reject(new Error('Song export failed. Please try again.')); };
    const left = audio.getChannelData(0).slice(), right = audio.getChannelData(1).slice();
    worker.postMessage({ left, right, sampleRate }, [left.buffer, right.buffer]);
  });
}
