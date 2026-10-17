/** Audible output is analysed after volume/mute, without changing its gain. */
export class AudioSpectrum {
  private analysers = new Map<AudioContext, { node: AnalyserNode; data: Uint8Array<ArrayBuffer> }>();
  private bands = new Float32Array(16);
  private sampledAt = -Infinity;

  output(context: AudioContext): AudioNode {
    const existing = this.analysers.get(context);
    if (existing) return existing.node;
    const node = context.createAnalyser();
    node.fftSize = 2048;
    node.minDecibels = -80;
    node.maxDecibels = -15;
    node.smoothingTimeConstant = .72;
    node.connect(context.destination);
    this.analysers.set(context, { node, data: new Uint8Array(node.frequencyBinCount) });
    return node;
  }

  release(context: AudioContext) {
    this.analysers.get(context)?.node.disconnect();
    this.analysers.delete(context);
    this.sampledAt = -Infinity;
  }

  /** Logarithmic bands from bass to treble, shared by every visible robot. */
  read(now = performance.now()): Readonly<Float32Array> {
    if (now - this.sampledAt < 1000 / 30) return this.bands;
    this.sampledAt = now;
    this.bands.fill(0);
    for (const [context, { node, data }] of this.analysers) {
      if (context.state === 'closed') { this.release(context); continue; }
      if (context.state !== 'running') continue;
      node.getByteFrequencyData(data);
      const high = Math.min(16000, context.sampleRate / 2);
      for (let band = 0; band < this.bands.length; band++) {
        const lowHz = 60 * (high / 60) ** (band / this.bands.length);
        const highHz = 60 * (high / 60) ** ((band + 1) / this.bands.length);
        const start = Math.max(1, Math.floor(lowHz * node.fftSize / context.sampleRate));
        const end = Math.min(data.length, Math.max(start + 1, Math.ceil(highHz * node.fftSize / context.sampleRate)));
        let energy = 0;
        for (let bin = start; bin < end; bin++) energy += (data[bin]! / 255) ** 2;
        this.bands[band] = Math.min(1, Math.hypot(this.bands[band]!, Math.sqrt(energy / Math.max(1, end - start))));
      }
    }
    return this.bands;
  }
}

export const audioSpectrum = new AudioSpectrum();
