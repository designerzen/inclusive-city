import type { SoundSequenceEntry } from './SoundEffect';

interface Note { pitch: number; start: number; end: number; velocity: number }
interface Message { at: number; data: number[] }

/** Scores stay local; only a short lookahead is queued on the device. */
export class CityMidiOutput {
  private access: MIDIAccess | null = null;
  private output: MIDIOutput | null = null;
  private enabled = false;
  private selectedId = '';
  private channel = 0;
  private jobs = new Map<object, Note[]>();
  private timeline: Note[] = [];
  private messages: Message[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private connecting: Promise<void> | null = null;
  status = 'MIDI is off.';
  onChange = () => {};

  get supported() { return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'; }
  get outputs() { return [...(this.access?.outputs.values() ?? [])].filter(port => port.state === 'connected'); }
  get outputId() { return this.selectedId; }
  get isEnabled() { return this.enabled; }
  get midiChannel() { return this.channel + 1; }

  connect() {
    if (this.disposed) return Promise.resolve();
    this.enabled = true;
    if (this.access) { this.restoreOutput(); return Promise.resolve(); }
    if (this.connecting) return this.connecting;
    this.status = 'Connecting MIDI…'; this.onChange();
    this.connecting = this.requestAccess().finally(() => { this.connecting = null; });
    return this.connecting;
  }

  private async requestAccess() {
    if (this.disposed) return;
    if (!this.supported) { this.enabled = false; this.status = 'Web MIDI requires a supported browser and HTTPS or localhost.'; this.onChange(); return; }
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      if (this.disposed || !this.enabled) return;
      if (this.access && this.access !== access) this.access.onstatechange = null;
      this.access = access;
      access.onstatechange = () => {
        if (this.output?.state === 'disconnected') { this.stop(); this.output = null; }
        this.restoreOutput();
      };
      this.restoreOutput();
    } catch {
      if (!this.enabled || this.disposed) return;
      this.enabled = false; this.status = 'MIDI access was denied or unavailable. You can try again.';
    }
    this.onChange();
  }

  select(id: string) {
    if (!this.enabled || !this.outputs.some(port => port.id === id)) return;
    this.stop();
    this.selectedId = id;
    this.restoreOutput();
  }

  private restoreOutput() {
    if (!this.enabled) { this.onChange(); return; }
    if (!this.selectedId) this.selectedId = this.outputs[0]?.id ?? '';
    this.output = this.outputs.find(port => port.id === this.selectedId) ?? null;
    this.status = this.output ? `Sending to ${this.output.name ?? 'MIDI output'}.`
      : this.selectedId ? 'MIDI enabled. Waiting for the selected device to reconnect.'
      : 'MIDI enabled. Connect a synth or virtual MIDI port.';
    this.onChange();
  }

  disconnect() {
    this.enabled = false;
    this.stop();
    void this.output?.close?.().catch(() => {});
    this.output = null;
    this.status = 'MIDI is off.';
    this.onChange();
  }

  setChannel(channel: number) {
    if (!Number.isInteger(channel) || channel < 1 || channel > 16) return;
    if (this.channel === channel - 1) return;
    this.stop(); this.channel = channel - 1; this.onChange();
  }

  /** when is a performance-clock timestamp, in milliseconds. */
  schedule(sequence: readonly SoundSequenceEntry[], when: number, volume: number) {
    if (!this.output || this.disposed || volume <= 0) return { stop() {} };
    const token = {};
    const notes = sequence.flatMap(entry => entry.score.voice.gain <= 0 ? [] : entry.score.notes.map(note => ({
      pitch: Math.round(note.midi), start: when + (entry.at + note.start) * 1000,
      end: when + (entry.at + note.start + note.duration) * 1000,
      velocity: Math.max(1, Math.min(127, Math.round(127 * volume * Math.sqrt(entry.score.voice.gain / .5)))),
    })));
    this.jobs.set(token, notes); this.rebuild();
    if (!this.timer) this.timer = setInterval(() => this.pump(), 25);
    return { stop: () => { if (this.jobs.delete(token)) this.rebuild(); } };
  }

  private send(data: number[], at?: number) {
    try { this.output?.send(data, at); }
    catch { this.stop(); this.output = null; this.status = 'MIDI enabled. Waiting for the selected device to reconnect.'; this.onChange(); }
  }

  private rebuild() {
    const now = performance.now();
    const active = (notes: Note[]) => new Map(notes.filter(note => note.start <= now && note.end > now).map(note => [note.pitch, note.velocity]));
    const previous = active(this.timeline);
    const merged: Note[] = [];
    for (const note of [...this.jobs.values()].flat().filter(note => note.end > now).sort((a, b) => a.pitch - b.pitch || a.start - b.start)) {
      const last = merged.at(-1);
      if (last && last.pitch === note.pitch && note.start < last.end) {
        if (note.start === last.start) last.end = Math.max(last.end, note.end);
        else {
          // Retrigger repeated pitches without letting the earlier voice cut the new one short.
          const end = Math.max(last.end, note.end);
          last.end = note.start;
          merged.push({ ...note, end });
        }
      } else merged.push({ ...note });
    }
    this.timeline = merged;
    // Rebuild after cancellation so queued notes cannot start after Stop or a screen change.
    try { this.output?.clear(); } catch { /* A disconnected device has no queue to clear. */ }
    const current = active(merged);
    for (const pitch of previous.keys()) if (!current.has(pitch)) this.send([0x80 | this.channel, pitch, 0]);
    for (const [pitch, velocity] of current) if (!previous.has(pitch)) this.send([0x90 | this.channel, pitch, velocity]);
    this.messages = merged.flatMap(note => [
      ...(note.start > now ? [{ at: note.start, data: [0x90 | this.channel, note.pitch, note.velocity] }] : []),
      { at: note.end, data: [0x80 | this.channel, note.pitch, 0] },
    ]).sort((a, b) => a.at - b.at || a.data[0]! - b.data[0]!);
    this.pump();
  }

  private pump() {
    const now = performance.now();
    while (this.messages.length && this.messages[0]!.at <= now + 75) {
      const message = this.messages.shift()!; this.send(message.data, Math.max(now, message.at));
    }
    for (const [token, notes] of this.jobs) if (notes.every(note => note.end <= now)) this.jobs.delete(token);
    if (!this.jobs.size && !this.messages.length && this.timer) { clearInterval(this.timer); this.timer = null; this.timeline = []; }
  }

  stop() {
    try {
      this.output?.clear();
      if (this.timeline.length) {
        this.output?.send([0xb0 | this.channel, 64, 0]);
        this.output?.send([0xb0 | this.channel, 123, 0]);
        this.output?.send([0xb0 | this.channel, 120, 0]);
      }
    } catch { /* Disconnection must never block playback controls. */ }
    if (this.timer) clearInterval(this.timer);
    this.timer = null; this.jobs.clear(); this.messages = []; this.timeline = [];
  }

  dispose() { this.disposed = true; this.disconnect(); if (this.access) this.access.onstatechange = null; this.onChange = () => {}; }
}
