import { barcodeWidths, projectionCodes } from './routeProjection';
import { validateProjectionSettings, type ProjectionSettings } from './projectionSettings';

export type ProjectionConfiguration = 'traffic-light' | 'figure-eight';
type Point = { x: number; z: number };

export function configurationProjection(configuration: ProjectionConfiguration, preferences: ProjectionSettings) {
  const settings = validateProjectionSettings(preferences);
  const figureEight = configuration === 'figure-eight';
  const code = figureEight ? 13 : 4;
  const widths = barcodeWidths(code, settings);
  const length = widths.reduce((sum, width) => sum + width, 0) + settings.barGap * 5;
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
  const intersectionClearance = Math.max(settings.codeGap, settings.barcodeWidth / 2 + settings.lineWidth / 2);
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
    return { code, label: projectionCodes[code], bars };
  });
  const padding = Math.max(settings.barcodeWidth, settings.lineWidth) + 1;
  const xs = points.map(point => point.x), zs = points.map(point => point.z);
  const x = Math.min(...xs) - padding, z = Math.min(...zs) - padding;
  return { points, markers, scale, lineWidth: settings.lineWidth, barcodeWidth: settings.barcodeWidth,
    viewBox: `${x} ${z} ${Math.max(...xs) - x + padding} ${Math.max(...zs) - z + padding}` };
}
