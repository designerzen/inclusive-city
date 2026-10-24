import type { PlannedJourney } from '../simulation/plannedJourney';
import type { FaceJourney, FaceMessage } from '../robot/microbitFace';
import { cityRobotAlert } from './cityRobotAlert';

export function cityFaceContext(journey: PlannedJourney) {
  return `${journey.bot.id}:${journey.machine.run.id}:${journey.ready}:${journey.paused}:${journey.complete}:${journey.blocked?.id ?? ''}:${cityRobotAlert(journey) ?? ''}:${journey.waiting}`;
}
export interface CityFaceSpeech extends FaceMessage { context: string }

/** Uses the same obstacle wording and condition record as the on-screen robot. */
export function cityFaceSnapshot(journey: PlannedJourney, spoken?: CityFaceSpeech): FaceJourney {
  const context = cityFaceContext(journey), alert = cityRobotAlert(journey);
  const status = journey.complete ? "I've reached the Duet studio! Time for our duet."
    : journey.paused ? 'Journey paused.' : journey.waiting ? "I'm waiting for a green light and enough time to cross." : undefined;
  const message = alert ? { id: `alert:${context}`, text: alert }
    : spoken?.context === context ? spoken
    : status ? { id: `status:${context}`, text: status } : undefined;
  return { complete: journey.complete, ready: journey.ready, paused: journey.paused, blocked: journey.blocked,
    waiting: journey.waiting, mood: journey.machine.record.condition.mood, message };
}
