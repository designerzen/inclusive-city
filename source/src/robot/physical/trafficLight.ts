import { CommsDecoder, encodeCommand, parseCommsFrame } from '../commsProtocol';
import type { RobotTransport } from './transport';
import { defaultTrafficLightCommands, type TrafficLightCommands } from './trafficLightCommands';

export type TrafficLightPhase = 'disconnected' | 'starting' | 'following' | 'waiting' | 'resuming' | 'fault';
export const trafficLightWaitMs = 2000;

/** SIG:2 means the complete barcode has been read and the motors have stopped. */
export class RobotTrafficLight {
  phase: TrafficLightPhase = 'disconnected';
  message = 'Pair your robot to start following the line.';
  /** Completed barcode stops in route order; duplicate notifications do not advance it. */
  barcodeStop = -1;
  private decoder = new CommsDecoder();
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: number;
  private active = true;

  constructor(private transport: RobotTransport, private changed: () => void, private commands: () => TrafficLightCommands = () => defaultTrafficLightCommands(1)) {
    transport.onData = bytes => {
      if (!this.active) return;
      for (const line of this.decoder.accept(bytes)) {
        const frame = parseCommsFrame(line);
        if (frame?.kind === 'ACK' && frame.code === this.pending) {
          this.cancelTimer(); this.pending = undefined;
          if (this.phase === 'starting' || this.phase === 'resuming' || this.phase === 'following') this.set('following', 'Green light — robot following the line.');
        } else if (frame?.kind === 'SIG' && frame.code === 2 && (this.phase === 'following' && this.pending === undefined || this.phase === 'starting')) {
          this.cancelTimer(); this.pending = undefined;
          this.barcodeStop++;
          this.set('waiting', 'Robot awaiting instruction. Red light — waiting for green.');
          this.timer = setTimeout(() => { void this.command(this.continueCode(), 'resuming'); }, trafficLightWaitMs);
        } else if (frame?.kind === 'ERR') this.fail(`Robot reported ${frame.reason}. Stop and reconnect to try again.`);
      }
    };
    transport.onDisconnect = reason => this.close(reason);
  }

  start() { return this.command(this.commands().start, 'starting'); }
  get canFulfill() { return this.active && this.pending === undefined && (this.phase === 'waiting' || this.phase === 'following'); }
  private continueCode() { const codes = this.commands().approaches; return codes[Math.max(0, this.barcodeStop) % codes.length]!; }
  /** Fulfil the wait once, selecting the clicked approach before sending its command. */
  fulfill(approach: number) {
    const count = this.commands().approaches.length;
    if (!this.canFulfill || !Number.isInteger(approach) || approach < 0 || approach >= count) return Promise.resolve();
    this.barcodeStop = Math.floor(Math.max(0, this.barcodeStop) / count) * count + approach;
    return this.command(this.continueCode(), 'resuming', true);
  }
  private set(phase: TrafficLightPhase, message: string) { this.phase = phase; this.message = message; this.changed(); }
  private cancelTimer() { clearTimeout(this.timer); this.timer = undefined; }
  private fail(message: string) { this.cancelTimer(); this.pending = undefined; this.set('fault', message); }
  private async command(code: number, phase: 'starting' | 'resuming', immediate = false) {
    if (!this.active || this.phase === 'fault') return;
    this.cancelTimer(); this.pending = code;
    this.set(immediate ? 'following' : phase, immediate ? 'Green light — instruction sent; awaiting robot confirmation.' : phase === 'starting' ? 'Starting line following…' : 'Sending continue instruction…');
    // Set before writing: a robot may acknowledge before the write resolves.
    this.timer = setTimeout(() => this.fail('Robot did not confirm the command. Stop and reconnect to try again.'), 5000);
    try { await this.transport.send(new TextEncoder().encode(encodeCommand(code))); }
    catch (error) { if (this.active) this.fail(`Could not send instruction: ${String(error)}`); }
  }

  close(message = 'Disconnected. Pair your robot to start again.') {
    if (!this.active) return;
    this.active = false; this.cancelTimer(); this.pending = undefined;
    // Request Stop before disconnecting; a lost radio link cannot deliver it.
    void this.transport.send(new TextEncoder().encode(encodeCommand(this.commands().stop)), true).catch(() => {}).finally(() => this.transport.disconnect());
    this.set('disconnected', message);
  }
}
