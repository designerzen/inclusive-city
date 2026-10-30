import { parseShellPayload } from '../shellIdentity';
import type { RobotTransport } from './transport';
export type RobotAction = 'start' | 'hold' | 'resume' | 'stop';
export interface CommandSettings { start: string; hold: string; resume: string; stop: string; ending: 'newline' | 'none'; }
export const defaultCommands: CommandSettings = { start: 'START', hold: 'PAUSE', resume: 'RESUME', stop: 'STOP', ending: 'newline' };
export interface SensorReport {
  qrPayload?: string; shellId?: string;
  distanceMm?: number; speedMmS?: number; battery?: number; lineConfidence?: number; obstacleMm?: number;
  status?: 'ready' | 'following' | 'held' | 'stopped' | 'fault'; event?: 'marker' | 'arrived';
  code?: number; markerIndex?: number; sequence?: number;
}
export function sensorReport(value: unknown): SensorReport | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const input = value as Record<string, unknown>, result: SensorReport = {};
  for (const key of ['distanceMm', 'speedMmS', 'battery', 'lineConfidence', 'obstacleMm'] as const) if (input[key] !== undefined) {
    const n = input[key], max = key === 'battery' ? 100 : key === 'lineConfidence' ? 1 : 10000000;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > max) throw new Error(`Invalid sensor ${key}.`); result[key] = n;
  }
  if (input.qrPayload !== undefined) {
    if (typeof input.qrPayload !== 'string' || !parseShellPayload(input.qrPayload)) throw new Error('Invalid shell QR identity.');
    result.qrPayload = input.qrPayload; result.shellId = parseShellPayload(input.qrPayload);
  }
  if (input.status !== undefined) {
    if (!['ready', 'following', 'held', 'stopped', 'fault'].includes(String(input.status))) throw new Error('Invalid robot status.');
    result.status = input.status as SensorReport['status'];
  }
  if (input.event === 'marker' || input.event === 'arrived') result.event = input.event;
  for (const key of ['code', 'markerIndex', 'sequence'] as const) if (input[key] !== undefined) {
    const n = input[key]; if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0 || key === 'code' && n > 15) throw new Error(`Invalid ${key}.`); result[key] = n;
  }
  return Object.keys(result).length ? result : undefined;
}
export function parseSensorText(text: string): SensorReport | undefined {
  try { return sensorReport(JSON.parse(text)); } catch (error) { if (!(error instanceof SyntaxError)) throw error; }
  if (text.trim().toUpperCase() === 'ARRIVED') return { event: 'arrived', status: 'stopped' };
  const match = /^([a-zA-Z]+)\s*:\s*(.+)$/.exec(text); if (!match) return;
  const aliases: Record<string, string> = { distance: 'distanceMm', distancemm: 'distanceMm', speed: 'speedMmS', speedmms: 'speedMmS', battery: 'battery', lineconfidence: 'lineConfidence', obstacle: 'obstacleMm', obstaclemm: 'obstacleMm', status: 'status' };
  const key = match[1]!.toLowerCase();
  if (key === 'qr') return sensorReport({ qrPayload: match[2]!.trim() });
  if (key === 'marker') return sensorReport({ event: 'marker', code: Number(match[2]) });
  const field = aliases[key]; if (!field) return;
  return sensorReport({ [field]: field === 'status' ? match[2]!.trim().toLowerCase() : Number(match[2]) });
}
export class SensorDecoder {
  private decoder = new TextDecoder(); private buffer = '';
  get pending() { return this.buffer; }
  accept(data: Uint8Array): string[] {
    if (data.length > 16384) throw new Error('Sensor message too large.');
    this.buffer += this.decoder.decode(data, { stream: true });
    if (this.buffer.length > 16384) { this.buffer = ''; throw new Error('Sensor message exceeded 16 KiB.'); }
    const messages = this.buffer.split('\n'); this.buffer = messages.pop()!;
    try { if (this.buffer.trim().startsWith('{')) { JSON.parse(this.buffer); messages.push(this.buffer); this.buffer = ''; } } catch { /* Partial JSON. */ }
    return messages.map(message => message.trim()).filter(Boolean);
  }
}
export class RobotSession {
  connected = true; message = 'Connected. No command sent.'; lastCommand?: RobotAction;
  report?: SensorReport; lastReceived = 0; readonly messages: { time: number; text: string }[] = [];
  private decoder = new SensorDecoder(); private lastSequence = -1;
  get pendingText() { return this.decoder.pending; }
  onReport: (report: SensorReport, receivedAt: number) => void = () => {};
  constructor(readonly transport: RobotTransport, private changed: () => void = () => {}) {
    transport.onData = bytes => {
      try { for (const text of this.decoder.accept(bytes)) {
        const time = Date.now(); this.lastReceived = time; this.messages.push({ time, text }); if (this.messages.length > 2000) this.messages.shift();
        const report = parseSensorText(text);
        if (report) {
          if (report.sequence !== undefined && report.sequence <= this.lastSequence) continue;
          if (report.sequence !== undefined) this.lastSequence = report.sequence;
          this.report = { ...this.report, ...report }; this.onReport(report, time);
        } this.changed();
      } } catch (error) { this.message = String(error); this.changed(); }
    };
    transport.onDisconnect = reason => { this.connected = false; this.message = reason; this.changed(); };
  }
  get id() { return this.transport.id; } get name() { return this.transport.name; }
  async command(action: RobotAction, settings: CommandSettings) {
    if (!this.connected) throw new Error('Robot disconnected.');
    const text = settings[action]; if (!text || text.length > 512) throw new Error('Configure a command of 1–512 characters.');
    await this.transport.send(new TextEncoder().encode(text + (settings.ending === 'newline' ? '\n' : '')), action === 'stop');
    this.lastCommand = action; this.message = `${action} command sent. Robot state comes from sensor data.`; this.changed();
  }
  async send(text: string) { if (!this.connected) throw new Error('Robot disconnected.'); await this.transport.send(new TextEncoder().encode(text)); this.message = 'Custom command sent.'; this.changed(); }
  disconnect() { this.connected = false; this.transport.disconnect(); this.message = 'Disconnected.'; this.changed(); }
}
export class RobotFleet {
  readonly sessions = new Map<string, RobotSession>();
  constructor(private changed: () => void = () => {}) {}
  add(transport: RobotTransport) {
    if (this.sessions.has(transport.id)) { transport.disconnect(); throw new Error('This robot is already connected.'); }
    const session = new RobotSession(transport, this.changed); this.sessions.set(session.id, session); this.changed(); return session;
  }
  stopAll(settings: CommandSettings) { return Promise.allSettled([...this.sessions.values()].filter(s => s.connected).map(s => s.command('stop', settings))); }
  disconnectAll() { for (const session of this.sessions.values()) session.disconnect(); this.sessions.clear(); this.changed(); }
}
