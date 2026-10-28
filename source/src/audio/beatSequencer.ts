/** Eighth-note steps share the song's tempo and restart on each bar. */
export function beatStep(seconds: number, bpm: number) {
  return Math.max(0, seconds) * bpm / 30;
}

/** Skip missed beats after a stall; never play a burst of old notes. */
export function upcomingBeatSteps(seconds: number, bpm: number, after: number, duration: number) {
  const first = Math.max(after + 1, Math.ceil(beatStep(seconds, bpm)));
  const last = Math.floor(beatStep(Math.min(seconds + .15, duration), bpm));
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => first + i)
    .filter(step => step * 30 / bpm < duration);
}
