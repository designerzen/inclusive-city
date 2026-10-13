export type IntroducedScreen = 'presets' | 'editor' | 'city' | 'art';
export function screenIntroduction(screen: IntroducedScreen, robotName = 'your robot') {
  return {
    presets: 'Greet your robot', editor: 'Design your robot',
    city: `Help ${robotName} navigate the city`, art: 'Enjoy this amazing robot art',
  }[screen];
}

interface SpeechRuntime {
  synthesis: Pick<SpeechSynthesis, 'speak' | 'cancel' | 'getVoices'>;
  utterance(text: string): SpeechSynthesisUtterance;
}
export interface NeuralSpeech {
  generate(text: string): Promise<{ audio: Float32Array; sampling_rate: number }>;
  dispose(): void;
}
function browserSpeech(): SpeechRuntime | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return null;
  return { synthesis: window.speechSynthesis, utterance: text => new SpeechSynthesisUtterance(text) };
}

/** Screen narration stays separate from the robot's saved music and scores. */
export class ScreenSpeech {
  private enabled = true;
  private muted = false;
  private volume = 0.55;
  private disposed = false;
  private current: SpeechSynthesisUtterance | null = null;
  private finish: (() => void) | null = null;
  private generation = 0;
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null;
  private settingsListeners = new Set<() => void>();
  constructor(private runtime: SpeechRuntime | null = browserSpeech(), private neural?: NeuralSpeech) {}
  get supported() { return this.runtime !== null || this.neural !== undefined; }
  get canSpeak() { return this.supported && this.enabled && !this.muted && this.volume > 0 && !this.disposed; }
  subscribeSettings(listener: () => void) { this.settingsListeners.add(listener); return () => { this.settingsListeners.delete(listener); }; }
  private settingsChanged() { this.settingsListeners.forEach(listener => listener()); }
  setEnabled(enabled: boolean) { this.enabled = enabled; if (!enabled) this.stop(); this.settingsChanged(); }
  stop() {
    this.generation++;
    this.source?.stop(); this.source = null;
    this.current = null;
    const finish = this.finish; this.finish = null; finish?.();
    try { this.runtime?.synthesis.cancel(); } catch { /* Navigation works without speech. */ }
  }
  setMuted(muted: boolean) { this.muted = muted; if (muted) this.stop(); this.settingsChanged(); }
  setVolume(volume: number) {
    if (!Number.isFinite(volume)) return;
    this.volume = Math.min(1, Math.max(0, volume));
    if (this.gain) this.gain.gain.value = this.volume;
    if (!this.volume) this.stop();
    else if (this.current) this.current.volume = this.volume;
    this.settingsChanged();
  }
  introduce(screen: IntroducedScreen, robotName?: string) {
    this.say(screenIntroduction(screen, robotName));
  }
  say(text: string, onStart?: () => void, onFinish?: () => void) {
    if (this.disposed) return false;
    this.stop();
    if (!this.canSpeak) return false;
    if (this.neural) {
      const generation = this.generation;
      this.finish = onFinish ?? null;
      try {
        this.context ??= new AudioContext();
        const resumed = this.context.resume();
        void Promise.all([this.neural.generate(text), resumed]).then(([result]) => {
          if (generation !== this.generation || !this.canSpeak) return;
          const context = this.context!;
          const buffer = context.createBuffer(1, result.audio.length, result.sampling_rate);
          buffer.copyToChannel(new Float32Array(result.audio), 0);
          const source = context.createBufferSource();
          this.gain ??= context.createGain(); this.gain.gain.value = this.volume;
          this.gain.disconnect(); this.gain.connect(context.destination);
          source.buffer = buffer; source.connect(this.gain); this.source = source;
          source.onended = () => {
            if (generation !== this.generation) return;
            this.source = null;
            const finish = this.finish; this.finish = null; finish?.();
          };
          source.start(); onStart?.();
        }).catch(() => {
          if (generation !== this.generation) return;
          this.saySystem(text, onStart, onFinish);
        });
        return true;
      } catch { return this.saySystem(text, onStart, onFinish); }
    }
    return this.saySystem(text, onStart, onFinish);
  }
  private saySystem(text: string, onStart?: () => void, onFinish?: () => void) {
    if (!this.runtime) { const finish = this.finish; this.finish = null; finish?.(); return false; }
    try {
      const utterance = this.runtime.utterance(text);
      const voices = this.runtime.synthesis.getVoices();
      const voice = voices.find(voice => voice.lang === 'en-GB' && voice.localService)
        ?? voices.find(voice => voice.lang.startsWith('en') && voice.localService)
        ?? voices.find(voice => voice.lang.startsWith('en'));
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? 'en-GB';
      utterance.rate = 0.95; utterance.pitch = 1; utterance.volume = this.volume;
      utterance.onstart = () => { if (this.current === utterance) onStart?.(); };
      utterance.onend = utterance.onerror = () => {
        if (this.current !== utterance) return;
        this.current = null;
        const finish = this.finish; this.finish = null; finish?.();
      };
      this.current = utterance;
      this.finish = onFinish ?? null;
      this.runtime.synthesis.speak(utterance);
      return true;
    } catch { this.current = null; const finish = this.finish; this.finish = null; finish?.(); return false; }
  }
  dispose() { this.disposed = true; this.stop(); this.neural?.dispose(); void this.context?.close(); }
}
