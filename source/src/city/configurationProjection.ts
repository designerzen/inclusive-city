import { barcodeWidths, projectionCodes } from './routeProjection';
import { eventBarcode, validateProjectionSettings, type ProjectionSettings } from './projectionSettings';

export type ProjectionConfiguration = 'traffic-light' | 'figure-eight';
type Point = { x: number; z: number };

export function configurationProjection(configuration: ProjectionConfiguration, preferences: ProjectionSettings, signalTarget = 3.6, barcodeTarget = 0) {
  const settings = validateProjectionSettings(preferences);
  const figureEight = configuration === 'figure-eight';
  const eventCode = figureEight ? 13 : 4;
  const { value: code, bits } = eventBarcode(eventCode, settings);
  const widths = barcodeWidths(code, settings, bits);
  const length = widths.reduce((sum, width) => sum + width, 0) + settings.barGap * (bits + 1);
  const points: Point[] = figureEight ? [{ x: -12, z: -12 }, { x: 12, z: 12 }] : [{ x: -24, z: 0 }, { x: 24, z: 0 }];
  function curve(a: Point, b: Point, c: Point, d: Point) {
    for (let i = 1; i <= 96; i++) {
      const t = i / 96, u = 1 - t;
      points.push({ x: u ** 3 * a.x + 3 * u ** 2 * t * b.x + 3 * u * t ** 2 * c.x + t ** 3 * d.x,
        z: u ** 3 * a.z + 3 * u ** 2 * t * b.z + 3 * u * t ** 2 * c.z + t ** 3 * d.z });
    }
  }
  if (figureEight) {
    curve({ x: 12, z: 12 }, { x: 36, z: 36 }, { x: 36, z: -36 }, { x: 12, z: -12 });
    points.push({ x: -12, z: 12 });
    curve({ x: -12, z: 12 }, { x: -36, z: 36 }, { x: -36, z: -36 }, { x: -12, z: -12 });
  }
  // Reserve the whole crossing, including the other approach's barcode width.
  const intersectionClearance = Math.max(barcodeTarget, settings.codeGap, settings.barcodeWidth / 2 + settings.lineWidth / 2);
  const available = figureEight ? Math.SQRT2 * 12 - settings.bendClearance - intersectionClearance : 48 - 2 * settings.bendClearance;
  const scale = Math.min(1, available / length);
  if (scale <= 0 || (scale < 1 && !settings.autoFit)) throw new Error('The barcode does not fit. Reduce bar lengths, gaps or clearance, or enable automatic fitting.');
  const directions = figureEight ? [{ x: Math.SQRT1_2, z: Math.SQRT1_2 }, { x: -Math.SQRT1_2, z: Math.SQRT1_2 }] : [{ x: 1, z: 0 }];
  const markers = directions.map(direction => {
    let distance = figureEight ? -intersectionClearance - length * scale : -length * scale / 2;
    const bars = widths.map(unscaled => {
      const width = unscaled * scale;
      const centre = distance + width / 2;
      distance += width + settings.barGap * scale;
      return { x: centre * direction.x, z: centre * direction.z, width, angle: -Math.atan2(-direction.x, -direction.z) * 180 / Math.PI };
    });
    return { code, bits, label: projectionCodes[eventCode], bars };
  });
  // Anchor each signal to its barcode, clear of both the optical line and bars.
  const signalRadius = Math.SQRT2 * signalTarget / 2, clearance = signalRadius + .5;
  function segmentDistance(point: Point, a: Point, b: Point) {
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(point.x - a.x - t * dx, point.z - a.z - t * dz);
  }
  const signals = markers.map((marker, index) => {
    const direction = directions[index]!;
    const first = marker.bars[0]!, last = marker.bars.at(-1)!;
    const anchor = { x: (first.x + last.x + direction.x * (last.width - first.width) / 2) / 2,
      z: (first.z + last.z + direction.z * (last.width - first.width) / 2) / 2 };
    let normal = { x: direction.z, z: -direction.x };
    if (figureEight && normal.x * anchor.x < 0) normal = { x: -normal.x, z: -normal.z };
    for (let offset = Math.max(barcodeTarget, settings.barcodeWidth, settings.lineWidth) / 2 + clearance; ; offset += 1) {
      // At the intersection the perpendicular may land on the other approach.
      // Check nearby angles before moving farther from this barcode.
      for (const step of [0, -1, 1, -2, 2, -3, 3, -4, 4, 8]) {
        const angle = step * Math.PI / 8;
        const nx = normal.x * Math.cos(angle) - normal.z * Math.sin(angle);
        const nz = normal.x * Math.sin(angle) + normal.z * Math.cos(angle);
        const point = { x: anchor.x + nx * offset, z: anchor.z + nz * offset };
        const targetsClear = !barcodeTarget || markers.every(marker => {
          const bounds = marker.bars.map(bar => {
            const angle = bar.angle * Math.PI / 180;
            return { x: bar.x, z: bar.z,
              halfX: (Math.abs(Math.cos(angle)) * settings.barcodeWidth + Math.abs(Math.sin(angle)) * bar.width) / 2,
              halfZ: (Math.abs(Math.sin(angle)) * settings.barcodeWidth + Math.abs(Math.cos(angle)) * bar.width) / 2 };
          });
          const minX = Math.min(...bounds.map(b => b.x - b.halfX)), maxX = Math.max(...bounds.map(b => b.x + b.halfX));
          const minZ = Math.min(...bounds.map(b => b.z - b.halfZ)), maxZ = Math.max(...bounds.map(b => b.z + b.halfZ));
          return Math.abs(point.x - (minX + maxX) / 2) >= (Math.max(barcodeTarget, maxX - minX) + signalTarget) / 2 + .2
            || Math.abs(point.z - (minZ + maxZ) / 2) >= (Math.max(barcodeTarget, maxZ - minZ) + signalTarget) / 2 + .2;
        });
        const lineClear = points.every((a, i) => i === 0 || segmentDistance(point, points[i - 1]!, a) >= settings.lineWidth / 2 + clearance);
        const barsClear = markers.every((other, j) => other.bars.every(bar => {
          const along = directions[j]!, across = { x: along.z, z: -along.x };
          const dx = point.x - bar.x, dz = point.z - bar.z;
          return Math.hypot(Math.max(0, Math.abs(dx * along.x + dz * along.z) - bar.width / 2),
            Math.max(0, Math.abs(dx * across.x + dz * across.z) - Math.max(barcodeTarget, settings.barcodeWidth) / 2)) >= clearance;
        }));
        if (lineClear && barsClear && targetsClear) return { ...point, code: marker.code, bits, anchor, target: signalTarget };
      }
    }
  });
  const padding = Math.max(settings.barcodeWidth, settings.lineWidth) + 1;
  const bounds = [...points, ...signals.flatMap(signal => [{ x: signal.x - signalRadius, z: signal.z - signalRadius }, { x: signal.x + signalRadius, z: signal.z + signalRadius }])];
  const xs = bounds.map(point => point.x), zs = bounds.map(point => point.z);
  const x = Math.min(...xs) - padding, z = Math.min(...zs) - padding;
  return { points, markers, signals, scale, lineWidth: settings.lineWidth, barcodeWidth: settings.barcodeWidth,
    viewBox: `${x} ${z} ${Math.max(...xs) - x + padding} ${Math.max(...zs) - z + padding}` };
}
