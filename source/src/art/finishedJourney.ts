import { SoundEffect } from '../audio/SoundEffect';
import type { SoundSequenceEntry } from '../audio/SoundEffect';
import type { PaintStroke } from './ProceduralPainting';
import type { RobotRun, RobotMetadata } from '../robot/robotState';
import { ArtworkTitleGenerator } from './ArtworkTitleGenerator';
import type { ArtworkTitle } from './ArtworkTitleGenerator';
import { normaliseArtist } from './artistStyles';
import type { ArtistPreferences } from './artistStyles';

export interface FinishedJourney {
  name: string; robotId: number; runId: number; seed: number; bpm: number;
  steps: number; discoveries: number; improvements: number;
  marks: PaintStroke[]; score: SoundSequenceEntry[];
  artworkTitle: ArtworkTitle;
  artist: ArtistPreferences;
  robot: Pick<RobotMetadata, 'appearance' | 'profile'>;
}

/** The exhibition owns a detached record, so another journey cannot rewrite its artwork or music. */
export function captureFinishedJourney(run: RobotRun): FinishedJourney {
  if (run.status !== 'completed' || !run.creative) throw new Error('Finish a creative journey before presenting it.');
  run.creative.title ??= new ArtworkTitleGenerator(run.creative.seed).generate({
    steps: run.metrics.stepsTaken, discoveries: run.pickups.length,
    improvements: run.metrics.interventions, marks: run.creative.marks,
  });
  return structuredClone({ name: run.metadata.name, robotId: run.metadata.id, runId: run.id,
    robot: { appearance: run.metadata.appearance, profile: run.metadata.profile },
    seed: run.creative.seed, bpm: run.creative.bpm, steps: run.metrics.stepsTaken,
    discoveries: run.pickups.length, improvements: run.metrics.interventions,
    marks: run.creative.marks, score: run.creative.score, artworkTitle: run.creative.title,
    artist: run.creative.artist ?? normaliseArtist(run.metadata.creative ? {
      painter: run.metadata.creative.artStyle === 'expressive' ? 'expressionist' : run.metadata.creative.artStyle,
      musician: run.metadata.creative.musicStyle,
    } : run.metadata.profile.artist) });
}

export function musicDuration(score: readonly SoundSequenceEntry[]) {
  if (!score.length) return 0;
  const origin = score[0]!.at;
  return Math.max(...score.map(entry => entry.at - origin + SoundEffect.fromScore(entry.score).duration));
}
