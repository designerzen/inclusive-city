import type { PlannedJourney } from '../simulation/plannedJourney';
import { interpretCityReply } from './cityReply';
import type { CityReply } from './cityReply';

export interface SpokenChoice { name: string; phrase: string; description: string }
export interface SpokenTool { name: string; description: string; parameters: { type: 'object'; properties: Record<string, never>; additionalProperties: false } }

/** Targets and dimensions are resolved by the city, never supplied by the model. */
export function citySpokenChoices(journey: PlannedJourney): SpokenChoice[] {
  const candidates: SpokenChoice[] = [
    { name: 'addRamp', phrase: 'Add a ramp', description: 'Add ramp access at the current steps, bridge or high curb.' },
    { name: 'lowerCurb', phrase: 'Lower the curb', description: 'Add a cut curb or dropped kerb at the current high curb.' },
    { name: 'addCutCurb', phrase: 'Add a cut curb', description: 'Create a dropped curb for accessible pavement access.' },
    { name: 'addElevator', phrase: 'Add an elevator', description: 'Add a lift at the current bridge.' },
    { name: 'extendCrossingTime', phrase: 'Give me more time to cross', description: 'Allow enough time for this robot to cross.' },
    { name: 'lowerCrossingPanel', phrase: 'Lower the button', description: 'Lower the crossing button within reach.' },
    { name: 'addCrossingCues', phrase: 'Add a beeper', description: 'Add audible and tactile crossing cues.' },
    { name: 'widenCurrentPassage', phrase: 'Make it wider', description: 'Widen the current passage for the robot.' },
    { name: 'clearCurrentBicycle', phrase: 'Move that bicycle', description: 'Move the blocking bicycle out of the way.' },
    { name: 'openStudioEntrance', phrase: 'Change the door', description: 'Make the studio entrance accessible.' },
    { name: 'addRouteGuidance', phrase: 'Add route cues', description: 'Add guidance at the current barrier.' },
  ];
  return candidates.filter(choice => {
    const action = interpretCityReply(choice.phrase, journey).action;
    return action && 'id' in action && journey.canEdit(action.id);
  }).slice(0, 8).concat([
    { name: 'explainCurrentBarrier', phrase: 'Why are you stuck?', description: 'Explain the current barrier without changing the city.' },
    { name: 'noAction', phrase: "Don't change anything", description: 'Make no change for negated, irrelevant or conflicting requests.' },
  ]);
}
export function spokenTools(choices: SpokenChoice[]): SpokenTool[] {
  return choices.map(({ name, description }) => ({ name, description, parameters: { type: 'object', properties: {}, additionalProperties: false } }));
}
export function validateSpokenCall(value: unknown, choices: SpokenChoice[]): SpokenChoice | undefined {
  if (!Array.isArray(value) || value.length !== 1) return;
  const call = value[0];
  if (!call || typeof call !== 'object' || Object.keys(call).some(key => !['name', 'arguments'].includes(key))) return;
  if (!call.arguments || typeof call.arguments !== 'object' || Array.isArray(call.arguments) || Object.keys(call.arguments).length) return;
  return choices.find(choice => choice.name === call.name);
}
export function resolveSpokenChoice(choice: SpokenChoice, journey: PlannedJourney): CityReply {
  return interpretCityReply(choice.phrase, journey);
}
