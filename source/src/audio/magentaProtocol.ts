export interface QuantizedNote { pitch: number; quantizedStartStep: number; quantizedEndStep: number }
export interface AccompanimentRequest { chord: string; notes: QuantizedNote[] }
export type AccompanimentWorkerRequest = { type: 'initialize' } | (AccompanimentRequest & { type: 'generate' });
export type AccompanimentResponse = { type: 'ready' } | { type: 'notes'; notes: QuantizedNote[] } | { type: 'error'; error: string };
export interface AccompanimentProvider {
  /** Starts preparation on a cache miss; never waits on the audio or animation clock. */
  get(request: AccompanimentRequest): readonly QuantizedNote[] | undefined;
  whenIdle?(): Promise<void>;
}

export const magentaCheckpoint = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv';
