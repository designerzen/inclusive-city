import { deriveAbilities } from './abilities';
import type { AbilityAllocation } from './abilities';
import { normaliseArtist } from '../art/artistStyles';
import type { ArtistPreferences } from '../art/artistStyles';

export const robotFunctions = [
  { id: 'movement', label: 'Movement', description: 'Powered movement along city routes.', support: 'Without a drive, accessible transport and assisted movement will help.' },
  { id: 'vision', label: 'Vision', description: 'Visual signs, landmarks and surroundings.', support: 'Without vision, audio and tactile route cues will help.' },
  { id: 'hearing', label: 'Hearing', description: 'Spoken directions and sound signals.', support: 'Without hearing, visual and tactile information will help.' },
  { id: 'memory', label: 'Memory', description: 'Remembering directions between landmarks.', support: 'Without route memory, repeated signs and reminders will help.' },
  { id: 'balance', label: 'Balance', description: 'Active stabilisation on uneven surfaces.', support: 'Without stabilisation, smooth paving and level routes will help.' },
] as const;

export type FunctionId = typeof robotFunctions[number]['id'];

export function defaultFunctions(): FunctionId[] {
  return ['movement', 'vision', 'memory'];
}

function assertSelection(selected: readonly FunctionId[]) {
  if (selected.length !== 3 || new Set(selected).size !== 3 || selected.some(id => !robotFunctions.some(item => item.id === id))) {
    throw new Error('A robot must have exactly three distinct functions.');
  }
}

// Swap atomically: no intermediate profile ever has two or four enabled functions.
// Enabling replaces the longest-active function; disabling enables the first inactive one.
export function toggleFunction(selected: readonly FunctionId[], target: FunctionId) {
  assertSelection(selected);
  if (!robotFunctions.some(item => item.id === target)) throw new Error('Unknown robot function.');
  const wasEnabled = selected.includes(target);
  const replacement = wasEnabled
    ? robotFunctions.find(item => !selected.includes(item.id))!.id
    : selected[0]!;
  const next = wasEnabled
    ? [...selected.filter(id => id !== target), replacement]
    : [...selected.slice(1), target];
  return { selected: next, enabled: wasEnabled ? replacement : target, disabled: wasEnabled ? target : replacement };
}

export function createRobotProfile(allocation: AbilityAllocation, enabledFunctions: readonly FunctionId[], artist?: ArtistPreferences) {
  assertSelection(enabledFunctions);
  const abilities = deriveAbilities(allocation);
  const effectiveAbilities = { ...abilities };
  if (!enabledFunctions.includes('movement')) {
    effectiveAbilities.speed = 0;
    effectiveAbilities.agility = 0;
    effectiveAbilities.burstPower = 0;
    effectiveAbilities.endurance = 0;
  }
  if (!enabledFunctions.includes('vision')) {
    effectiveAbilities.visualDetail = 0;
    effectiveAbilities.wideAwareness = 0;
  }
  if (!enabledFunctions.includes('memory')) {
    effectiveAbilities.routeMemory = 0;
    effectiveAbilities.forgetfulness = 100;
  }
  if (!enabledFunctions.includes('balance')) effectiveAbilities.balance = 0;
  return { abilities, effectiveAbilities, enabledFunctions: [...enabledFunctions], artist: normaliseArtist(artist) };
}

export type RobotProfile = ReturnType<typeof createRobotProfile>;
