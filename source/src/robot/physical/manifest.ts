import { routeProjection } from '../../city/routeProjection';
import { barcodeWidths } from '../../city/routeProjection';
import type { ProjectionSettings } from '../../city/projectionSettings';
import type { PlannedJourney } from '../../simulation/plannedJourney';
export interface PhysicalCalibration {
  mmPerCityUnit: number; minLineMm: number; minBarMm: number; maxSpeedMmS: number;
  stoppingDistanceMm: number; markerToleranceMm: number; leaseMs: number;
}
export interface PhysicalMarker {
  index: number; code: number; nodeId: string; routeIndex: number;
  distanceMm: number; semanticDistanceMm: number; hold: boolean;
}
export interface PhysicalManifest {
  version: 1; calibration: PhysicalCalibration; projection: ProjectionSettings;
  worldSeed: number; route: string[]; lengthMm: number; markers: PhysicalMarker[];
  points: { x: number; z: number }[];
}
export function validateCalibration(c: PhysicalCalibration) {
  for (const [key, value] of Object.entries(c)) if (!Number.isFinite(value) || value <= 0) throw new Error(`Enter a positive measured ${key}.`);
  if (c.mmPerCityUnit > 10000 || c.maxSpeedMmS > 1000 || c.markerToleranceMm > 1000 || c.leaseMs < 500 || c.leaseMs > 5000)
    throw new Error('Calibration is outside the supported limits.');
  return { ...c };
}
export function makeManifest(journey: PlannedJourney, settings: ProjectionSettings, calibration: PhysicalCalibration): PhysicalManifest {
  const c = validateCalibration(calibration), projection = routeProjection(journey, settings, c.stoppingDistanceMm / c.mmPerCityUnit);
  if (projection.lineWidth * c.mmPerCityUnit < c.minLineMm) throw new Error('Projected line is below the calibrated sensor minimum.');
  if (settings.shortLength * projection.scale * c.mmPerCityUnit < c.minBarMm) throw new Error('Projected bars are below the calibrated sensor minimum.');
  const markers = projection.markers.map((m, index) => {
    const widths = barcodeWidths(m.code, settings);
    // Firmware reports after crossing the complete stop bar, not the marker start.
    const end = m.distance + (widths.reduce((a, b) => a + b, 0) + settings.barGap * 5) * projection.scale;
    return { index, code: m.code, nodeId: m.nodeId, routeIndex: m.routeIndex,
      distanceMm: end * c.mmPerCityUnit, semanticDistanceMm: Math.max(end * c.mmPerCityUnit + (m.code >= 1 && m.code <= 7 ? c.stoppingDistanceMm : 0), m.milestone * c.mmPerCityUnit),
      hold: m.code >= 1 && m.code <= 7 };
  });
  // Holds must remain within the route and before the next code's start.
  for (const marker of markers) if (marker.hold) {
    const nextStart = projection.markers[marker.index + 1]?.distance;
    const limit = nextStart === undefined ? journey.trajectory.length * c.mmPerCityUnit : nextStart * c.mmPerCityUnit;
    if (marker.semanticDistanceMm > limit) throw new Error(`Marker ${marker.index + 1} needs more stopping clearance. Increase the gap between barcodes or choose another route.`);
  }
  return { version: 1, calibration: c, projection: { ...settings }, worldSeed: journey.world.seed,
    route: [...journey.route], lengthMm: journey.trajectory.length * c.mmPerCityUnit, markers,
    points: projection.points.map(p => ({ x: p.x, z: p.z })) };
}
export async function manifestHash(manifest: PhysicalManifest) {
  const bytes = new TextEncoder().encode(JSON.stringify(manifest));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(v => v.toString(16).padStart(2, '0')).join('');
}
