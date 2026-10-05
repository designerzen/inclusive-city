import * as tf from '@tensorflow/tfjs';
import { magentaCheckpoint } from './magentaProtocol';
import type { AccompanimentWorkerRequest, AccompanimentResponse } from './magentaProtocol';
import { savedMagentaFetch } from './magentaModelCache';
import type { MusicRNN } from '@magenta/music/esm/music_rnn';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<AccompanimentWorkerRequest>) => void) | null;
  postMessage(message: AccompanimentResponse): void;
};
let model: MusicRNN | undefined;
scope.onmessage = async ({ data }) => {
  try {
    if (!model) {
      // Magenta 1.23's compatibility module reads window.fetch even inside a worker.
      // Only expose the worker's own globals; inference never uses DOM or audio players.
      Object.assign(globalThis, { window: self, fetch: savedMagentaFetch });
      await tf.setBackend('cpu');
      await tf.ready();
      const { MusicRNN } = await import('@magenta/music/esm/music_rnn');
      model = new MusicRNN(magentaCheckpoint);
      await model.initialize();
    }
    if (data.type === 'initialize') { scope.postMessage({ type: 'ready' }); return; }
    const started = performance.now();
    const primerSteps = data.primerSteps ?? 16, steps = data.steps ?? 16, temperature = data.temperature ?? .75;
    if (!Number.isInteger(primerSteps) || primerSteps < 1 || primerSteps > 32
      || !Number.isInteger(steps) || steps < 1 || steps > 64
      || !Number.isFinite(temperature) || temperature < .1 || temperature > 1.2) throw new Error('Invalid generation request.');
    const result = await model.continueSequence({
      notes: data.notes,
      quantizationInfo: { stepsPerQuarter: 4 }, totalQuantizedSteps: primerSteps,
    }, steps, temperature, data.chords ?? [data.chord]);
    scope.postMessage({ type: 'notes', inferenceMs: performance.now() - started, notes: (result.notes ?? []).map(note => ({
      pitch: note.pitch!, quantizedStartStep: note.quantizedStartStep!, quantizedEndStep: note.quantizedEndStep!,
    })) });
  } catch {
    model?.dispose(); model = undefined;
    scope.postMessage({ type: 'error', error: 'The saved music model could not start. Please retry or reload.' });
  }
};
