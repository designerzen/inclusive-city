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

/** Rounded up so a live phase never misleadingly displays zero seconds. */
export function crossingCountdown(signal: ReturnType<typeof crossingSignal>, greenSeconds: number) {
  const remaining = signal.green ? signal.remaining : signal.untilGreen;
  return {
    text: `${signal.green ? 'Cross' : 'Wait'} · ${Math.ceil(remaining)}s`,
    description: signal.green ? 'Time left to cross' : 'Time until green',
    progress: Math.max(0, Math.min(1, remaining / (signal.green ? greenSeconds : 6))),
  };
}
