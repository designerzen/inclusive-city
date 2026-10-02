export const abilityPairs = [
  {
    id: 'speed', primary: 'Speed', secondary: 'Route memory',
    description: 'A faster drive uses more processing time, leaving less for remembering directions.',
    support: 'Frequent landmarks and route reminders help a faster, more forgetful bot.',
  },
  {
    id: 'agility', primary: 'Agility', secondary: 'Balance',
    description: 'A nimble chassis turns quickly; a steadier chassis favours planted, measured movement.',
    support: 'Smooth paving and level routes help a nimble bot stay steady.',
  },
  {
    id: 'visualDetail', primary: 'Visual detail', secondary: 'Wide awareness',
    description: 'Sensors can focus on fine detail or scan a wider area, sharing the same sensing budget.',
    support: 'Clear signs and repeated cues help both focused and wide-scanning sensors.',
  },
  {
    id: 'reach', primary: 'Reach', secondary: 'Compactness',
    description: 'Longer arms reach more places but need more room; a compact bot fits smaller spaces.',
    support: 'Generous clearances help long arms; lower collection points help compact bots.',
  },
  {
    id: 'burstPower', primary: 'Burst power', secondary: 'Endurance',
    description: 'A high-output motor delivers stronger bursts but leaves less energy for long journeys.',
    support: 'Nearby charging and rest points help a powerful bot go further.',
  },
] as const;

export type AbilityId = typeof abilityPairs[number]['id'];
export type AbilityAllocation = Record<AbilityId, number>;

export function clampAllocation(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 50;
}

export function defaultAbilities(): AbilityAllocation {
  return { speed: 50, agility: 50, visualDetail: 50, reach: 50, burstPower: 50 };
}

// One stored allocation per pair prevents the two linked attributes drifting apart.
export function deriveAbilities(allocation: AbilityAllocation) {
  const speed = clampAllocation(allocation.speed);
  const agility = clampAllocation(allocation.agility);
  const visualDetail = clampAllocation(allocation.visualDetail);
  const reach = clampAllocation(allocation.reach);
  const burstPower = clampAllocation(allocation.burstPower);
  return {
    speed, routeMemory: 100 - speed, forgetfulness: speed,
    agility, balance: 100 - agility,
    visualDetail, wideAwareness: 100 - visualDetail,
    reach, compactness: 100 - reach,
    burstPower, endurance: 100 - burstPower,
  };
}

export type RobotAbilities = ReturnType<typeof deriveAbilities>;
