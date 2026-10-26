import { configurationProjection, type ProjectionConfiguration } from '../city/configurationProjection';
import { loadProjectionSettings, projectionSettingsMarkup, readProjectionSettings, renderProjection, saveProjectionSettings } from './projectionShared';
import '../accessibility.css';
import './routeProjection.css';
import './configurationProjection.css';
import { mountConfigurationRobot } from './configurationRobot';
import { mountConfigurationDock } from './configurationDock';
import { renderConfigurationSignals, updateConfigurationSignals } from './configurationSignals';
import { mountConfigurationCommands } from './configurationCommands';

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
const commands = mountConfigurationCommands(panel, configuration);
const status = panel.querySelector<HTMLElement>('#projection-setting-status')!;
function render() {
  try {
    let projection = configurationProjection(configuration, settings);
    // SVG user units scale with its viewBox. Reserve at least 46 rendered CSS px
    // for each interactive light, and include that target in track clearance.
    for (let i = 0; i < 40; i++) {
      const [, , width, height] = projection.viewBox.split(' ').map(Number);
      const scale = Math.min(svg.clientWidth / width!, svg.clientHeight / height!);
      if (!scale || projection.signals[0]!.target * scale >= 46) break;
      projection = configurationProjection(configuration, settings, 46.1 / scale);
    }
    renderProjection(svg, projection, settings);
    renderConfigurationSignals(svg, projection);
    panel.querySelector('.projection-legend')!.replaceChildren(...projection.markers.map(marker => {
      const item = document.createElement('li');
      item.textContent = `${marker.code.toString(2).padStart(4, '0')} — ${marker.label}`;
      return item;
    }));
    status.textContent = projection.scale < 1 ? `Bar lengths and gaps fitted to ${Math.round(projection.scale * 100)}% of the settings.` : '';
    svg.removeAttribute('hidden');
  } catch (reason) {
    svg.setAttribute('hidden', '');
    status.textContent = reason instanceof Error ? reason.message : 'Unable to draw the configuration.';
    document.querySelector<HTMLDetailsElement>('#projection-options')!.open = true;
  }
}
function updateSettings() {
  try {
    settings = readProjectionSettings(panel);
    saveProjectionSettings(settings);
    render();
  } catch (reason) { status.textContent = reason instanceof Error ? reason.message : 'Check the settings.'; }
}
panel.addEventListener('input', updateSettings);
panel.addEventListener('change', updateSettings);
render();
const robot = mountConfigurationRobot(document.querySelector<HTMLElement>('.configuration-page')!, (light, barcodeStop, enabled) => updateConfigurationSignals(svg, light, barcodeStop, enabled), commands);
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
