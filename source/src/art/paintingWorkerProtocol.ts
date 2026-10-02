import type { PaintStroke } from './ProceduralPainting';

export type PaintingRequest =
  | { id: number; type: 'init'; seed: number }
  | { id: number; type: 'frame'; marks: PaintStroke[]; width: number; height: number; seconds: number; immediate: boolean }
  | { id: number; type: 'snapshot' | 'export'; seed: number; marks: PaintStroke[]; width: number; height: number };

export type PaintingResponse =
  | { id: number; type: 'ready' }
  | { id: number; type: 'bitmap'; bitmap: ImageBitmap; settled: boolean }
  | { id: number; type: 'blob'; blob: Blob }
  | { id: number; type: 'error'; message: string };
