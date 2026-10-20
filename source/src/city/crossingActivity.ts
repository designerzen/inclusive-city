import type { PlannedJourney } from '../simulation/plannedJourney';
import type { CityStreet } from './proceduralCity';

type WanderingRobot = { node: { id: string }; target: { id: string } };

/** Only the crossing a robot is using or waiting to enter needs a countdown. */
export function crossingInUse(street: CityStreet,
  journey: Pick<PlannedJourney, 'ready' | 'complete' | 'currentStreet'>,
  robots: readonly WanderingRobot[] = []) {
  if (!journey.ready && !journey.complete && journey.currentStreet?.id === street.id) return true;
  return robots.some(({ node, target }) =>
    node.id === street.a && target.id === street.b || node.id === street.b && target.id === street.a);
}
