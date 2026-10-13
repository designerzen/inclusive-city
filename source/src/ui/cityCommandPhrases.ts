/** Visible examples are also accepted by the typed/Moonshine interpreter. */
export const cityCommandVariations: Record<string, string[]> = {
  addRamp: ['Put a ramp here', 'Replace the steps with a ramp', 'Make the steps accessible'],
  lowerCurb: ['Drop the kerb', 'Make the curb lower', 'Flatten the curb'],
  addCutCurb: ['Create a curb cut', 'Add a dropped kerb', 'Make a cut in the curb'],
  addElevator: ['Install a lift', 'Put in an elevator', 'Give me lift access'],
  extendCrossingTime: ['Let me cross for longer', 'Keep the crossing green longer', 'Give the robot extra crossing time'],
  lowerCrossingPanel: ['Bring the button within reach', 'Move the crossing panel down', 'Make the button easier to reach'],
  addCrossingCues: ['Turn on the crossing beeper', 'Add audible crossing signals', 'Give me tactile crossing cues'],
  widenCurrentPassage: ['Give me more space', 'Make room for the robot', 'Broaden the passage'],
  clearCurrentBicycle: ['Get that bike out of the way', 'Shift the bicycle', 'Clear the bike from the path'],
  openStudioEntrance: ['Make the door automatic', 'Open the studio entrance', 'Make the entrance accessible'],
  addRouteGuidance: ['Show me the way', 'Add navigation cues', 'Give me route guidance'],
  explainCurrentBarrier: ['What is blocking you', 'Tell me why you stopped', 'What can I change here'],
  noAction: ['Leave things as they are', 'Keep the city unchanged', 'Do nothing'],
};
const canonical: Record<string, string> = {
  addRamp: 'add a ramp', lowerCurb: 'lower the curb', addCutCurb: 'add a cut curb', addElevator: 'add an elevator',
  extendCrossingTime: 'give me more time to cross', lowerCrossingPanel: 'lower the button', addCrossingCues: 'add a beeper',
  widenCurrentPassage: 'make it wider', clearCurrentBicycle: 'move that bicycle', openStudioEntrance: 'change the door',
  addRouteGuidance: 'add route cues', explainCurrentBarrier: 'why are you stuck', noAction: 'do not change anything',
};
export function expandCityCommand(text: string): string {
  // Strip only polite request wrappers, preserving diagnostic questions and negation.
  const request = text.replace(/^(?:please\s+)?(?:can|could|would|will) you\s+/, '').replace(/^please\s+/, '').replace(/\s+please$/, '').trim();
  const normalizeVerbs = (phrase: string) => phrase.replace(/\b(install|build|create)\b/g, 'add')
    .replace(/\b(broaden|expand)\b/g, 'widen')
    .replace(/\b(extra time|additional time)\b/g, 'more time');
  const normalized = normalizeVerbs(request);
  for (const [name, phrases] of Object.entries(cityCommandVariations)) {
    if (phrases.some(phrase => normalizeVerbs(phrase.toLowerCase()) === normalized)) return canonical[name]!;
  }
  return normalized;
}
