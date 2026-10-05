export interface VoiceCapture {
  load(): Promise<unknown>; start(): Promise<void>; stop(): Promise<void>; close(): void;
  cancel?(): void;
}
export interface VoiceEvents {
  text(text: string): void; line(id: string, text: string): void;
  progress(fraction: number): void; error(error: Error): void;
}
export type VoiceFactory = (events: VoiceEvents) => Promise<VoiceCapture>;

export async function moonshineCapture(events: VoiceEvents): Promise<VoiceCapture> {
  if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('Voice needs a secure connection and a microphone. You can type your reply below.');
  if (!crossOriginIsolated) throw new Error('On-device voice is unavailable on this host. You can type your reply below.');
  const url = `${import.meta.env.BASE_URL}moonshine/index.js`;
  const moonshine: typeof import('@moonshine-ai/moonshine-wasm') = await import(/* @vite-ignore */ url);
  const worker = new moonshine.SttWorkerHost(new URL(url, location.href).href.replace(/index\.js$/, ''));
  const streamId = 'city-reply';
  let media: MediaStream | null = null, audio: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null, worklet: AudioWorkletNode | null = null;
  let closed = false, running = false, started = false;
  worker.onProgress = (_id, loaded, total) => events.progress(total ? loaded / total : 0);
  worker.setListener(streamId, {
    onLineTextChanged: event => events.text(event.line.text),
    onLineCompleted: event => events.line(event.line.id, event.line.text),
    onError: event => events.error(event.error),
  });
  function releaseAudio() {
    running = false; worklet?.disconnect(); source?.disconnect();
    media?.getTracks().forEach(track => track.stop()); media = null;
    const context = audio; audio = null; worklet = null; source = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
  function close() { if (closed) return; closed = true; releaseAudio(); worker.close(); }
  return {
    async load() {
      await worker.loadTranscriber({ transcriberId: streamId, modelArch: moonshine.ModelArch.TinyStreaming, source: { kind: 'catalog', language: 'en' } });
      await worker.createStream(streamId, streamId, { updateInterval: .25 });
    },
    async start() {
      const input = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (closed) { input.getTracks().forEach(track => track.stop()); return; }
      media = input; audio = new AudioContext({ sampleRate: 16000 });
      await audio.resume();
      if (closed) return;
      // Sample-rate request may be ignored by a device. Pass its actual rate.
      const sampleRate = audio.sampleRate;
      const blob = URL.createObjectURL(new Blob([`class CityReplyCapture extends AudioWorkletProcessor {
        process(inputs) {
          const channels = inputs[0];
          if (channels?.length && channels[0].length) {
            const mono = new Float32Array(channels[0].length);
            for (const channel of channels) for (let i = 0; i < mono.length; i++) mono[i] += channel[i] / channels.length;
            this.port.postMessage(mono, [mono.buffer]);
          }
          return true;
        }
      }; registerProcessor('city-reply-capture', CityReplyCapture);`], { type: 'text/javascript' }));
      try { await audio.audioWorklet.addModule(blob); } finally { URL.revokeObjectURL(blob); }
      if (closed || !audio) return;
      await worker.start(streamId); started = true;
      if (closed || !audio) return;
      source = audio.createMediaStreamSource(input);
      worklet = new AudioWorkletNode(audio, 'city-reply-capture');
      running = true;
      worklet.port.onmessage = event => {
        if (!running || closed) return;
        if (worker.queuedSeconds(streamId) > 3) { events.error(new Error('This device cannot keep up with voice recognition')); return; }
        worker.addAudio(streamId, event.data as Float32Array, sampleRate);
      };
      input.getTracks().forEach(track => track.addEventListener('ended', () => { if (running) events.error(new Error('Microphone disconnected')); }));
      source.connect(worklet); worklet.connect(audio.destination);
    },
    async stop() { releaseAudio(); if (started && !closed) { started = false; await worker.stop(streamId); } },
    close, cancel: close,
  };
}

/** A response is committed only by Done. Cancellation invalidates in-flight work. */
export class CityVoiceReply {
  private generation = 0;
  private capture: VoiceCapture | null = null;
  private lines = new Map<string, string>();
  private partial = '';
  busy = false;
  listening = false;
  constructor(private callbacks: {
    status(text: string): void; transcript(text: string): void;
    active(value: boolean): void; submit(text: string): void;
  }, private factory: VoiceFactory = moonshineCapture) {}
  async start() {
    if (this.busy) return;
    const generation = ++this.generation;
    this.busy = true; this.lines.clear(); this.partial = '';
    this.callbacks.active(true); this.callbacks.transcript('');
    this.callbacks.status('Preparing on-device voice from your saved speech model.');
    let capture: VoiceCapture | null = null;
    const current = () => generation === this.generation;
    const show = () => { if (current()) this.callbacks.transcript([...this.lines.values(), this.partial].filter(Boolean).join(' ')); };
    try {
      capture = await this.factory({
        text: text => { if (current()) { this.partial = text; show(); } },
        line: (id, text) => { if (current()) { this.lines.set(id, text); this.partial = ''; show(); } },
        progress: fraction => { if (current()) this.callbacks.status(`Preparing on-device voice · ${Math.round(fraction * 100)}%`); },
        error: error => { if (current()) { this.cancel(); this.callbacks.status(`Voice stopped: ${error.message}. You can type your reply.`); } },
      });
      if (!current()) { capture.close(); return; }
      this.capture = capture;
      await capture.load();
      if (!current()) { capture.close(); return; }
      await capture.start();
      if (!current()) { await capture.stop(); capture.close(); return; }
      this.listening = true; this.callbacks.active(true);
      this.callbacks.status('Listening on this device. Take your time, then choose Done.');
    } catch (error) {
      if (current()) {
        this.cancel();
        this.callbacks.status(error instanceof Error ? error.message : 'Voice could not start. Type your reply or try again.');
      }
      if (capture) { await capture.stop().catch(() => {}); capture.close(); }
    }
  }
  async finish() {
    if (!this.listening || !this.capture) return;
    const generation = this.generation, capture = this.capture;
    this.listening = false; this.callbacks.active(true); this.callbacks.status('Finishing your reply…');
    try {
      await capture.stop();
      if (generation !== this.generation) return;
      // stop() flushes pending audio into final lines; never execute interim text.
      const text = [...this.lines.values()].join(' ');
      this.capture = null; capture.close(); this.busy = false;
      ++this.generation; this.callbacks.active(false);
      this.callbacks.status('Microphone off. Your reply was processed on this device.');
      this.callbacks.submit(text);
    } catch (error) {
      if (generation === this.generation) { this.cancel(); this.callbacks.status(`Voice could not finish. ${error instanceof Error ? error.message : 'Try typing your reply.'}`); }
    }
  }
  cancel() {
    ++this.generation;
    const capture = this.capture; this.capture = null;
    this.busy = false; this.listening = false;
    // stop releases tracks synchronously before its first await; close afterwards.
    if (capture?.cancel) capture.cancel();
    else if (capture) void capture.stop().catch(() => {}).finally(() => capture.close());
    this.lines.clear(); this.partial = '';
    this.callbacks.active(false); this.callbacks.transcript('');
  }
}
