/** Pedestrian red, green, then clearance while road traffic stays stopped. */
export function crossingSignal(time: number, greenSeconds: number) {
  const redSeconds = 4, clearanceSeconds = 2;
  const cycle = redSeconds + greenSeconds + clearanceSeconds;
  const phase = ((time % cycle) + cycle) % cycle;
  const green = phase >= redSeconds && phase < redSeconds + greenSeconds;
  return {
    green,
    remaining: green ? redSeconds + greenSeconds - phase : 0,
    untilGreen: Math.max(1e-7, phase < redSeconds ? redSeconds - phase : cycle - phase + redSeconds),
    clearance: phase >= redSeconds + greenSeconds,
  };
}
