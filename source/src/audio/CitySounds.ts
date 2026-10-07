import { AudioMix, mixTailSeconds, mixLatencySeconds } from './AudioMix';
import { SoundEffect } from './SoundEffect';
import { seekSequence } from './seekSequence';
import type { SoundSequenceEntry } from './SoundEffect';
import { buttonSound, interactionSound, robotMoodSound } from './soundPresets';
import type { ButtonSound, InteractionSound, RobotMood } from './soundPresets';

export interface MusicPlayback { elapsed(): number; stop(): void }
import { CityMidiOutput } from './MidiOutput';

/** Live controls affect only output; recorded scores stay complete even while muted. */
export class CitySounds {
  readonly midi = new CityMidiOutput();
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private mix: AudioMix | null = null;
  private readonly events: SoundSequenceEntry[] = [];
  private readonly origin = performance.now();
  private volume = 0.55;
  private muted = false;
  private disposed = false;
  private capturingVoice = false;
  private active = new Set<ReturnType<SoundEffect['schedule']>>();
  private musicClock: { audio: number; wall: number; offset: number; bpm: number } | null = null;

  /** One epoch for the song, live batches and every interaction voice. */
  startMusic(bpm: number, offset = 0) {
    if (!Number.isFinite(bpm) || bpm < 20 || bpm > 400) throw new RangeError('Invalid music tempo.');
    this.stop();
    this.musicClock = { audio: (this.context?.currentTime ?? 0) + .05,
      wall: performance.now() / 1000 + .05, offset, bpm };
  }

  musicTime(bpm: number, offset = 0) {
    if (!this.musicClock) this.startMusic(bpm, offset);
    const clock = this.musicClock!;
    return clock.offset + Math.max(0, this.context
      ? this.context.currentTime - clock.audio : performance.now() / 1000 - clock.wall);
  }

  private lastTune = -Infinity;
  private lastCrossingBeep = -Infinity;

  get supported() { return typeof AudioContext !== 'undefined'; }
  get isMuted() { return this.muted; }
  get sequence(): SoundSequenceEntry[] { return structuredClone(this.events); }

  /** Must be called directly in a user gesture. No audio context during page load. */
  unlock() {
    if (!this.supported || this.disposed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain(); this.master.gain.value = this.muted || this.capturingVoice ? 0 : this.volume;
        this.master.connect(this.context.destination);
        this.mix = new AudioMix(this.context, this.master);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Sound availability never blocks city interactions. */ }
  }

  private updateGain() {
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.muted || this.capturingVoice ? 0 : this.volume, this.context.currentTime, 0.02);
  }
  setVoiceCapture(value: boolean) { this.capturingVoice = value; if (value) this.midi.stop(); this.updateGain(); }
  setMuted(value: boolean) { this.muted = value; if (value) this.midi.stop(); this.updateGain(); }
  setVolume(value: number) { if (Number.isFinite(value)) this.volume = Math.min(1, Math.max(0, value)); if (!this.volume) this.midi.stop(); this.updateGain(); }

  private schedule(sequence: readonly SoundSequenceEntry[], when: number) {
    const context = this.context!;
    const audio = SoundEffect.scheduleSequence(context, this.master!, sequence, when, entry => this.mix?.input(entry.label) ?? this.master!);
    let stopped = false;
    let midi: { stop(): void } | undefined;
    const startMidi = () => {
      if (stopped || this.disposed || this.muted || this.capturingVoice || document.hidden || context.state !== 'running') return;
      const timestamp = context.getOutputTimestamp?.();
      const start = timestamp?.contextTime && timestamp.performanceTime
        ? timestamp.performanceTime + (when - timestamp.contextTime) * 1000
        : performance.now() + (when - context.currentTime) * 1000;
      midi = this.midi.schedule(sequence, start + (this.mix ? mixLatencySeconds * 1000 : 0), this.volume);
    };
    if (context.state === 'running') startMidi();
    else void context.resume().then(startMidi).catch(() => {});
    return { stop: () => { stopped = true; audio.stop(); midi?.stop(); } };
  }

  play(effect: SoundEffect, label: string, delay = 0) {
    if (this.disposed) return;
    if (!Number.isFinite(delay) || delay < 0) return;
    const wallNow = performance.now() / 1000;
    const now = this.context?.currentTime ?? wallNow;
    const clock = this.musicClock;
    const step = 60 / (clock?.bpm ?? 120) / 4;
    const epoch = clock ? (this.context ? clock.audio : clock.wall) - clock.offset : 0;
    const when = epoch + Math.ceil((now + .05 + delay - epoch) / step) * step;
    const score = effect.toScore();
    // Quantize the whole motif, including repeats and echoes, not just its first note.
    score.notes = score.notes.map(note => ({ ...note,
      start: Math.round(note.start / .125) * step,
      duration: Math.max(.001, Math.round(note.duration / .125) * step) }));
    score.voice.echoTime = Math.min(Math.floor(2 / step), Math.max(1, Math.round(score.voice.echoTime / .125))) * step;
    this.events.push({ at: wallNow - this.origin / 1000 + (when - now), score, label });
    if (!this.context || !this.master || this.context.state !== 'running' || document.hidden || this.muted || this.capturingVoice) return;
    if (this.active.size >= 12) return;
    const handle = this.schedule([{ at: 0, score, label }], when);
    this.active.add(handle);
    setTimeout(() => this.active.delete(handle), (when - now + SoundEffect.fromScore(score).duration + .1) * 1000);
  }

  performLive(sequence: readonly SoundSequenceEntry[]) {
    if (!this.musicClock) return;
    return this.performAt(sequence, 0, 0, this.musicClock.audio - this.musicClock.offset);
  }

  perform(sequence: readonly SoundSequenceEntry[], origin = sequence[0]?.at ?? 0, offset = 0, bpm = 120): MusicPlayback | undefined {
    if (!sequence.length) return;
    this.startMusic(bpm, offset);
    return this.performAt(sequence, origin, offset);
  }

  private performAt(sequence: readonly SoundSequenceEntry[], origin = sequence[0]?.at ?? 0, offset = 0, absoluteWhen?: number): MusicPlayback | undefined {
    if (this.disposed || !sequence.length || !this.context || !this.master || this.muted || document.hidden) return;
    const context = this.context;
    const when = absoluteWhen ?? this.musicClock?.audio ?? context.currentTime + 0.05;
    // Keep future song entries as score data, just as live city music does.
    // Creating every oscillator up front overwhelms the audio graph on long journeys.
    const duration = Math.max(...sequence.map(entry => Math.max(0, entry.at - origin) + SoundEffect.fromScore(entry.score).duration)) + (this.mix ? mixTailSeconds + mixLatencySeconds : 0);
    const startAt = Math.min(duration, Math.max(0, offset));
    const remaining = startAt > 0 ? seekSequence(sequence, startAt, origin)
      : sequence.map(entry => ({ ...entry, at: Math.max(0, entry.at - origin) }));
    const entries = remaining.map(entry => {
      const effect = SoundEffect.fromScore(entry.score);
      return { ...entry, score: effect.toScore(), duration: effect.duration };
    }).sort((a, b) => a.at - b.at);
    const pending = new Map<ReturnType<CitySounds['schedule']>, number>();
    let stopped = false, elapsed = startAt, cursor = 0;
    const pump = () => {
      if (stopped || context.state !== 'running' || document.hidden) return;
      const now = context.currentTime, base = Math.max(when, now);
      for (const [audio, end] of pending) if (end <= now) pending.delete(audio);
      const batch: SoundSequenceEntry[] = [];
      let batchEnd = base;
      while (cursor < entries.length && when + entries[cursor]!.at <= now + .15) {
        const entry = entries[cursor++]!;
        const start = when + entry.at;
        const end = start + entry.duration;
        // Preserve future onsets inside a late chord; never move missed notes to now.
        const notes = entry.score.notes.filter(note => start + note.start >= now + .005);
        if (!notes.length) continue;
        const first = Math.min(...notes.map(note => note.start));
        batch.push({ ...entry, at: start + first - base,
          score: { ...entry.score, notes: notes.map(note => ({ ...note, start: note.start - first })) } });
        batchEnd = Math.max(batchEnd, Math.max(base, start) + end - start);
      }
      if (batch.length) pending.set(this.schedule(batch, base), batchEnd);
      if (now >= when + duration - startAt) { clearInterval(timer); this.active.delete(handle); }
    };
    const timer = setInterval(pump, 25);
    if (context.state === 'suspended') void context.resume().catch(() => {});
    const handle: MusicPlayback = {
      elapsed: () => {
        if (!stopped && context.state === 'running') {
          const timestamp = context.getOutputTimestamp?.();
          const outputTime = timestamp?.contextTime && timestamp.performanceTime
            ? Math.min(context.currentTime, timestamp.contextTime + (performance.now() - timestamp.performanceTime) / 1000)
            : context.currentTime - (context.outputLatency ?? context.baseLatency ?? 0);
          elapsed = Math.max(elapsed, Math.min(duration, startAt + Math.max(0, outputTime - when - (this.mix ? mixLatencySeconds : 0))));
        }
        return elapsed;
      },
      stop: () => { handle.elapsed(); stopped = true; clearInterval(timer); pending.forEach((_, audio) => audio.stop()); pending.clear(); this.active.delete(handle); },
    };
    this.active.add(handle);
    pump();
    return handle;
  }
  /** Look ahead on the audio clock; keep the loop separate from recorded journey events. */
  loop(sequence: readonly SoundSequenceEntry[], seconds: number, bpm = 120) {
    if (!Number.isFinite(seconds) || seconds <= 0) throw new RangeError('Invalid loop duration.');
    if (!this.musicClock || this.musicClock.bpm !== bpm) this.startMusic(bpm);
    const clock = this.musicClock!;
    const epoch = clock.audio - clock.offset;
    let cycle = Math.max(0, Math.ceil(((this.context?.currentTime ?? 0) + .05 - epoch) / seconds - 1e-8));
    const handles = new Set<MusicPlayback>();
    let stopped = false;
    const pump = () => {
      if (stopped || !this.context || this.disposed || document.hidden || this.context.state !== 'running') return;
      const now = this.context.currentTime;
      // Keep the original phase after a stalled timer instead of restarting the beat.
      cycle = Math.max(cycle, Math.floor((now - epoch) / seconds));
      if (epoch + cycle * seconds > now + .15) return;
      const when = epoch + cycle++ * seconds;
      const handle = this.performAt(sequence, 0, 0, when);
      if (handle) {
        handles.add(handle);
        const tail = Math.max(...sequence.map(entry => entry.at + SoundEffect.fromScore(entry.score).duration));
        setTimeout(() => handles.delete(handle), (when - now + tail + .1) * 1000);
      }
    };
    pump();
    const timer = setInterval(pump, 25);
    const control = { stop: () => { stopped = true; clearInterval(timer); handles.forEach(handle => handle.stop()); handles.clear(); this.active.delete(control); } };
    this.active.add(control);
    return control.stop;
  }
  interaction(name: InteractionSound) { this.play(interactionSound(name), `interaction:${name}`); }
  button(name: ButtonSound, active = true) { this.play(buttonSound(name, active), `button:${name}:${active ? 'active' : 'inactive'}`); }
  mood(mood: RobotMood) { this.play(robotMoodSound(mood), `mood:${mood}`); }
  collision(speed = 1, kind = 'robot') {
    this.play(new SoundEffect({ root: kind === 'robot' ? 60 : 48, intervals: [0, 7, 3], pattern: 'down',
      waveform: 'triangle', stepBeats: .06, durationBeats: .12, attack: .003, release: .08,
      gain: .08 + Math.min(3, Math.max(0, Number.isFinite(speed) ? speed : 1)) * .025, echoGain: 0 }), `collision:${kind}`);
  }
  crossingBeep() {
    if (performance.now() - this.lastCrossingBeep < 500) return;
    this.lastCrossingBeep = performance.now();
    this.play(new SoundEffect({ root: 84, intervals: [0], waveform: 'sine', gain: .13, durationBeats: .12, release: .03, echoGain: 0 }), 'crossing:green-beeper');
  }
  tune(value: number) {
    if (performance.now() - this.lastTune < 85) return;
    this.lastTune = performance.now();
    const scale = [0, 2, 4, 7, 9, 12];
    const index = Math.round(Math.min(100, Math.max(0, value)) / 100 * (scale.length - 1));
    this.play(interactionSound('tune', { root: 60 + scale[index]! }), 'interaction:tune');
  }
  stop() { this.musicClock = null; this.active.forEach(handle => handle.stop()); this.active.clear(); this.midi.stop(); if (this.disposed) this.mix?.dispose(); else this.mix?.reset(); }
  dispose() { this.disposed = true; this.stop(); this.mix?.dispose(); this.mix = null; this.midi.dispose(); void this.context?.close().catch(() => {}); }
}
