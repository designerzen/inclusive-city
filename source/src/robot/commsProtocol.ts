/** Robot Comms v1: short ASCII, newline-delimited frames (all below 20 bytes). */
export const commsMessages = ['Ready', 'Start', 'Stop', 'Pause', 'Resume', 'Forward', 'Reverse', 'Left', 'Right', 'Arrived', 'Obstacle', 'Clear', 'Help', 'Busy', 'Happy', 'Goodbye'] as const;
export type CommsFrame = { kind: 'CMD' | 'SIG' | 'ACK'; code: number } | { kind: 'AUTO'; enabled: boolean } | { kind: 'ERR'; reason: string };
export function encodeCommand(code: number) {
  if (!Number.isInteger(code) || code < 0 || code > 15) throw new Error('Message must be 0–15.');
  return `CMD:${code.toString(16).toUpperCase()}\n`;
}
export function parseCommsFrame(line: string): CommsFrame | undefined {
  const match = /^(CMD|SIG|ACK):([0-9A-F])$/.exec(line);
  if (match) return { kind: match[1] as 'CMD' | 'SIG' | 'ACK', code: parseInt(match[2]!, 16) };
  if (/^AUTO:[01]$/.test(line)) return { kind: 'AUTO', enabled: line.endsWith('1') };
  if (/^ERR:[A-Z]+$/.test(line)) return { kind: 'ERR', reason: line.slice(4) };
  return undefined;
}
/** Notifications can contain a partial frame or several frames. Recover at newline. */
export class CommsDecoder {
  private buffer = ''; private dropping = false;
  accept(bytes: Uint8Array): string[] {
    const lines: string[] = [];
    for (const byte of bytes) {
      if (byte === 10) {
        if (!this.dropping && this.buffer) lines.push(this.buffer.replace(/\r$/, ''));
        this.buffer = ''; this.dropping = false;
      } else if (!this.dropping) {
        if (byte > 127 || this.buffer.length >= 64) { this.buffer = ''; this.dropping = true; }
        else this.buffer += String.fromCharCode(byte);
      }
    }
    return lines;
  }
}
/** Four lower LEDs encode the message, left to right = 8, 4, 2, 1. */
export function messagePixels(code: number): boolean[] {
  return Array.from({ length: 25 }, (_, i) => i < 5 || i >= 10 && i < 15 || i >= 20 && i < 24 && !!(code & (8 >> (i - 20))));
}
