import { bodyColours } from './appearance';
import type { RobotAppearance } from './appearance';
import type { AbilityAllocation } from './abilities';
import { createRobotProfile } from './functions';
import type { FunctionId } from './functions';
import type { CreativePreferences } from './creativePreferences';

export const robotPresets = [
  { id: 'monet', name: 'MonetBot', description: 'Fine detail, patient brushwork · impressionistic painting',
    shape: 'rounded', colour: 0, size: [1.2, 0.95, 1.1],
    abilities: [25, 30, 90, 70, 20], functions: ['movement', 'vision', 'balance'],
    creative: { artStyle: 'impressionist', musicStyle: 'ambient', medium: 'painting' } },
  { id: 'donk', name: 'donkBot', description: 'Fast bursts, sharp turns · techno music',
    shape: 'cylinder', colour: 2, size: [0.9, 1.1, 0.95],
    abilities: [90, 85, 25, 30, 90], functions: ['movement', 'hearing', 'balance'],
    creative: { artStyle: 'geometric', musicStyle: 'techno', medium: 'music' } },
  { id: 'hokusai', name: 'HokusaiBot', description: 'Long reach, steady pace · flowing ink paintings',
    shape: 'box', colour: 4, size: [0.9, 1.25, 0.8],
    abilities: [30, 20, 75, 90, 35], functions: ['movement', 'vision', 'memory'],
    creative: { artStyle: 'ink', musicStyle: 'ambient', medium: 'painting' } },
  { id: 'calder', name: 'CalderBot', description: 'Nimble, compact gestures · geometric art and jazz',
    shape: 'rounded', colour: 1, size: [0.75, 0.8, 0.95],
    abilities: [65, 90, 45, 20, 50], functions: ['movement', 'vision', 'hearing'],
    creative: { artStyle: 'geometric', musicStyle: 'jazz', medium: 'painting' } },
  { id: 'aria', name: 'AriaBot', description: 'Strong route memory, lasting energy · melodic chimes',
    shape: 'cylinder', colour: 3, size: [1.05, 1.1, 1.1],
    abilities: [15, 45, 35, 50, 10], functions: ['movement', 'hearing', 'memory'],
    creative: { artStyle: 'expressive', musicStyle: 'chimes', medium: 'music' } },
] as const;

export function presetDesign(presetId: string, id: number) {
  const preset = robotPresets.find(item => item.id === presetId);
  if (!preset) throw new Error('Unknown robot preset.');
  const [speed, agility, visualDetail, reach, burstPower] = preset.abilities;
  const allocation: AbilityAllocation = { speed, agility, visualDetail, reach, burstPower };
  const appearance: RobotAppearance = { shape: preset.shape, colour: bodyColours[preset.colour],
    width: preset.size[0], height: preset.size[1], depth: preset.size[2] };
  return { id, name: preset.name, presetId, appearance,
    profile: createRobotProfile(allocation, preset.functions as readonly FunctionId[], {
      painter: preset.creative.artStyle === 'expressive' ? 'expressionist' : preset.creative.artStyle,
      musician: preset.creative.musicStyle,
    }),
    creative: { ...preset.creative } as CreativePreferences };
}
