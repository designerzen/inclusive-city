import { audioSpectrum } from './AudioSpectrum';

export const startVoices = ['ajay', 'craig', 'gosia', 'helen', 'janet', 'kanchan', 'kate', 'nick', 'nicola', 'paul'] as const;
const storageKey = 'inclusive-city-last-start-voice';

/** Single-sentence edits of the original recordings, with no consecutive repeats. */
export class StartVoice {
  private last: string | null = null;
  private audio: HTMLAudioElement | null = null;
  private finish: (() => void) | null = null;
  private context: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  constructor() {
    try { this.last = localStorage.getItem(storageKey); } catch { /* Session selection still works. */ }
  }
  play(baseUrl: string, volume: number): Promise<void> {
    this.stop();
    const choices = startVoices.filter(voice => voice !== this.last);
    const voice = choices[Math.floor(Math.random() * choices.length)]!;
    this.last = voice;
    try { localStorage.setItem(storageKey, voice); } catch { /* Session selection still works. */ }
    return new Promise(resolve => {
      // A missing file or stalled media request must not block entry to the app.
      const timeout = window.setTimeout(() => this.stop(), 8000);
      this.finish = () => { window.clearTimeout(timeout); resolve(); };
      try {
        const audio = new Audio(`${baseUrl}assets/audio/intro/${voice}.mp3`);
        this.audio = audio;
        audio.volume = volume;
        if (typeof AudioContext !== 'undefined') {
          this.context ??= new AudioContext();
          this.source = this.context.createMediaElementSource(audio);
          this.source.connect(audioSpectrum.output(this.context));
          void this.context.resume().catch(() => this.stop());
        }
        audio.onended = audio.onerror = () => this.stop();
        void audio.play().catch(() => { if (this.audio === audio) this.stop(); });
      } catch { this.stop(); }
    });
  }
  setVolume(volume: number) { if (this.audio) this.audio.volume = volume; if (!volume) this.stop(); }
  stop() {
    this.source?.disconnect(); this.source = null;
    if (this.audio) {
      this.audio.onended = this.audio.onerror = null;
      this.audio.pause();
      this.audio = null;
    }
    const finish = this.finish; this.finish = null; finish?.();
  }
  dispose() { this.stop(); if (this.context) audioSpectrum.release(this.context); void this.context?.close(); }
}

