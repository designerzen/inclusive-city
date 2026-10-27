import { defaultProjectionSettings, projectionFields, validateProjectionSettings, type ProjectionSettings } from '../city/projectionSettings';

const storageKey = 'inclusive-city-projection-settings';
export function loadProjectionSettings() {
  try {
    return validateProjectionSettings({ ...defaultProjectionSettings, ...JSON.parse(localStorage.getItem(storageKey) ?? '{}') });
  } catch { return { ...defaultProjectionSettings }; }
}
export function saveProjectionSettings(settings: ProjectionSettings) {
  try { localStorage.setItem(storageKey, JSON.stringify(settings)); } catch { /* Keep session settings. */ }
}
export function projectionSettingsMarkup(settings: ProjectionSettings) {
  return `<p>Dimensions use city metres. Bar lengths run along the line; barcode width runs across it.</p>
    <label class="projection-fit"><input id="projection-mirror" type="checkbox" ${settings.mirror ? 'checked' : ''} /> Reflect horizontally (left / right)</label>
    <label class="projection-fit"><input id="projection-mirror-vertical" type="checkbox" ${settings.mirrorVertical ? 'checked' : ''} /> Reflect vertically (top / bottom)</label>
    <p>Enable both reflections for the combined presentation.</p>
    <div class="projection-fields">${[...projectionFields].sort((a, b) => Number(b.key === 'codeGap') - Number(a.key === 'codeGap')).map(field => `<label for="projection-${field.key}">${field.label}<input id="projection-${field.key}" name="${field.key}" type="number" min="${field.min}" max="${field.max}" step="0.01" value="${settings[field.key]}" /></label>`).join('')}</div>
    <label class="projection-fit"><input id="projection-auto-fit" type="checkbox" ${settings.autoFit ? 'checked' : ''} /> Allow barcodes to shrink to fit straight sections</label>
    <p id="projection-setting-status" role="status" aria-live="polite"></p>
    <details><summary>Barcode event legend</summary><ol class="projection-legend"></ol></details>`;
}
export function readProjectionSettings(panel: HTMLElement, current: ProjectionSettings = loadProjectionSettings()) {
  const settings = { ...current };
  for (const key of ['mirror', 'mirrorVertical', 'autoFit'] as const) {
    const id = { mirror: 'mirror', mirrorVertical: 'mirror-vertical', autoFit: 'auto-fit' }[key];
    settings[key] = panel.querySelector<HTMLInputElement>(`#projection-${id}`)!.checked;
  }
  for (const field of projectionFields) settings[field.key] = panel.querySelector<HTMLInputElement>(`#projection-${field.key}`)!.valueAsNumber;
  return validateProjectionSettings(settings);
}

export interface ProjectionDrawing {
  points: readonly { x: number; z: number }[];
  markers: readonly { code: number; bits?: number; bars: readonly { x: number; z: number; width: number; angle: number }[] }[];
  lineWidth: number;
  barcodeWidth: number;
  viewBox: string;
}
export function renderProjection(svg: SVGElement, projection: ProjectionDrawing, settings: ProjectionSettings) {
  svg.setAttribute('viewBox', projection.viewBox);
  svg.style.transform = `scale(${settings.mirror ? -1 : 1}, ${settings.mirrorVertical ? -1 : 1})`;
  svg.innerHTML = `<polyline points="${projection.points.map(p => `${p.x},${p.z}`).join(' ')}" fill="none" stroke="#000" stroke-width="${projection.lineWidth}" stroke-linejoin="round" stroke-linecap="round"/>` +
    projection.markers.map(marker => `<g data-code="${marker.code.toString(2).padStart(marker.bits ?? 4, '0')}">${marker.bars.map(bar => `<rect x="${-projection.barcodeWidth / 2}" y="${-bar.width / 2}" width="${projection.barcodeWidth}" height="${bar.width}" fill="#000" transform="translate(${bar.x} ${bar.z}) rotate(${bar.angle})"/>`).join('')}</g>`).join('');
}
