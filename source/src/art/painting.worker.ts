import { PaintingRenderer, ProceduralPainting } from './ProceduralPainting';
import type { PaintingRequest, PaintingResponse } from './paintingWorkerProtocol';

// Keep DOM typings out of the worker boundary; this module never accesses document.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<PaintingRequest>) => void) | null;
  postMessage(message: PaintingResponse, transfer?: Transferable[]): void;
};
let painting: ProceduralPainting;
let renderer: PaintingRenderer;
let canvas: OffscreenCanvas;
scope.onmessage = async ({ data }) => {
  try {
    if (data.type === 'init') {
      painting = new ProceduralPainting(data.seed);
      renderer = new PaintingRenderer(painting);
      canvas = new OffscreenCanvas(800, 400);
      if (!canvas.getContext('2d')) throw new Error('Offscreen painting context unavailable.');
      scope.postMessage({ id: data.id, type: 'ready' });
    } else if (data.type === 'frame') {
      painting.marks.push(...data.marks);
      if (canvas.width !== data.width || canvas.height !== data.height) {
        canvas.width = data.width; canvas.height = data.height;
      }
      renderer.frame(canvas.getContext('2d')!, data.seconds, data.immediate);
      const bitmap = canvas.transferToImageBitmap();
      scope.postMessage({ id: data.id, type: 'bitmap', bitmap, settled: renderer.settled }, [bitmap]);
    } else {
      const snapshot = new ProceduralPainting(data.seed);
      snapshot.marks.push(...data.marks);
      const output = new OffscreenCanvas(data.width, data.height);
      PaintingRenderer.render(output.getContext('2d')!, data.width, data.height, snapshot);
      if (data.type === 'export') {
        const blob = await output.convertToBlob({ type: 'image/png' });
        scope.postMessage({ id: data.id, type: 'blob', blob });
      } else {
        const bitmap = output.transferToImageBitmap();
        scope.postMessage({ id: data.id, type: 'bitmap', bitmap, settled: true }, [bitmap]);
      }
    }
  } catch (error) {
    scope.postMessage({ id: data.id, type: 'error', message: error instanceof Error ? error.message : 'Painting worker failed.' });
  }
};
