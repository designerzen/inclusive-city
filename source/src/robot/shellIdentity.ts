import qrcode from 'qrcode-generator';

export const shellIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
export const qrReaderSpecification = { kind: 'qr-camera', facing: 'forward', status: 'hardware-required', purpose: 'Read other robot shell identities' } as const;
export function newShellId(): string { return crypto.randomUUID(); }
export function shellPayload(id: string) {
  if (!shellIdPattern.test(id)) throw new Error('Shell identity must contain 1–64 letters, digits, hyphens or underscores.');
  return `IC:SHELL:${id}`;
}
export function parseShellPayload(payload: string): string | undefined {
  const id = payload.startsWith('IC:SHELL:') ? payload.slice(9) : '';
  return shellIdPattern.test(id) ? id : undefined;
}
export function shellQr(id: string) {
  const code = qrcode(0, 'M'); code.addData(shellPayload(id)); code.make();
  const count = code.getModuleCount();
  return { count, quiet: 4, cells: Array.from({ length: count }, (_, y) => Array.from({ length: count }, (_, x) => code.isDark(y, x))) };
}
/** White quiet zone is part of the label, never transparent or cut away. */
export function shellQrSvg(id: string, size = 36) {
  const qr = shellQr(id), units = qr.count + 8;
  const path = qr.cells.flatMap((row, y) => row.flatMap((dark, x) => dark ? [`M${x + 4} ${y + 4}h1v1h-1z`] : [])).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}mm" height="${size}mm" viewBox="0 0 ${units} ${units}" role="img" aria-label="Shell QR identity ${id}"><title>${shellPayload(id)}</title><rect width="${units}" height="${units}" fill="white"/><path d="${path}" fill="black" shape-rendering="crispEdges"/></svg>`;
}
