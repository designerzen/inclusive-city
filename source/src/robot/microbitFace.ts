import type { RobotTransport } from './physical/transport';
import { CommsDecoder } from './commsProtocol';
import type { RobotMood } from './robotCondition';

export type FaceCode = 'R' | 'M' | 'B' | 'P' | 'W' | 'H' | 'I' | 'T' | 'F' | 'E';
export interface FaceMessage { id: string; text: string }
export type FaceAction = 'fix' | 'repeat';
export interface FaceJourney {
  complete: boolean; ready: boolean; paused: boolean; blocked: unknown; waiting: boolean;
  mood?: RobotMood; message?: FaceMessage; moving?: boolean;
}
export function journeyFace(journey?: FaceJourney): FaceCode {
  if (!journey) return 'I';
  if (journey.complete || journey.mood === 'celebrating') return 'E';
  if (journey.mood === 'frustrated') return 'F';
  if (journey.mood === 'tired') return 'T';
  return journey.ready ? 'R' : journey.blocked ? 'B' : journey.paused ? 'P' : journey.waiting ? 'W' : journey.mood === 'happy' ? 'H' : journey.mood === 'sad' ? 'B' : 'M';
}

/** The board font is ASCII. Keep text printable, bounded and within one BLE packet per chunk. */
export function faceMessageText(text: string) {
  const ascii = text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...')
    .replace(/[^\x20-\x7e]/g, ' ').replace(/\s+/g, ' ').trim();
  return ascii.length <= 240 ? ascii : `${ascii.slice(0, 237).trimEnd()}...`;
}
export function faceMessageFrames(text: string, sequence: number) {
  const value = faceMessageText(text);
  if (!value) return [];
  const id = (sequence & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const frames = [{ frame: `SAY:${id}\n`, reply: `SAY:${id}` }];
  for (let i = 0; i < value.length; i += 7) {
    const chunk = (i / 7).toString(16).toUpperCase().padStart(2, '0');
    frames.push({ frame: `TXT:${id}:${chunk}:${value.slice(i, i + 7)}\n`, reply: `TXT:${id}:${chunk}` });
  }
  frames.push({ frame: `END:${id}\n`, reply: `END:${id}` });
  return frames;
}

/** Latest mood and message win. ACK each packet so UART buffers cannot overflow. */
export class MicrobitFace {
  private decoder = new CommsDecoder();
  private pending?: { frame: string; reply: string; resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> };
  private desired: FaceCode = 'I';
  private last?: FaceCode;
  private sentAt = -Infinity;
  private closed = false;
  private ready = false;
  private working = false;
  private requestedAt = 0;
  private messageKey?: string;
  private sequence = 0;
  private stopping = false;
  private motionSupported = false;
  private moving = false;
  private lastMoving?: boolean;
  private transmission?: { frames: ReturnType<typeof faceMessageFrames>; index: number };
  constructor(private transport: RobotTransport, private lost: (message: string) => void,
    private action: (action: FaceAction) => void = () => {}) {
    transport.onData = data => {
      for (const frame of this.decoder.accept(data)) {
        if (this.pending?.reply === 'CITYFACE:2' && frame === 'CITYFACE:3') this.motionSupported = true;
        if (frame === this.pending?.reply || this.pending?.reply === 'CITYFACE:2' && frame === 'CITYFACE:3') {
          const pending = this.pending; this.pending = undefined;
          clearTimeout(pending.timer); pending.resolve();
        } else if (this.ready && !this.closed && this.desired !== 'I' && (frame === 'BTN:A' || frame === 'BTN:B')) {
          this.action(frame === 'BTN:A' ? 'fix' : 'repeat');
        } else if (frame === 'ERR:FRAME') this.fail('The microcontroller rejected the face command. Reflash compatible city face firmware.');
      }
    };
    transport.onDisconnect = reason => this.fail(reason);
  }
  async start() {
    try { await this.exchange('HELLO\n', 'CITYFACE:2'); this.ready = true; }
    catch (error) { this.disconnect(); throw error; }
  }
  update(face: FaceCode, now = Date.now(), message?: FaceMessage, moving = false) {
    this.desired = face;
    this.moving = face !== 'I' && moving;
    this.requestedAt = now;
    const key = message ? `${message.id}:${message.text}` : undefined;
    if (this.messageKey !== key) {
      if (this.messageKey !== undefined) this.stopping = true;
      this.messageKey = key;
      const frames = message ? faceMessageFrames(message.text, ++this.sequence) : [];
      this.transmission = frames.length ? { frames, index: 0 } : undefined;
    }
    void this.pump();
  }
  private async pump() {
    if (this.closed || !this.ready || this.working) return;
    this.working = true;
    try {
      while (!this.closed) {
        if (this.stopping) {
          this.stopping = false;
          await this.exchange('STOP\n', 'STOP');
        } else if (this.last !== this.desired || this.requestedAt - this.sentAt >= 1000) {
          const code = this.desired; this.last = code; this.sentAt = this.requestedAt;
          await this.exchange(`FACE:${code}\n`, `ACK:${code}`);
        } else if (this.motionSupported && this.lastMoving !== this.moving) {
          const moving = this.moving; this.lastMoving = moving;
          const frame = `RUN:${moving ? 1 : 0}`;
          await this.exchange(`${frame}\n`, frame);
        } else if (this.transmission) {
          const transmission = this.transmission, packet = transmission.frames[transmission.index]!;
          await this.exchange(packet.frame, packet.reply);
          if (this.transmission === transmission && ++transmission.index === transmission.frames.length) this.transmission = undefined;
        } else break;
      }
    } catch (error) { this.fail(error instanceof Error ? error.message : String(error)); }
    finally { this.working = false; }
  }
  private exchange(frame: string, reply: string) {
    if (this.closed) return Promise.reject(new Error('Robot face disconnected.'));
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending = undefined;
        reject(new Error('No face response. Flash the city face firmware, then pair again.'));
      }, 3000);
      this.pending = { frame, reply, resolve, reject, timer };
      void this.transport.send(new TextEncoder().encode(frame)).catch(error => {
        if (this.pending?.frame !== frame) return;
        clearTimeout(timer); this.pending = undefined;
        reject(error instanceof Error ? error : new Error(String(error)));
      });
    });
  }
  private fail(message: string) { if (!this.closed) { this.disconnect(); this.lost(message); } }
  disconnect() {
    this.closed = true;
    if (this.pending) { clearTimeout(this.pending.timer); this.pending.reject(new Error('Robot face disconnected.')); this.pending = undefined; }
    this.transport.disconnect();
  }
}
