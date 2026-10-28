import type { ProjectionSettings } from '../city/projectionSettings';
import { renderProjection, type ProjectionDrawing } from './projectionShared';

/** Bound the optical track itself, excluding screen-only signal and hit targets. */
export function printTrackBounds(projection: ProjectionDrawing) {
  const points = projection.points.flatMap(point => [
    { x: point.x - projection.lineWidth / 2, z: point.z - projection.lineWidth / 2 },
    { x: point.x + projection.lineWidth / 2, z: point.z + projection.lineWidth / 2 },
  ]);
  for (const marker of projection.markers) for (const bar of marker.bars) {
    const angle = bar.angle * Math.PI / 180;
    const halfX = (Math.abs(Math.cos(angle)) * projection.barcodeWidth + Math.abs(Math.sin(angle)) * bar.width) / 2;
    const halfZ = (Math.abs(Math.sin(angle)) * projection.barcodeWidth + Math.abs(Math.cos(angle)) * bar.width) / 2;
    points.push({ x: bar.x - halfX, z: bar.z - halfZ }, { x: bar.x + halfX, z: bar.z + halfZ });
  }
  const minX = Math.min(...points.map(p => p.x)), minZ = Math.min(...points.map(p => p.z));
  const width = Math.max(...points.map(p => p.x)) - minX, height = Math.max(...points.map(p => p.z)) - minZ;
  const padding = Math.max(width, height) * .002;
  return { viewBox: `${minX - padding} ${minZ - padding} ${width + padding * 2} ${height + padding * 2}`, landscape: width > height };
}

export function printProjection(projection: ProjectionDrawing, settings: ProjectionSettings, marginMm = 5) {
  const frame = document.createElement('iframe');
  frame.title = 'Printable robot track';
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;';
  document.body.append(frame);
  const doc = frame.contentDocument!, view = frame.contentWindow!;
  doc.title = 'Robot track';
  const bounds = printTrackBounds(projection);
  const style = doc.createElement('style');
  style.textContent = `@page { size: ${bounds.landscape ? 'landscape' : 'portrait'}; margin: ${[0, 3, 5].includes(marginMm) ? marginMm : 5}mm; } html,body{margin:0;padding:0;width:100%;height:100%;background:white}svg{display:block;width:100%;height:100vh;}`;
  doc.head.append(style);
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  renderProjection(svg, projection, settings); svg.setAttribute('viewBox', bounds.viewBox);
  doc.body.append(svg);
  view.addEventListener('afterprint', () => frame.remove(), { once: true });
  // Allow layout to finish before the browser captures the print document.
  view.requestAnimationFrame(() => { view.focus(); view.print(); });
}
