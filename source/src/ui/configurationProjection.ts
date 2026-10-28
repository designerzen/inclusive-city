import { mountBarcodePicker, renderBarcodeTargets } from './barcodePicker';
import { configurationProjection, type ProjectionConfiguration } from '../city/configurationProjection';
import { loadProjectionSettings, projectionSettingsMarkup, readProjectionSettings, renderProjection, saveProjectionSettings, syncBarcodeSettings } from './projectionShared';
import '../accessibility.css';
import './routeProjection.css';
import './configurationProjection.css';
import { mountConfigurationRobot } from './configurationRobot';
import { mountConfigurationDock } from './configurationDock';
import { renderConfigurationSignals, updateConfigurationSignals } from './configurationSignals';
import { mountConfigurationCommands } from './configurationCommands';
import { mountProjectionLog } from './projectionLog';
import { printProjection } from './projectionPrint';

const configuration = document.body.dataset.configuration as ProjectionConfiguration;
const title = configuration === 'traffic-light' ? 'Traffic light' : 'Figure of eight';
document.querySelector<HTMLElement>('#projection-title')!.textContent = title;
const svg = document.querySelector<SVGElement>('#configuration-line')!;
svg.setAttribute('role', 'group');
const panel = document.querySelector<HTMLElement>('#configuration-settings')!;
const options = document.querySelector<HTMLDetailsElement>('#projection-options')!;
document.addEventListener('pointerdown', event => {
  if (event.target instanceof Element && !event.target.closest('.configuration-dock')) options.open = false;
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && options.open) {
    options.open = false;
    options.querySelector('summary')!.focus();
  }
});
let settings = loadProjectionSettings();
panel.innerHTML = projectionSettingsMarkup(settings);
const log = mountProjectionLog(document.querySelector<HTMLElement>('.configuration-header')!);
log('Page opened', { configuration, settings });
const commands = mountConfigurationCommands(panel, configuration, log);
const status = panel.querySelector<HTMLElement>('#projection-setting-status')!;
let lastDrawing = '';
function render() {
  try {
    let barcodeTarget = 0;
    let signalTarget = 3.6;
    let projection = configurationProjection(configuration, settings);
    // SVG user units scale with its viewBox. Reserve at least 46 rendered CSS px
    // for each interactive light and barcode, including clearance between targets.
    for (let i = 0; i < 40; i++) {
      const [, , width, height] = projection.viewBox.split(' ').map(Number);
      const scale = Math.min(svg.clientWidth / width!, svg.clientHeight / height!);
      if (!scale) break;
      if (signalTarget * scale >= 46 && barcodeTarget * scale >= 46) break;
      signalTarget = 46.1 / scale; barcodeTarget = 46.1 / scale;
      projection = configurationProjection(configuration, settings, signalTarget, barcodeTarget);
    }
    renderProjection(svg, projection, settings);
    renderBarcodeTargets(svg, projection, barcodeTarget);
    renderConfigurationSignals(svg, projection);
    const drawingKey = JSON.stringify(projection);
    if (drawingKey !== lastDrawing) { log('Track rendered', projection); lastDrawing = drawingKey; }
    panel.querySelector('.projection-legend')!.replaceChildren(...projection.markers.map(marker => {
      const item = document.createElement('li');
      item.textContent = `${marker.code.toString(2).padStart(marker.bits, '0')} — ${marker.label}`;
      return item;
    }));
    status.textContent = projection.scale < 1 ? `Bar lengths and gaps fitted to ${Math.round(projection.scale * 100)}% of the settings.` : '';
    svg.removeAttribute('hidden');
  } catch (reason) {
    svg.setAttribute('hidden', '');
    status.textContent = reason instanceof Error ? reason.message : 'Unable to draw the configuration.';
    log('Track rendering failed', status.textContent);
    document.querySelector<HTMLDetailsElement>('#projection-options')!.open = true;
  }
}
function updateSettings(event: Event) {
  const target = event.target;
  if (target instanceof HTMLSelectElement && target.dataset.codeBits) {
    const input = panel.querySelector<HTMLInputElement>(`[data-code-value="${target.dataset.codeBits}"]`)!;
    if (Number.isInteger(input.valueAsNumber)) input.value = String(Math.min(input.valueAsNumber, 2 ** Number(target.value) - 1));
  }
  try {
    const next = readProjectionSettings(panel, settings);
    if (JSON.stringify(next) === JSON.stringify(settings)) { if (status.textContent) render(); return; }
    settings = next;
    log('Settings changed', settings);
    saveProjectionSettings(settings);
    render();
  } catch (reason) { status.textContent = reason instanceof Error ? reason.message : 'Check the settings.'; log('Invalid settings', status.textContent); }
}
panel.addEventListener('input', updateSettings);
panel.addEventListener('change', updateSettings);
const barcodeKey = configuration === 'traffic-light' ? 'crossingCode' : 'junctionCode';
mountBarcodePicker(svg, configuration === 'traffic-light' ? 'Crossing' : 'Junction (both approaches)', () => settings[barcodeKey], value => {
  settings = { ...settings, [barcodeKey]: value };
  syncBarcodeSettings(panel, settings);
  log('Barcode changed', { event: barcodeKey, ...value });
  saveProjectionSettings(settings); render();
});
render();
const print = document.createElement('button');
print.type = 'button'; print.className = 'projection-print'; print.textContent = 'Print track';
document.querySelector('.configuration-header')!.append(print);
print.addEventListener('click', () => {
  try {
    settings = readProjectionSettings(panel, settings);
    const marginMm = Number(panel.querySelector<HTMLSelectElement>('#projection-print-margin')!.value);
    printProjection(configurationProjection(configuration, settings), settings, marginMm);
    log('Print requested', { configuration, settings, marginMm });
  } catch (reason) { status.textContent = String(reason); options.open = true; log('Print failed', String(reason)); }
});
const robot = mountConfigurationRobot(document.querySelector<HTMLElement>('.configuration-page')!, (light, barcodeStop, enabled) => updateConfigurationSignals(svg, light, barcodeStop, enabled), commands, log);
mountConfigurationDock(document.querySelector<HTMLElement>('.configuration-page')!);
function activateSignal(event: Event) {
  const target = event.target instanceof Element ? event.target.closest<SVGGElement>('.track-signal') : null;
  if (target && target.getAttribute('aria-disabled') === 'false') void robot.fulfill(Number(target.dataset.approach));
}
svg.addEventListener('click', activateSignal);
svg.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateSignal(event); }
});
new ResizeObserver(render).observe(svg);
