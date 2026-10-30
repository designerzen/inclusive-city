import type { PlannedJourney } from '../simulation/plannedJourney';
import type { CityStreet } from './proceduralCity';

/** Only the crossing directly affecting the player's robot needs a countdown. */
export function crossingInUse(street: CityStreet,
  journey: Pick<PlannedJourney, 'ready' | 'complete' | 'currentStreet'>) {
  return !journey.ready && !journey.complete && journey.currentStreet?.id === street.id;
}
