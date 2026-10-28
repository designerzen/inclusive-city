import { barcodeBitCounts, barcodeCapacity, defaultProjectionSettings, projectionFields, validateProjectionSettings, type ProjectionSettings } from '../city/projectionSettings';

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
  return `<p>Each data bar encodes one bit: short = 0, long = 1. Start and stop bars frame the data. More bits give more values and need more straight track. Set your robot reader to the same bit count.</p>
    <div class="projection-barcode-settings">${(['crossingCode', 'junctionCode'] as const).map(key => `<fieldset><legend>${key === 'crossingCode' ? 'Crossing' : 'Junction'} barcode</legend><label>Data capacity<select data-code-bits="${key}">${barcodeBitCounts.map(bits => `<option value="${bits}" ${settings[key].bits === bits ? 'selected' : ''}>${barcodeCapacity(bits)}</option>`).join('')}</select></label><label>Encoded value<input type="number" data-code-value="${key}" min="0" max="${2 ** settings[key].bits - 1}" step="1" value="${settings[key].value}"></label><output data-code-preview="${key}">${settings[key].value.toString(2).padStart(settings[key].bits, '0')}</output></fieldset>`).join('')}</div>
    <p>Dimensions use city metres. Bar lengths run along the line; barcode width runs across it.</p>
    <label class="projection-fit"><input id="projection-mirror" type="checkbox" ${settings.mirror ? 'checked' : ''} /> Reflect horizontally (left / right)</label>
    <label class="projection-fit"><input id="projection-mirror-vertical" type="checkbox" ${settings.mirrorVertical ? 'checked' : ''} /> Reflect vertically (top / bottom)</label>
    <p>Enable both reflections for the combined presentation.</p>
    <div class="projection-fields">${[...projectionFields].sort((a, b) => Number(b.key === 'codeGap') - Number(a.key === 'codeGap')).map(field => `<label for="projection-${field.key}">${field.label}<input id="projection-${field.key}" name="${field.key}" type="number" min="${field.min}" max="${field.max}" step="0.01" value="${settings[field.key]}" /></label>`).join('')}</div>
    <label class="projection-fit"><input id="projection-auto-fit" type="checkbox" ${settings.autoFit ? 'checked' : ''} /> Allow barcodes to shrink to fit straight sections</label>
    <label class="projection-print-margin">Print margin<select id="projection-print-margin"><option value="5">5 mm — standard printers</option><option value="3">3 mm — narrow margins</option><option value="0">0 mm — borderless printers</option></select></label>
    <p>Printing fits the track to one sheet, preserving its proportions. Choose the paper size in the print dialog and turn off browser headers and footers.</p>
    <p id="projection-setting-status" role="status" aria-live="polite"></p>
    <details><summary>Barcode event legend</summary><ol class="projection-legend"></ol></details>`;
}
export function readProjectionSettings(panel: HTMLElement, current: ProjectionSettings = loadProjectionSettings()) {
  const settings = { ...current };
  for (const key of ['crossingCode', 'junctionCode'] as const) {
    const bits = Number(panel.querySelector<HTMLSelectElement>(`[data-code-bits="${key}"]`)!.value);
    const input = panel.querySelector<HTMLInputElement>(`[data-code-value="${key}"]`)!;
    input.max = String(2 ** bits - 1);
    settings[key] = { bits, value: input.valueAsNumber };
  }
  for (const key of ['mirror', 'mirrorVertical', 'autoFit'] as const) {
    const id = { mirror: 'mirror', mirrorVertical: 'mirror-vertical', autoFit: 'auto-fit' }[key];
    settings[key] = panel.querySelector<HTMLInputElement>(`#projection-${id}`)!.checked;
  }
  for (const field of projectionFields) settings[field.key] = panel.querySelector<HTMLInputElement>(`#projection-${field.key}`)!.valueAsNumber;
  const valid = validateProjectionSettings(settings);
  syncBarcodeSettings(panel, valid);
  return valid;
}

export function syncBarcodeSettings(panel: HTMLElement, settings: ProjectionSettings) {
  for (const key of ['crossingCode', 'junctionCode'] as const) {
    const { bits, value } = settings[key];
    panel.querySelector<HTMLSelectElement>(`[data-code-bits="${key}"]`)!.value = String(bits);
    const input = panel.querySelector<HTMLInputElement>(`[data-code-value="${key}"]`)!;
    input.value = String(value); input.max = String(2 ** bits - 1);
    panel.querySelector<HTMLOutputElement>(`[data-code-preview="${key}"]`)!.textContent = value.toString(2).padStart(bits, '0');
  }
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
