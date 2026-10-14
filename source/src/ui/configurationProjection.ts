import { configurationProjection, type ProjectionConfiguration } from '../city/configurationProjection';
import { loadProjectionSettings, projectionSettingsMarkup, readProjectionSettings, renderProjection, saveProjectionSettings } from './projectionShared';
import '../accessibility.css';
import './routeProjection.css';
import './configurationProjection.css';

const configuration = document.body.dataset.configuration as ProjectionConfiguration;
const title = configuration === 'traffic-light' ? 'Traffic light' : 'Figure of eight';
document.querySelector<HTMLElement>('#projection-title')!.textContent = title;
const svg = document.querySelector<SVGElement>('#configuration-line')!;
const panel = document.querySelector<HTMLElement>('#configuration-settings')!;
let settings = loadProjectionSettings();
panel.innerHTML = projectionSettingsMarkup(settings);
const status = panel.querySelector<HTMLElement>('#projection-setting-status')!;
function render() {
  try {
    const projection = configurationProjection(configuration, settings);
    renderProjection(svg, projection, settings);
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
