import type { PlannedJourney } from '../simulation/plannedJourney';
import { streetBetween, streetNames } from './proceduralCity';
import type { RouteTrajectory } from './routeTrajectory';
import { defaultProjectionSettings, validateProjectionSettings, type ProjectionSettings } from './projectionSettings';

// Half, single and double tape widths, as in the RIX line-reader format.
export const barcodeUnit = .08;
export const barcodeGap = .16;
export const barcodeSpan = 1.44;
export const projectionLineWidth = .16;
export const projectionCodes = ['Start journey', 'Raised curb', 'Bridge / steps', 'Narrow passage', 'Pelican crossing', 'Route cues', 'Train boarding', 'Bicycle', 'Music discovery', 'Art discovery', 'Harmony discovery', 'Colour discovery', 'Studio arrival', 'Junction reached'] as const;

export function barcodeWidths(code: number, settings: ProjectionSettings = defaultProjectionSettings) {
  if (!Number.isInteger(code) || code < 0 || code > 15) throw new RangeError('Barcode must be a four-bit integer.');
  return [settings.markerLength, ...code.toString(2).padStart(4, '0').split('').map(bit => bit === '1' ? settings.longLength : settings.shortLength), settings.markerLength];
}

/** Merge only collinear segments; short curve facets cannot fit a barcode. */
export function straightSections(trajectory: Pick<RouteTrajectory, 'points' | 'distances'>, clearance = .4) {
  const sections: { start: number; end: number; heading: number; dx: number; dz: number }[] = [];
  for (let i = 1; i < trajectory.points.length; i++) {
    const a = trajectory.points[i - 1]!, b = trajectory.points[i]!;
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 1e-8) continue;
    const dx = (b.x - a.x) / length, dz = (b.z - a.z) / length;
    const previous = sections.at(-1);
    if (previous && Math.abs(previous.dx * dz - previous.dz * dx) < 1e-8
      && previous.dx * dx + previous.dz * dz > 0 && Math.abs(previous.end - trajectory.distances[i - 1]!) < 1e-8) {
      previous.end = trajectory.distances[i]!;
    } else sections.push({ start: trajectory.distances[i - 1]!, end: trajectory.distances[i]!, heading: Math.atan2(-dx, -dz), dx, dz });
  }
  // Keep the entire barcode away from the transition into each bend.
  return sections.map(section => ({ ...section, start: section.start + clearance, end: section.end - clearance }))
    .filter(section => section.end > section.start);
}

export function routeProjection(journey: PlannedJourney, preferences: ProjectionSettings = defaultProjectionSettings) {
  const settings = validateProjectionSettings(preferences);
  const trajectory = journey.trajectory;
  const markers: { code: number; node: string; label: string; distance: number; bars: { x: number; z: number; angle: number; width: number }[] }[] = [];
  const junctions = journey.route.map((id, index) => {
    const node = journey.world.nodes.find(node => node.id === id)!;
    const street = streetBetween(journey.world, id, journey.route[index + 1]!);
    const events: { code: number; label: string; node: string }[] = [];
    const add = (code: number, label: string = projectionCodes[code]!) => events.push({ code, label, node: node.label });
    if (index === 0) add(0);
    if (street) {
      const code = { clear: -1, curb: 1, bridge: 2, stairs: 2, width: 3, crossing: 4, guidance: 5 }[street.kind];
      if (code >= 0) add(code, streetNames[street.kind]);
      if (street.id === journey.world.steamTrain?.street) add(6);
      if (journey.world.bicycles?.some(bike => bike.street === street.id)) add(7);
    }
    if (node.discovery) add({ music: 8, art: 9, harmony: 10, colour: 11 }[node.discovery]);
    if (id === journey.world.destination) add(12);
    if (!events.length && index > 0) add(13);
    const milestone = trajectory.milestones[index] ?? 0;
    return { events, milestone };
  }).filter(junction => junction.events.length);
  const events = junctions.flatMap(junction => junction.events.map(event => ({ ...event, milestone: junction.milestone,
    length: barcodeWidths(event.code, settings).reduce((a, b) => a + b, 0) + settings.barGap * 5 })));
  const sections = straightSections(trajectory, settings.bendClearance);
  const reversedSections = [...sections].reverse();
  let scale = 1;
  let placements: { distance: number; heading: number }[] | undefined;
  for (let step = 10; step >= (settings.autoFit ? 1 : 10) && !placements; step--) {
    scale = step / 10;
    const gap = settings.codeGap;
    // Reserve enough room for later events before choosing the nearest straight
    // section. This prevents an early event from consuming the final free space.
    const latest: number[] = [];
    let limit = Infinity;
    for (let i = events.length - 1; i >= 0; i--) {
      const length = events[i]!.length * scale;
      const section = reversedSections.find(section => Math.min(section.end, limit) - length >= section.start);
      if (!section) break;
      latest[i] = Math.min(section.end, limit) - length;
      limit = latest[i]! - gap;
    }
    if (latest[0] === undefined) continue;
    const candidate: { distance: number; heading: number }[] = [];
    let previousEnd = 0;
    for (let i = 0; i < events.length; i++) {
      const event = events[i]!, length = event.length * scale;
      let best: { distance: number; heading: number; score: number } | undefined;
      for (const section of sections) {
        const low = Math.max(section.start, previousEnd), high = Math.min(section.end - length, latest[i]!);
        if (high < low) continue;
        const distance = Math.max(low, Math.min(high, event.milestone - length / 2));
        const score = Math.abs(distance + length / 2 - event.milestone);
        if (!best || score < best.score) best = { distance, heading: section.heading, score };
      }
      if (!best) break;
      candidate.push(best); previousEnd = best.distance + length + gap;
    }
    if (candidate.length === events.length) placements = candidate;
  }
  if (!placements) throw new Error('This route has too little straight track for all event barcodes. Choose a route with longer straight sections.');
  events.forEach((event, index) => {
    const placement = placements[index]!;
    let distance = placement.distance;
    const bars = barcodeWidths(event.code, settings).map(unscaledWidth => {
      const width = unscaledWidth * scale;
      const sample = trajectory.sample(distance + width / 2);
      distance += width + settings.barGap * scale;
      return { x: sample.position.x, z: sample.position.z, angle: -placement.heading * 180 / Math.PI, width };
    });
    markers.push({ code: event.code, node: event.node, label: event.label, distance: placement.distance, bars });
  });
  const points = trajectory.points;
  const xs = points.map(p => p.x), zs = points.map(p => p.z), padding = Math.max(settings.barcodeWidth, settings.lineWidth) + .5;
  const x = Math.min(...xs) - padding, z = Math.min(...zs) - padding;
  return { points, markers, scale, barcodeWidth: settings.barcodeWidth, lineWidth: settings.lineWidth, viewBox: `${x} ${z} ${Math.max(...xs) - x + padding} ${Math.max(...zs) - z + padding}` };
}

