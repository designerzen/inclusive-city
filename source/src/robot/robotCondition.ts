export type RobotMood = 'curious' | 'sad' | 'happy' | 'celebrating' | 'tired' | 'frustrated';
export interface RobotCondition {
  mood: RobotMood;
  /** Facing direction in radians, matching the rendered robot's Y rotation. */
  direction: number;
  /** Actual travel speed in city units per simulation second. */
  speed: number;
  frustration: number;
  fatigue: number;
}
export const freshCondition = (): RobotCondition => ({ mood: 'curious', direction: 0, speed: 0, frustration: 0, fatigue: 0 });

/** Time-based changes keep feelings independent of animation frame rate. */
export function advanceCondition(condition: RobotCondition, seconds: number, mode: 'moving' | 'blocked' | 'resting' | 'waiting') {
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  condition.fatigue = Math.max(0, Math.min(100, condition.fatigue + seconds * (mode === 'moving' ? .65 : mode === 'blocked' ? .12 : -.9)));
  condition.frustration = Math.max(0, Math.min(100, condition.frustration + seconds * (mode === 'blocked' ? 5 : mode === 'waiting' ? .25 : -3)));
  condition.mood = condition.frustration >= 30 ? 'frustrated' : condition.fatigue >= 55 ? 'tired' : mode === 'blocked' ? 'sad' : 'curious';
}

export function directionLabel(radians: number) {
  // The model faces local -Z. North is -Z on the city map.
  const labels = ['North', 'North-west', 'West', 'South-west', 'South', 'South-east', 'East', 'North-east'];
  return labels[((Math.round(radians / (Math.PI / 4)) % 8) + 8) % 8]!;
}
