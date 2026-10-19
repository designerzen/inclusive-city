import type { PlannedJourney } from '../simulation/plannedJourney';
import { accessibilityBarriers, isAccessibilityBarrier } from '../city/accessibilityBarriers';
import { streetBetween } from '../city/proceduralCity';

export const cityStartNarration = "Here we go! I'll follow our route to the Duet studio. Let's make art and music along the way!";
export const cityResumeNarration = "Ready, adventure buddy? Let's keep going to the Duet studio!";
export const cityIntroduction = (name: string) => `Hello, adventure buddy! I'm ${name}. Help me reach the Duet studio! Places we pass inspire my painting and song. Discoveries are optional. Open Journey inspirations to see what we find.`;
export const cityAlertNarration = [
  'The robot cannot get across this bridge ramp. Add elevators to continue.',
  'A ramp must be brought out before I can board the train.',
  'There is a wall in the way.', 'The path is occupied.', 'There is a bicycle in the way',
  'There is no communication board at the workshop.', 'The studio entrance is blocked.',
  'The studio doorway is too narrow.', 'The revolving door turns too quickly.', 'The push door cannot be opened.',
  'There is an object in the way.', 'The path is blocked.', 'The passage is too narrow.',
  'Steps block the humpback bridge. Add a ramp or elevators.', 'The curb is too high.',
  'There are not enough route signs here.', 'The crossing button is too high.',
  'The crossing has no sound or touch signals.', 'The green light does not last long enough to cross.',
  ...Object.values(accessibilityBarriers).map(barrier => barrier.alert),
] as const;

/** Prepare all possible announcements on the next four route edges, including edits. */
export function upcomingCityNarration(journey: PlannedJourney) {
  const lines = new Set<string>();
  for (let edge = journey.edge; edge < Math.min(journey.route.length - 1, journey.edge + 4); edge++) {
    const street = streetBetween(journey.world, journey.route[edge]!, journey.route[edge + 1]!);
    if (!street) continue;
    if (isAccessibilityBarrier(street.kind)) lines.add(accessibilityBarriers[street.kind].alert);
    const match = street.kind === 'crossing' ? /cross|green light/ : street.kind === 'bridge' || street.kind === 'stairs' ? /bridge/
      : street.kind === 'curb' ? /curb/ : street.kind === 'guidance' ? /route signs/ : street.kind === 'width' ? /passage/ : /path is blocked/;
    for (const line of cityAlertNarration) if (match.test(line)) lines.add(line);
    if (street.id === journey.world.steamTrain?.street) lines.add(cityAlertNarration[1]);
  }
  return [...lines];
}
