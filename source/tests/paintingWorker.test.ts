import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AsyncPaintingRenderer } from '../src/art/AsyncPaintingRenderer';
import { PaintingRenderer, ProceduralPainting } from '../src/art/ProceduralPainting';
import type { PaintingRequest, PaintingResponse } from '../src/art/paintingWorkerProtocol';

const tick = async () => { await new Promise(resolve => setTimeout(resolve, 0)); };
function harness() {
  const previousWorker = globalThis.Worker, previousOffscreen = globalThis.OffscreenCanvas;
  class WorkerStub {
    static instance: WorkerStub;
    messages: PaintingRequest[] = [];
    onmessage!: (event: { data: PaintingResponse }) => void;
    terminated = false;
    constructor() { WorkerStub.instance = this; }
    postMessage(message: PaintingRequest) { this.messages.push(structuredClone(message)); }
    terminate() { this.terminated = true; }
    reply(message: PaintingResponse) { this.onmessage({ data: message }); }
  }
  globalThis.Worker = WorkerStub as unknown as typeof Worker;
  globalThis.OffscreenCanvas = class {} as unknown as typeof OffscreenCanvas;
  const painting = new ProceduralPainting(1234);
  const renderer = new AsyncPaintingRenderer(painting);
  const worker = WorkerStub.instance;
  worker.reply({ id: worker.messages[0]!.id, type: 'ready' });
  let copies = 0, closes = 0;
  const context = { clearRect() {}, drawImage() { copies++; } };
  const canvas = { width: 800, height: 400, getContext() { return context; } } as unknown as HTMLCanvasElement;
  const bitmap = () => ({ close() { closes++; } }) as ImageBitmap;
  const mark = (sequence: number) => ({ version: 1, sequence } as any);
  return { painting, renderer, worker, canvas, bitmap, mark, copies: () => copies, closes: () => closes,
    restore() { renderer.dispose(); globalThis.Worker = previousWorker; globalThis.OffscreenCanvas = previousOffscreen; } };
}

test('worker live frames apply backpressure, send only new marks, and stop when settled', async () => {
  const h = harness();
  try {
    h.painting.marks.push(h.mark(1)); h.renderer.frame(h.canvas, 0.1, false);
    const first = h.worker.messages.at(-1)!;
    h.painting.marks.push(h.mark(2));
    for (let i = 0; i < 50; i++) h.renderer.frame(h.canvas, 0.01, false);
    assert.equal(h.worker.messages.length, 2); // init plus one frame
    h.worker.reply({ id: first.id, type: 'bitmap', bitmap: h.bitmap(), settled: true }); await tick();
    assert.equal(h.copies(), 1); assert.equal(h.closes(), 1);
    h.renderer.frame(h.canvas, 0.01, true);
    const second = h.worker.messages.at(-1)!;
    assert.equal(second.type, 'frame');
    if (second.type !== 'frame') throw new Error('Expected frame');
    assert.deepEqual(second.marks.map(mark => mark.sequence), [2]);
    assert.equal(second.seconds, 0.2); assert.equal(second.immediate, true);
    h.worker.reply({ id: second.id, type: 'bitmap', bitmap: h.bitmap(), settled: true }); await tick();
    h.renderer.frame(h.canvas, 0.01, false); assert.equal(h.worker.messages.length, 3);
  } finally { h.restore(); }
});

test('PNG export freezes its score while new journey marks continue', async () => {
  const h = harness();
  try {
    h.painting.marks.push(h.mark(1));
    const exported = h.renderer.exportPNG();
    const request = h.worker.messages.at(-1)!;
    h.painting.marks.push(h.mark(2)); h.painting.marks[0]!.sequence = 99;
    assert.equal(request.type, 'export');
    if (request.type !== 'export') throw new Error('Expected export');
    assert.deepEqual(request.marks.map(mark => mark.sequence), [1]);
    assert.equal(request.width, 2400); assert.equal(request.height, 1200);
    const blob = new Blob(['png'], { type: 'image/png' });
    h.worker.reply({ id: request.id, type: 'blob', blob }); assert.equal(await exported, blob);
  } finally { h.restore(); }
});

test('live mirrors update only after a completed worker frame and stop after disposal', async () => {
  const h = harness();
  let mirrored = 0;
  const mirror = () => { assert.equal(h.copies(), mirrored + 1); mirrored++; };
  try {
    h.renderer.frame(h.canvas, .1, false, mirror);
    assert.equal(mirrored, 0);
    const first = h.worker.messages.at(-1)!;
    h.worker.reply({ id: first.id, type: 'bitmap', bitmap: h.bitmap(), settled: false }); await tick();
    assert.equal(mirrored, 1);
    h.renderer.frame(h.canvas, .1, false, mirror);
    const late = h.worker.messages.at(-1)!;
    h.renderer.dispose();
    h.worker.reply({ id: late.id, type: 'bitmap', bitmap: h.bitmap(), settled: true }); await tick();
    assert.equal(mirrored, 1);
    assert.equal(h.closes(), 2);
  } finally { h.restore(); }
});

test('worker failure falls back to the original complete painting and terminates the worker', async () => {
  const h = harness();
  const original = PaintingRenderer.prototype.frame;
  let fallbackMarks = 0;
  PaintingRenderer.prototype.frame = function () { fallbackMarks = h.painting.marks.length; };
  try {
    h.painting.marks.push(h.mark(1)); h.renderer.frame(h.canvas, 0.1, false);
    h.worker.reply({ id: h.worker.messages.at(-1)!.id, type: 'error', message: 'No offscreen context' }); await tick();
    h.painting.marks.push(h.mark(2)); h.renderer.frame(h.canvas, 0.1, false);
    assert.equal(h.worker.terminated, true); assert.equal(fallbackMarks, 2);
  } finally { PaintingRenderer.prototype.frame = original; h.restore(); }
});

test('disposed renderers reject pending exports and close late bitmaps without painting', async () => {
  const h = harness();
  try {
    const snapshot = h.renderer.snapshot(h.canvas);
    const request = h.worker.messages.at(-1)!;
    const exported = h.renderer.exportPNG();
    const rejection = assert.rejects(exported, /closed/);
    h.renderer.dispose();
    h.worker.reply({ id: request.id, type: 'bitmap', bitmap: h.bitmap(), settled: true });
    await snapshot; await rejection;
    assert.equal(h.worker.terminated, true); assert.equal(h.copies(), 0); assert.equal(h.closes(), 1);
  } finally { h.restore(); }
});
