import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';

// One packaging path for local builds and GitHub Actions / Pages.
const input = new URL('../source-microbit/built/binary.hex', import.meta.url);
const output = new URL('../source/public/firmware/microbit-face/', import.meta.url);
const bytes = await readFile(input);
if (!bytes.length || bytes[0] !== 58) throw new Error('Missing or invalid compiled micro:bit HEX. Run the MakeCode build first.');
await mkdir(output, { recursive: true });
await copyFile(input, new URL('city-face.hex', output));
await writeFile(new URL('city-face.hex.sha256', output), `${createHash('sha256').update(bytes).digest('hex')}  city-face.hex\n`);
console.log('Packaged city-face.hex and SHA-256 checksum for the site.');
