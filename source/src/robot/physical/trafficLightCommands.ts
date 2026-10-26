export interface TrafficLightCommands { start: number; stop: number; approaches: number[]; }
export function defaultTrafficLightCommands(count: number): TrafficLightCommands {
  return { start: 1, stop: 2, approaches: Array(count).fill(4) };
}
export function validateTrafficLightCommands(value: TrafficLightCommands, count: number) {
  const valid = (code: number) => Number.isInteger(code) && code >= 0 && code <= 15;
  if (!value || !valid(value.start) || !valid(value.stop) || !Array.isArray(value.approaches) || value.approaches.length !== count || !value.approaches.every(valid)) throw new Error('Choose a command from 0 to F for each action.');
  return { start: value.start, stop: value.stop, approaches: [...value.approaches] };
}
