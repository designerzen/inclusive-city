import type { PlannedJourney } from '../simulation/plannedJourney';
import { robotFootprint, streetActions } from '../city/proceduralCity';

/** Match the next repair step, including crossings and doors with multiple needs. */
export function cityIssueAction(journey: PlannedJourney): string | null {
  const block = journey.blocked;
  if (!block) return null;
  if (block.id.startsWith('bicycle-')) return 'Move bicycle out of the way';
  if (block.id === 'communication') return 'Add a symbol board';
  if (block.id === 'studio-entrance' && journey.world.studioEntrance) {
    return journey.world.studioEntrance.width < robotFootprint(journey.bot) + .15
      ? 'Widen the studio doorway' : 'Add an automatic door';
  }
  // Physical obstacles need map editing rather than a street-feature repair.
  if (/solid object/.test(block.reason) || block.id.startsWith('wall:') || block.id.startsWith('robot:')) return null;
  const street = journey.world.streets.find(street => street.id === block.id);
  if (!street || street.kind === 'clear') return null;
  if (street.kind === 'crossing') {
    if (journey.reachProblem(street)) return 'Lower the crossing button';
    if (!journey.crossingCue(street)) return 'Add sound and touch signals';
    return 'Give more time to cross';
  }
  return streetActions[street.kind];
}
