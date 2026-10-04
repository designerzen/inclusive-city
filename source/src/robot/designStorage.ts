import { abilityPairs } from './abilities';
import { bodyColours, bodyShapes } from './appearance';
import { createRobotProfile } from './functions';
import { robotPresets } from './presets';
import { musicianStyles, painterStyles } from '../art/artistStyles';
import type { ArtBot } from './botHistory';

export const robotDesignStorageKey = 'inclusive-city-robot-designs';
export type DesignStorage = Pick<Storage, 'getItem' | 'setItem'>;
export type RobotDesign = Omit<ArtBot, 'record'>;
export interface SavedDesigns { version: 1; cursor: number; bots: RobotDesign[] }

const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
const boundedNumber = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

function validDesign(value: unknown, index: number): value is RobotDesign {
  if (!object(value) || value.id !== index + 1 || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 60) return false;
  const { appearance, profile, creative } = value;
  if (!object(appearance) || !bodyShapes.some(shape => shape === appearance.shape) || !object(appearance.colour)) return false;
  const colour = appearance.colour;
  if (!bodyColours.some(item => item.hex === colour.hex && item.name === colour.name)
    || !['width', 'height', 'depth'].every(key => boundedNumber(appearance[key], .5, 2))) return false;
  if (!object(profile) || !object(profile.abilities) || !Array.isArray(profile.enabledFunctions) || !object(profile.artist)) return false;
  const abilities = profile.abilities;
  const artist = profile.artist;
  if (!abilityPairs.every(pair => Number.isInteger(abilities[pair.id]) && boundedNumber(abilities[pair.id], 0, 100))
    || !painterStyles.some(style => style.id === artist.painter) || !musicianStyles.some(style => style.id === artist.musician)) return false;
  if (value.presetId !== undefined && !robotPresets.some(preset => preset.id === value.presetId)) return false;
  return creative === undefined || (object(creative) && (creative.medium === 'painting' || creative.medium === 'music')
    && (creative.artStyle === 'expressive' || painterStyles.some(style => style.id === creative.artStyle))
    && musicianStyles.some(style => style.id === creative.musicStyle));
}

export function loadDesigns(storage?: DesignStorage): SavedDesigns | undefined {
  try {
    const raw = storage?.getItem(robotDesignStorageKey);
    if (!raw) return;
    const saved: unknown = JSON.parse(raw);
    if (!object(saved) || saved.version !== 1 || !Array.isArray(saved.bots) || !saved.bots.length
      || !Number.isInteger(saved.cursor) || !boundedNumber(saved.cursor, 0, saved.bots.length - 1) || !saved.bots.every(validDesign)) return;
    // Rebuild derived abilities and validate the three-function selection.
    const bots = saved.bots.map((bot: RobotDesign) => ({ ...bot, profile: createRobotProfile(bot.profile.abilities, bot.profile.enabledFunctions.map(id => (id as string) === 'movement' ? 'communication' : id), bot.profile.artist) }));
    if (new Set(bots.filter(bot => bot.presetId).map(bot => bot.presetId)).size !== bots.filter(bot => bot.presetId).length) return;
    return { version: 1, cursor: saved.cursor, bots };
  } catch { /* Corrupt or unavailable storage must not prevent startup. */ }
}

export function saveDesigns(storage: DesignStorage | undefined, bots: readonly ArtBot[], cursor: number) {
  try {
    storage?.setItem(robotDesignStorageKey, JSON.stringify({ version: 1, cursor,
      bots: bots.map(({ record: _record, ...design }) => design) }));
  } catch { /* The designer still works when storage is blocked or full. */ }
}
