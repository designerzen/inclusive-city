export interface RoutePoint { x: number; y: number; z: number }
export const cityRoute: readonly RoutePoint[] = [
  { x: -21, y: 0.14, z: -15 }, { x: -13, y: 0.14, z: -15 },
  { x: -10, y: 0.14, z: -15 }, { x: -10, y: 0.14, z: -9 },
  { x: -10, y: 0.14, z: -4 }, { x: -4, y: 0.14, z: -4 },
  { x: 0, y: 0.14, z: -4 }, { x: 7, y: 0.14, z: -4 },
  { x: 10, y: 0.14, z: -4 }, { x: 10, y: 0.94, z: 4 },
  { x: 15, y: 0.94, z: 4 }, { x: 15, y: 2.74, z: 4 },
  { x: 20, y: 2.74, z: 4 },
  { x: 20, y: 2.74, z: 0 }, { x: 24, y: 2.74, z: 0 },
];

export const cityBarriers = [
  { id: 'transport', edge: 0, label: 'Movement support', action: 'Add accessible transport', explanation: 'The drive is disabled. Accessible transport can carry this bot along the route.' },
  { id: 'curb', edge: 1, label: 'Raised curb', action: 'Lower curb', explanation: 'The raised curb blocks the wheels. A dropped curb connects the sidewalk to the crossing.' },
  { id: 'crossing', edge: 2, label: 'Short crossing signal', action: 'Extend crossing time', explanation: 'The signal changes before this bot can cross safely. Give it more time.' },
  { id: 'guidance', edge: 3, label: 'Route information', action: 'Add accessible route cues', explanation: 'Repeated audio and tactile cues support this bot’s vision and route-memory needs.' },
  { id: 'sidewalk', edge: 4, label: 'Narrow sidewalk', action: 'Widen sidewalk', explanation: 'The passage is narrower than this bot. Move the boundary to provide more clearance.' },
  { id: 'bridge', edge: 6, label: 'Raised bridge', action: 'Lower bridge', explanation: 'The raised bridge interrupts the route across the river.' },
  { id: 'stairs', edge: 8, label: 'Stairs', action: 'Add ramp', explanation: 'Wheels cannot follow these steps. A smooth ramp connects the two levels.' },
  { id: 'elevator', edge: 10, label: 'Elevator unavailable', action: 'Enable elevator', explanation: 'The gallery is on another level. Enable the elevator to provide step-free access.' },
] as const;

export type BarrierId = typeof cityBarriers[number]['id'];
export type CityBarrier = typeof cityBarriers[number];

export const cityPickups = [
  { id: 'crossing-fragment', node: 3, kind: 'art-fragment', value: 1 },
  { id: 'river-fragment', node: 7, kind: 'art-fragment', value: 2 },
  { id: 'terrace-fragment', node: 9, kind: 'art-fragment', value: 3 },
] as const;

export const cityPowerups = [
  { id: 'music-seed', node: 0, kind: 'music', label: 'Melody spark', description: 'Starts your robot’s journey music', colour: '#b6a1ec', path: [{ x: -18, y: 0.14, z: -15 }, { x: -18, y: 0.14, z: -16 }] },
  { id: 'art-seed', node: 0, kind: 'art', label: 'Drawing spark', description: 'Enriches the painting with expressive brushwork', colour: '#f59482', path: [{ x: -24, y: 0.14, z: -15 }, { x: -24, y: 0.14, z: -16 }] },
  { id: 'harmony-seed', node: 5, kind: 'harmony', label: 'Harmony bloom', description: 'Adds chords and bass to the music', colour: '#81c5ee', path: [{ x: -2, y: 0.14, z: -4 }, { x: -2, y: 0.14, z: -6 }] },
  { id: 'colour-seed', node: 9, kind: 'colour', label: 'Colour prism', description: 'Adds colour and geometric marks to the drawing', colour: '#f3c76b', path: [{ x: 10, y: 0.94, z: 6 }, { x: 11, y: 0.94, z: 6 }] },
] as const;
export type PowerupId = typeof cityPowerups[number]['id'];

export const buildings = [
  { name: 'Workshop', x: -21, z: -19, w: 5, d: 4, h: 2.8 },
  { name: 'Library', x: -16, z: -8, w: 5, d: 5, h: 4.2 },
  { name: 'Cafe', x: -21, z: 1, w: 5, d: 4, h: 2.2 },
  { name: 'Studios', x: -17, z: 9, w: 6, d: 6, h: 5.2 },
  { name: 'Market', x: -7, z: -19, w: 5, d: 4, h: 2.2 },
  { name: 'Offices', x: -5, z: -9, w: 4, d: 4, h: 4.8 },
  { name: 'Flats', x: -5, z: 2, w: 4, d: 5, h: 5.5 },
  { name: 'Cinema', x: -6, z: 10, w: 7, d: 5, h: 3.2 },
  { name: 'School', x: 13, z: -16, w: 6, d: 5, h: 3.8 },
  { name: 'Museum', x: 20, z: -7, w: 5, d: 6, h: 4.3 },
  { name: 'Gallery', x: 21, z: 7, w: 5, d: 5, h: 4, base: 2.6 },
  { name: 'Hall', x: 13, z: 13, w: 5, d: 5, h: 3.6 },
  { name: 'Tower', x: 22, z: 15, w: 4, d: 5, h: 6.5 },
] as const;
