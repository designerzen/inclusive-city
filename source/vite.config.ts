import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { cp, copyFile, mkdir, readFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const moonshine = dirname(require.resolve('@moonshine-ai/moonshine-wasm/moonshine.wasm'));
const isolationWorker = require.resolve('coi-serviceworker/coi-serviceworker.js');
const onnx = dirname(require.resolve('onnxruntime-web'));
const hardwareDownloads = [
  ['firmware/arduino-city-face/arduino-city-face.ino', 'arduino/arduino-city-face/arduino-city-face.ino'],
  ['firmware/arduino-city-face/README.md', 'arduino/arduino-city-face/README.md'],
  ['firmware/microbit-face/README.md', 'microbit/city-face/README.md'],
  ['firmware/robot-comms/README.md', 'microbit/robot-comms/README.md'],
].map(([url, source]) => ({ url, path: resolve(import.meta.dirname, 'hardware', source) }));
let configBase = '/';
const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

// Keep Emscripten and its worker URLs together, outside Vite's JS bundling.
// Static hosts get the same isolation through the bundled service worker.
export default defineConfig({
  build: { rollupOptions: { input: { city: resolve(import.meta.dirname, 'index.html'), robotBody: resolve(import.meta.dirname, 'robot-body.html'), trafficLight: resolve(import.meta.dirname, 'traffic-light.html'), figureEight: resolve(import.meta.dirname, 'figure-eight.html'), robotComms: resolve(import.meta.dirname, 'robot-comms.html') } } },
  worker: { format: 'es' },
  server: { headers }, preview: { headers },
  plugins: [{
    name: 'hardware-downloads',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? '').split('?')[0];
        const download = hardwareDownloads.find(file => url === `${server.config.base}${file.url}`);
        if (!download) { next(); return; }
        try {
          const bytes = await readFile(download.path);
          res.setHeader('Content-Type', download.url.endsWith('.md') ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8');
          res.end(bytes);
        } catch (error) { next(error); }
      });
    },
    async writeBundle(options) {
      await Promise.all(hardwareDownloads.map(async download => {
        const output = resolve(options.dir ?? 'dist', download.url);
        await mkdir(dirname(output), { recursive: true });
        await copyFile(download.path, output);
      }));
    },
  }, {
    name: 'moonshine-assets',
    transformIndexHtml(_html, context) {
      const base = context.server?.config.base ?? configBase;
      return [{ tag: 'script', attrs: { src: `${base}coi-serviceworker.js` }, injectTo: 'head' }];
    },
    configResolved(config) { configBase = config.base; },
    configureServer(server) {
      // Vite's transformed worker responses can finish before server.headers.
      server.middlewares.use((_req, res, next) => {
        for (const [header, value] of Object.entries(headers)) res.setHeader(header, value);
        next();
      });
      server.middlewares.use(async (req, res, next) => {
        if ((req.url ?? '').split('?')[0] !== `${server.config.base}coi-serviceworker.js`) { next(); return; }
        res.setHeader('Content-Type', 'text/javascript');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(await readFile(isolationWorker));
      });
      server.middlewares.use('/moonshine', async (req, res, next) => {
        const name = (req.url ?? '').split('?')[0]!.slice(1);
        if (!/^[\w.-]+\.(?:js|mjs|wasm)$/.test(name)) { next(); return; }
        try {
          const bytes = await readFile(join(moonshine, name));
          for (const [header, value] of Object.entries(headers)) res.setHeader(header, value);
          res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
          res.end(bytes);
        } catch { next(); }
      });
      server.middlewares.use('/onnxruntime', async (req, res, next) => {
        const name = (req.url ?? '').split('?')[0]!.slice(1);
        if (!/^ort-wasm[\w.-]+\.(mjs|wasm)$/.test(name)) { next(); return; }
        try {
          res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
          res.end(await readFile(join(onnx, name)));
        } catch { next(); }
      });
    },
    async writeBundle(options) {
      await cp(moonshine, resolve(options.dir ?? 'dist', 'moonshine'), { recursive: true });
      await copyFile(isolationWorker, resolve(options.dir ?? 'dist', 'coi-serviceworker.js'));
      await cp(onnx, resolve(options.dir ?? 'dist', 'onnxruntime'), { recursive: true, filter: path => path === onnx || /ort-wasm-simd-threaded\.(mjs|wasm)$/.test(path) });
    },
  }],
});
