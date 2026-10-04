import { SoundEffect } from './SoundEffect';
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
  private readonly events: SoundSequenceEntry[] = [];
  private readonly origin = performance.now();
  private volume = 0.55;
  private muted = false;
  private disposed = false;
  private active = new Set<ReturnType<SoundEffect['schedule']>>();
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
        this.master = this.context.createGain(); this.master.gain.value = this.muted ? 0 : this.volume;
        const limiter = this.context.createDynamicsCompressor();
        limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 12;
        limiter.attack.value = 0.003; limiter.release.value = 0.15;
        this.master.connect(limiter); limiter.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') void this.context.resume().catch(() => {});
    } catch { /* Sound availability never blocks city interactions. */ }
  }

  private updateGain() {
    if (this.context && this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, 0.02);
  }
  setMuted(value: boolean) { this.muted = value; if (value) this.midi.stop(); this.updateGain(); }
  setVolume(value: number) { if (Number.isFinite(value)) this.volume = Math.min(1, Math.max(0, value)); if (!this.volume) this.midi.stop(); this.updateGain(); }

  private schedule(sequence: readonly SoundSequenceEntry[], when: number) {
    const context = this.context!;
    const audio = SoundEffect.scheduleSequence(context, this.master!, sequence, when);
    let stopped = false;
    let midi: { stop(): void } | undefined;
    const startMidi = () => {
      if (stopped || this.disposed || this.muted || document.hidden || context.state !== 'running') return;
      const timestamp = context.getOutputTimestamp?.();
      const start = timestamp?.contextTime && timestamp.performanceTime
        ? timestamp.performanceTime + (when - timestamp.contextTime) * 1000
        : performance.now() + (when - context.currentTime) * 1000;
      midi = this.midi.schedule(sequence, start, this.volume);
    };
    if (context.state === 'running') startMidi();
    else void context.resume().then(startMidi).catch(() => {});
    return { stop: () => { stopped = true; audio.stop(); midi?.stop(); } };
  }

  play(effect: SoundEffect, label: string, delay = 0) {
    if (this.disposed) return;
    this.events.push({ at: (performance.now() - this.origin) / 1000 + delay, score: effect.toScore(), label });
    if (!this.context || !this.master || this.context.state === 'closed' || document.hidden || this.muted) return;
    // Bound polyphony during rapid input. The full score remains recorded.
    if (this.active.size >= 12) return;
    const handle = this.schedule([{ at: 0, score: effect.toScore(), label }], this.context.currentTime + 0.015 + delay);
    this.active.add(handle);
    // This timer only releases bookkeeping; every audible note uses the audio clock.
    setTimeout(() => this.active.delete(handle), (delay + effect.duration + 0.1) * 1000);
  }
  perform(sequence: readonly SoundSequenceEntry[], origin = sequence[0]?.at ?? 0): MusicPlayback | undefined {
    if (this.disposed || !sequence.length || !this.context || !this.master || this.muted || document.hidden) return;
    const context = this.context;
    const when = context.currentTime + 0.05;
    const audio = this.schedule(sequence.map(entry => ({ ...entry, at: Math.max(0, entry.at - origin) })), when);
    const duration = Math.max(...sequence.map(entry => entry.at - origin + SoundEffect.fromScore(entry.score).duration));
    let stopped = false, elapsed = 0;
    const handle: MusicPlayback = {
      elapsed: () => {
        if (!stopped && context.state === 'running') {
          const timestamp = context.getOutputTimestamp?.();
          const outputTime = timestamp?.contextTime && timestamp.performanceTime
            ? Math.min(context.currentTime, timestamp.contextTime + (performance.now() - timestamp.performanceTime) / 1000)
            : context.currentTime - (context.outputLatency ?? context.baseLatency ?? 0);
          elapsed = Math.max(elapsed, Math.min(duration, Math.max(0, outputTime - when)));
        }
        return elapsed;
      },
      stop: () => { handle.elapsed(); stopped = true; audio.stop(); this.active.delete(handle); },
    };
    this.active.add(handle);
    setTimeout(() => this.active.delete(handle), (duration + 0.1) * 1000);
    return handle;
  }
  /** Look ahead on the audio clock; keep the loop separate from recorded journey events. */
  loop(sequence: readonly SoundSequenceEntry[], seconds: number) {
    let next = 0;
    const handles = new Set<ReturnType<typeof SoundEffect.scheduleSequence>>();
    const schedule = () => {
      if (!this.context || !this.master || this.disposed || document.hidden || this.context.state !== 'running') { next = 0; return; }
      const now = this.context.currentTime;
      if (!next || next < now) next = now + .05;
      if (next > now + .15) return;
      const handle = this.schedule(sequence, next);
      handles.add(handle); this.active.add(handle);
      const tail = Math.max(...sequence.map(entry => entry.at + SoundEffect.fromScore(entry.score).duration));
      window.setTimeout(() => { handles.delete(handle); this.active.delete(handle); }, (next - now + tail + .1) * 1000);
      next += seconds;
    };
    schedule();
    const timer = window.setInterval(schedule, 50);
    return () => {
      window.clearInterval(timer);
      handles.forEach(handle => { handle.stop(); this.active.delete(handle); });
      handles.clear();
    };
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
  stop() { this.active.forEach(handle => handle.stop()); this.active.clear(); this.midi.stop(); }
  dispose() { this.disposed = true; this.stop(); this.midi.dispose(); void this.context?.close().catch(() => {}); }
}
