export interface QuantizedNote { pitch: number; quantizedStartStep: number; quantizedEndStep: number }
export interface AccompanimentRequest {
  chord: string; notes: QuantizedNote[];
  /** Chords cover both the primer and continuation, one chord per measure. */
  chords?: string[]; primerSteps?: number; steps?: number; temperature?: number;
}
export type AccompanimentWorkerRequest = { type: 'initialize' } | (AccompanimentRequest & { type: 'generate' });
export type AccompanimentResponse = { type: 'ready' } | { type: 'notes'; notes: QuantizedNote[]; inferenceMs?: number } | { type: 'error'; error: string };
export interface AccompanimentProvider {
  /** Starts preparation on a cache miss; never waits on the audio or animation clock. */
  get(request: AccompanimentRequest, priority?: number): readonly QuantizedNote[] | undefined;
  whenIdle?(): Promise<void>;
  waitFor?(requests: readonly AccompanimentRequest[], timeoutMs?: number): Promise<void>;
}

export const magentaCheckpoint = 'https://storage.googleapis.com/magentadata/js/checkpoints/music_rnn/chord_pitches_improv';
