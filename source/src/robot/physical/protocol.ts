export const ROBOT_SERVICE = '09b55000-4f6b-4abc-9b81-846bec831101';
export const ROBOT_IDENTITY = '09b55001-4f6b-4abc-9b81-846bec831101';
export const ROBOT_RX = '09b55002-4f6b-4abc-9b81-846bec831101';
export const ROBOT_TX = '09b55003-4f6b-4abc-9b81-846bec831101';
export const PROTOCOL_VERSION = 1;
export type HardwareState = 'ready' | 'following' | 'held' | 'stopped' | 'fault';
export interface RobotIdentity {
  version: 1; hardwareId: string; bootId: string; name: string;
  encoders: boolean; lease: boolean; maxSpeedMmS: number;
}
export interface RobotReport {
  version: 1; hardwareId: string; bootId: string; session: string; routeHash: string;
  sequence: number; timeMs: number;
  type: 'telemetry' | 'marker' | 'result' | 'snapshot' | 'fault' | 'arrived';
  state: HardwareState; distanceMm?: number; speedMmS?: number;
  markerDistanceMm?: number;
  battery?: number; lineConfidence?: number; obstacleMm?: number;
  markerIndex?: number; code?: number; commandId?: number;
  eventId?: number;
  accepted?: boolean; reason?: string;
}
export interface RobotCommand {
  version: 1; hardwareId: string; bootId: string; session: string; routeHash: string;
  commandId: number; type: 'prepare' | 'start' | 'hold' | 'resume' | 'stop' | 'snapshot' | 'heartbeat' | 'ack';
  payload?: unknown;
}
const states = new Set(['ready', 'following', 'held', 'stopped', 'fault']);
const types = new Set(['telemetry', 'marker', 'result', 'snapshot', 'fault', 'arrived']);
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid robot message.');
  return value as Record<string, unknown>;
}
function identifier(value: unknown) { return typeof value === 'string' && value.length > 0 && value.length <= 128; }
function natural(value: unknown) { return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0; }
export function parseIdentity(value: unknown): RobotIdentity {
  const v = object(value);
  if (v.version !== 1 || !identifier(v.hardwareId) || !identifier(v.bootId) || !identifier(v.name)
    || typeof v.encoders !== 'boolean' || v.lease !== true || typeof v.maxSpeedMmS !== 'number'
    || !Number.isFinite(v.maxSpeedMmS) || v.maxSpeedMmS <= 0 || v.maxSpeedMmS > 10000)
    throw new Error('Robot needs protocol v1 and firmware stopping lease support.');
  return v as unknown as RobotIdentity;
}
export function parseReport(value: unknown): RobotReport {
  const v = object(value);
  if (v.version !== 1 || !identifier(v.hardwareId) || !identifier(v.bootId) || !identifier(v.session)
    || !identifier(v.routeHash) || !natural(v.sequence) || !natural(v.timeMs)
    || !types.has(String(v.type)) || !states.has(String(v.state))) throw new Error('Invalid robot report header.');
  for (const key of ['distanceMm', 'markerDistanceMm', 'speedMmS', 'battery', 'lineConfidence', 'obstacleMm']) {
    const n = v[key];
    if (n !== undefined && (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 10000000)) throw new Error(`Invalid ${key}.`);
  }
  if (v.battery !== undefined && (v.battery as number) > 100 || v.lineConfidence !== undefined && (v.lineConfidence as number) > 1) throw new Error('Invalid sensor range.');
  for (const key of ['markerIndex', 'code', 'commandId', 'eventId']) if (v[key] !== undefined && !natural(v[key])) throw new Error(`Invalid ${key}.`);
  if (v.code !== undefined && (v.code as number) > 15 || v.accepted !== undefined && typeof v.accepted !== 'boolean'
    || v.reason !== undefined && (typeof v.reason !== 'string' || v.reason.length > 256)) throw new Error('Invalid robot event.');
  if (v.type === 'marker' && (v.markerIndex === undefined || v.code === undefined)) throw new Error('Marker identity missing.');
  if (['marker', 'arrived', 'fault'].includes(String(v.type)) && v.eventId === undefined) throw new Error('Reliable event ID missing.');
  if (v.type === 'result' && (v.commandId === undefined || typeof v.accepted !== 'boolean')) throw new Error('Command result missing.');
  return v as unknown as RobotReport;
}

// Twenty-byte ATT values: 8-byte envelope, up to 12 UTF-8 bytes per fragment.
// One ordered message in flight per characteristic. No allocation from peer-provided lengths.
export function encodeFrames(value: unknown, id: number): Uint8Array<ArrayBuffer>[] {
  const data = new TextEncoder().encode(JSON.stringify(value));
  if (data.length > 16384) throw new Error('Robot message exceeds 16 KiB.');
  const frames: Uint8Array<ArrayBuffer>[] = [];
  for (let offset = 0; offset < data.length; offset += 12) {
    const frame = new Uint8Array(8 + Math.min(12, data.length - offset));
    const view = new DataView(frame.buffer);
    frame[0] = 1; frame[1] = offset + 12 >= data.length ? 1 : 0;
    view.setUint16(2, id & 65535, true); view.setUint16(4, offset, true); view.setUint16(6, data.length, true);
    frame.set(data.subarray(offset, offset + 12), 8); frames.push(frame);
  }
  return frames;
}
/** Bound to the prepared session by firmware; STOP latches against older commands. */
export function encodeControl(command: RobotCommand): Uint8Array<ArrayBuffer> {
  if (!['heartbeat', 'stop', 'hold'].includes(command.type) || !/^[a-f0-9]{8}$/.test(command.session)) throw new Error('Invalid control packet.');
  const frame = new Uint8Array(14), view = new DataView(frame.buffer);
  frame[0] = 2; frame[1] = command.type === 'heartbeat' ? 0 : command.type === 'stop' ? 1 : 2;
  view.setUint32(2, command.commandId, true); view.setUint32(6, parseInt(command.session, 16), true);
  view.setUint32(10, /^[a-f0-9]{64}$/.test(command.routeHash) ? parseInt(command.routeHash.slice(0, 8), 16) : 0, true);
  return frame;
}
export class FrameDecoder {
  private buffer = new Uint8Array(16384);
  private id = -1; private length = 0; private offset = 0; private started = 0;
  accept(frame: DataView, now = Date.now()): unknown | undefined {
    if (frame.byteLength < 9 || frame.byteLength > 20 || frame.getUint8(0) !== 1 || frame.getUint8(1) > 1) throw new Error('Invalid BLE frame.');
    const id = frame.getUint16(2, true), offset = frame.getUint16(4, true), length = frame.getUint16(6, true), size = frame.byteLength - 8;
    if (offset === 0) { this.id = id; this.length = length; this.offset = 0; this.started = now; }
    if (id !== this.id || offset !== this.offset || length !== this.length || length > 16384 || length < 1
      || offset + size > length || now - this.started > 3000) { this.id = -1; throw new Error('Incomplete or expired BLE message.'); }
    this.buffer.set(new Uint8Array(frame.buffer, frame.byteOffset + 8, size), offset); this.offset += size;
    if (frame.getUint8(1) === 0) {
      if (this.offset === length) throw new Error('Missing final BLE flag.');
      return undefined;
    }
    if (this.offset !== length) throw new Error('Truncated BLE message.');
    this.id = -1;
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(this.buffer.subarray(0, length)));
  }
}
