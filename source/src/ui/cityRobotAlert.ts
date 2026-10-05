import type { PlannedJourney } from '../simulation/plannedJourney';
import { robotFootprint } from '../city/proceduralCity';

/** Short, factual speech for the robot's bubble and narration. */
export function cityRobotAlert(journey: PlannedJourney): string | null {
  const block = journey.blocked;
  if (!block) return null;
  if (block.id.startsWith('wall:')) return 'There is a wall in the way.';
  if (block.id.startsWith('robot:')) return 'The path is occupied.';
  if (block.id.startsWith('bicycle-')) return 'There is a bicycle in the way';
  if (block.id === 'communication') return 'There is no communication board at the workshop.';
  if (block.id === 'studio-entrance') {
    const entrance = journey.world.studioEntrance;
    if (!entrance) return 'The studio entrance is blocked.';
    if (entrance.width + 1e-8 < robotFootprint(journey.bot) + .15) return 'The studio doorway is too narrow.';
    return entrance.doorType === 'revolving'
      ? 'The revolving door turns too quickly.'
      : 'The push door cannot be opened.';
  }
  // Physics can stop travel on any street, regardless of its planned feature.
  if (/solid object/.test(block.reason)) return 'There is an object in the way.';
  const street = journey.world.streets.find(street => street.id === block.id);
  if (!street) return 'The path is blocked.';
  switch (street.kind) {
    case 'width': return 'The passage is too narrow.';
    case 'stairs': return 'There are steps in the way.';
    case 'curb': return 'The curb is too high.';
    case 'bridge': return 'The bridge is raised.';
    case 'guidance': return 'There are not enough route signs here.';
    case 'crossing':
      if (journey.reachProblem(street)) return 'The crossing button is too high.';
      if (!journey.crossingCue(street)) return 'The crossing has no sound or touch signals.';
      return 'The green light does not last long enough to cross.';
    default: return 'The path is blocked.';
  }
}
