import type { ArtBot } from '../robot/botHistory';

export const accessibilityBarriers = {
  uneven: { name: 'Uneven paving', action: 'Smooth the paving', before: 'Broken, uneven paving', after: 'Smooth, level paving',
    description: 'Uneven surfaces can obstruct people using mobility aids or with balance difficulties.',
    support: 'A smooth, level surface removes the balance demand.', alert: 'The paving is too uneven.' },
  slope: { name: 'Steep slope', action: 'Add a gentle zigzag ramp', before: 'Steep route', after: 'Gentle zigzag ramp',
    description: 'Steep gradients can make a route difficult for people with limited strength or mobility.',
    support: 'A longer, gentler ramp reduces the power needed to climb.', alert: 'The slope is too steep.' },
  rest: { name: 'Long route without rest points', action: 'Add rest and charging points', before: 'No rest points', after: 'Regular rest and charging points',
    description: 'Long stretches without seating can exclude people with fatigue or limited stamina.',
    support: 'Regular places to stop, sit and recharge break up the journey.', alert: 'There are no rest points along this stretch.' },
  signage: { name: 'Small-print directions', action: 'Add large-print, sound and tactile signs', before: 'Small-print signs only', after: 'Large-print, sound and tactile signs',
    description: 'Small-print directions can exclude people who cannot read them visually.',
    support: 'Large, clear text, spoken directions and tactile markers offer several ways to find the route.', alert: 'The direction signs are too small to read.' },
  announcement: { name: 'Sound-only directions', action: 'Add visual and tactile directions', before: 'Sound-only directions', after: 'Sound, visual and tactile directions',
    description: 'Spoken directions alone can exclude people who cannot hear the announcement.',
    support: 'Clear visual directions and tactile markers provide alternatives to sound.', alert: 'The directions are only available as sound.' },
} as const;
export type AccessibilityBarrierKind = keyof typeof accessibilityBarriers;
export function isAccessibilityBarrier(kind: string): kind is AccessibilityBarrierKind {
  return Object.hasOwn(accessibilityBarriers, kind);
}

/** These thresholds are game rules, not measurements of human disability. */
export function accessibilityBarrierProblem(kind: AccessibilityBarrierKind, bot: ArtBot): string | null {
  const abilities = bot.profile.effectiveAbilities, functions = bot.profile.enabledFunctions;
  const requirement = {
    uneven: { passes: functions.includes('balance') && abilities.balance >= 55, text: `needs active balance and 55 balance; this robot has ${abilities.balance}` },
    slope: { passes: abilities.burstPower >= 60, text: `needs 60 burst power; this robot has ${abilities.burstPower}` },
    rest: { passes: abilities.endurance >= 60, text: `needs 60 endurance; this robot has ${abilities.endurance}` },
    signage: { passes: functions.includes('vision') && abilities.visualDetail >= 60, text: `needs robot eyes and 60 visual detail; this robot has ${abilities.visualDetail}` },
    announcement: { passes: functions.includes('hearing'), text: 'needs robot ears to receive sound-only directions' },
  }[kind];
  const barrier = accessibilityBarriers[kind];
  return requirement.passes ? null : `${barrier.name}: ${requirement.text}. ${barrier.action}. ${barrier.description}`;
}
