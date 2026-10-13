import type { SpokenTool } from '../ui/citySpokenActions';
export interface CommandCallbacks { status(text: string): void; active(): void; result(calls: unknown): void }
export type CommandController = Pick<CitySpokenCommand, 'busy' | 'listening' | 'start' | 'finish' | 'cancel'>;

export function resampleCommand(input: Float32Array, rate: number): Float32Array {
  if (rate === 16000) return input;
  const output = new Float32Array(Math.floor(input.length * 16000 / rate));
  // Average source intervals when downsampling, avoiding simple point decimation.
  for (let i = 0; i < output.length; i++) {
    const start = i * rate / 16000, end = (i + 1) * rate / 16000;
    let total = 0;
    for (let j = Math.floor(start); j < Math.ceil(end); j++) total += (input[j] ?? 0) * (Math.min(end, j + 1) - Math.max(start, j));
    output[i] = total / (end - start);
  }
  return output;
}
export function hasCommandSpeech(audio: Float32Array): boolean {
  // Energy gate rejects silence, not a confidence score or an intent detector.
  let voiced = 0;
  for (let i = 0; i < audio.length; i += 320) {
    let power = 0;
    for (let j = i; j < Math.min(i + 320, audio.length); j++) power += audio[j]! ** 2;
    if (Math.sqrt(power / 320) > .008) voiced++;
  }
  return voiced >= 10;
}
export class CitySpokenCommand {
  busy = false;
  listening = false;
  private generation = 0;
  private worker: Worker | null = null;
  private media: MediaStream | null = null;
  private audio: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private chunks: Float32Array[] = [];
  private samples = 0;
  private timeout: ReturnType<typeof setTimeout> | undefined;
  private rejectLoad: ((error: Error) => void) | null = null;
  constructor(private callbacks: CommandCallbacks) {}
  private release() {
    clearTimeout(this.timeout); this.timeout = undefined;
    this.worklet?.disconnect(); this.source?.disconnect();
    this.media?.getTracks().forEach(track => track.stop()); this.media = null;
    const audio = this.audio; this.audio = null; this.source = null; this.worklet = null;
    if (audio) void audio.close().catch(() => {});
  }
  cancel() {
    ++this.generation; this.listening = false; this.busy = false;
    this.rejectLoad?.(new Error('Command cancelled')); this.rejectLoad = null;
    this.release(); this.worker?.terminate(); this.worker = null;
    this.chunks = []; this.samples = 0; this.callbacks.active();
  }
  async start(tools: SpokenTool[]) {
    if (this.busy) return;
    const generation = ++this.generation, current = () => generation === this.generation;
    this.busy = true; this.callbacks.active();
    try {
      if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('A secure connection and microphone are needed. Type a prompt or use a choice.');
      this.callbacks.status('Preparing NeuDecide on-device commands. First use downloads the model.');
      const worker = new Worker(new URL('./neudecide.worker.ts', import.meta.url), { type: 'module' });
      this.worker = worker;
      await new Promise<void>((resolve, reject) => {
        this.rejectLoad = reject;
        this.timeout = setTimeout(() => reject(new Error('The command model took too long to load. Type a prompt or try again.')), 120000);
        worker.onerror = () => reject(new Error('The command model could not start. Type a prompt or use a choice.'));
        worker.onmessage = ({ data }) => {
          if (!current()) return;
          if (data.type === 'ready') resolve();
          if (data.type === 'status') this.callbacks.status(data.text);
          if (data.type === 'error') reject(new Error(data.text));
        };
        const base = new URL(import.meta.env.VITE_NEUDECIDE_MODEL_URL || `${import.meta.env.BASE_URL}neudecide/`, location.href).href;
        worker.postMessage({ type: 'load', base: base.endsWith('/') ? base : `${base}/`, runtime: new URL(`${import.meta.env.BASE_URL}onnxruntime/`, location.href).href });
      });
      if (!current()) return;
      this.rejectLoad = null; clearTimeout(this.timeout); this.timeout = undefined;
      const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      if (!current()) { media.getTracks().forEach(t => t.stop()); return; }
      this.media = media;
      const audio = new AudioContext(); this.audio = audio; await audio.resume();
      const blob = URL.createObjectURL(new Blob([`class CommandCapture extends AudioWorkletProcessor {
        process(inputs) { const channels = inputs[0]; if (channels?.length) {
          const mono = new Float32Array(channels[0].length);
          for (const channel of channels) for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / channels.length;
          this.port.postMessage(mono, [mono.buffer]); } return true; }
      } registerProcessor('city-command', CommandCapture);`], { type: 'text/javascript' }));
      try { await audio.audioWorklet.addModule(blob); } finally { URL.revokeObjectURL(blob); }
      if (!current()) return;
      this.chunks = []; this.samples = 0;
      this.worklet = new AudioWorkletNode(audio, 'city-command'); this.source = audio.createMediaStreamSource(media);
      this.worklet.port.onmessage = ({ data }: MessageEvent<Float32Array>) => {
        if (!this.listening || !current()) return;
        if (this.samples + data.length > audio.sampleRate * 30) { this.cancel(); this.callbacks.status('That command exceeded 30 seconds. Try one shorter change or type a prompt.'); return; }
        this.chunks.push(data); this.samples += data.length;
      };
      media.getTracks().forEach(track => track.addEventListener('ended', () => { if (current() && this.listening) { this.cancel(); this.callbacks.status('Microphone disconnected. No change made.'); } }));
      this.source.connect(this.worklet); this.worklet.connect(audio.destination);
      worker.onmessage = ({ data }) => {
        if (!current()) return;
        if (data.type === 'error') { this.cancel(); this.callbacks.status(data.text); }
        if (data.type === 'result') { const calls = data.calls; this.cancel(); this.callbacks.result(calls); }
      };
      worker.onerror = () => { if (current()) { this.cancel(); this.callbacks.status('Command processing stopped. No change made.'); } };
      this.listening = true; this.callbacks.active();
      this.callbacks.status('Listening for one city change. Choose Done when finished; 30 seconds maximum.');
      this.timeout = setTimeout(() => { if (current() && this.listening) { this.cancel(); this.callbacks.status('Recording limit reached. Try a shorter command or type a prompt.'); } }, 30000);
      this.tools = tools;
    } catch (error) { if (current()) { this.cancel(); this.callbacks.status(error instanceof Error ? error.message : 'Voice unavailable. Use a city choice.'); } }
  }
  private tools: SpokenTool[] = [];
  finish() {
    if (!this.listening || !this.audio) return;
    this.listening = false;
    const input = new Float32Array(this.samples), rate = this.audio.sampleRate;
    let offset = 0; for (const chunk of this.chunks) { input.set(chunk, offset); offset += chunk.length; }
    this.chunks = []; this.release(); this.callbacks.active();
    const waveform = resampleCommand(input, rate);
    if (!hasCommandSpeech(waveform)) { this.cancel(); this.callbacks.status('No clear speech captured. No change made. Try again or type a prompt.'); return; }
    this.callbacks.status('Understanding your city command on this device…');
    this.timeout = setTimeout(() => { this.cancel(); this.callbacks.status('Command processing timed out. Type a prompt or use a choice.'); }, 30000);
    this.worker!.postMessage({ type: 'run', waveform, tools: this.tools }, [waveform.buffer]);
  }
}
