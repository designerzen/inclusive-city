import type { PlannedJourney } from '../simulation/plannedJourney';
import { routeToGoal } from '../city/proceduralCity';
import { routeProjection } from '../city/routeProjection';
import { defaultProjectionSettings, projectionFields, validateProjectionSettings, type ProjectionSettings } from '../city/projectionSettings';
import './routeProjection.css';

export function mountRouteProjection(container: HTMLElement, getJourney: () => PlannedJourney | undefined) {
  const trigger = container.querySelector<HTMLButtonElement>('#city-project-line')!;
  const settingsPanel = container.querySelector<HTMLElement>('#city-projection-settings')!;
  const settingsHome = settingsPanel.parentElement!;
  const settingsAnchor = document.createComment('Projection settings home');
  settingsPanel.before(settingsAnchor);
  let settings = { ...defaultProjectionSettings };
  try {
    const saved = JSON.parse(localStorage.getItem('inclusive-city-projection-settings') ?? 'null');
    if (saved) settings = validateProjectionSettings({ ...settings, ...saved });
  } catch { /* Use defaults when storage is unavailable or invalid. */ }
  settingsPanel.innerHTML = `<p>Dimensions use city metres. Bar lengths run along the line; barcode width runs across it.</p>
    <label class="projection-fit"><input id="projection-mirror" type="checkbox" ${settings.mirror ? 'checked' : ''} /> Reflect horizontally (left / right)</label>
    <label class="projection-fit"><input id="projection-mirror-vertical" type="checkbox" ${settings.mirrorVertical ? 'checked' : ''} /> Reflect vertically (top / bottom)</label>
    <p>Enable both reflections for the combined presentation.</p>
    <div class="projection-fields">${[...projectionFields].sort((a, b) => Number(b.key === 'codeGap') - Number(a.key === 'codeGap')).map(field => `<label for="projection-${field.key}">${field.label}<input id="projection-${field.key}" name="${field.key}" type="number" min="${field.min}" max="${field.max}" step="0.01" value="${settings[field.key]}" /></label>`).join('')}</div>
    <label class="projection-fit"><input id="projection-auto-fit" type="checkbox" ${settings.autoFit ? 'checked' : ''} /> Allow barcodes to shrink to fit straight sections</label>
    <p id="projection-setting-status" role="status" aria-live="polite"></p>
    <details><summary>Barcode event legend</summary><ol class="projection-legend"></ol></details>`;
  const status = settingsPanel.querySelector<HTMLElement>('#projection-setting-status')!;
  const dialog = document.createElement('dialog');
  dialog.className = 'route-projection'; dialog.setAttribute('aria-label', 'Robot line projection');
  dialog.innerHTML = `<svg role="img" aria-label="Robot route with event barcodes" preserveAspectRatio="xMidYMid meet"></svg>
    <details class="projection-options"><summary>Settings</summary><div class="projection-options-content"></div></details>
    <button class="projection-close" type="button" aria-label="Close projection" title="Close projection"><svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg></button>`;
  document.body.append(dialog);
  const svg = dialog.querySelector('svg')!;
  const options = dialog.querySelector<HTMLDetailsElement>('.projection-options')!;
  const closeButton = dialog.querySelector<HTMLButtonElement>('.projection-close')!;
  let key = '';
  let physicalWindow: Window | null = null;
  let physicalViewport = '';
  let physicalLocked = false;
  let physicalSettings: ProjectionSettings | undefined;
  let physicalDocument: Document | undefined;
  const viewportKey = (view: Window) => `${view.innerWidth}:${view.innerHeight}:${view.devicePixelRatio}:${view.screenX}:${view.screenY}`;
  function render() {
    const journey = getJourney(); if (!journey) return false;
    try {
      const projection = routeProjection(journey, settings);
      svg.setAttribute('viewBox', projection.viewBox);
      svg.style.transform = `scale(${settings.mirror ? -1 : 1}, ${settings.mirrorVertical ? -1 : 1})`;
      svg.innerHTML = `<polyline points="${projection.points.map(p => `${p.x},${p.z}`).join(' ')}" fill="none" stroke="#000" stroke-width="${projection.lineWidth}" stroke-linejoin="round" stroke-linecap="round"/>` +
        projection.markers.map(marker => `<g data-code="${marker.code.toString(2).padStart(4, '0')}">${marker.bars.map(bar => `<rect x="${-projection.barcodeWidth / 2}" y="${-bar.width / 2}" width="${projection.barcodeWidth}" height="${bar.width}" fill="#000" transform="translate(${bar.x} ${bar.z}) rotate(${bar.angle})"/>`).join('')}</g>`).join('');
      settingsPanel.querySelector('.projection-legend')!.replaceChildren(...projection.markers.map(marker => {
        const item = document.createElement('li'); item.textContent = `${marker.code.toString(2).padStart(4, '0')} — ${marker.node}: ${marker.label}`; return item;
      }));
      status.textContent = projection.scale < 1 ? `Bar lengths and gaps within each barcode fitted to ${Math.round(projection.scale * 100)}% of the settings.` : '';
      return true;
    } catch (reason) {
      status.textContent = reason instanceof Error ? reason.message : 'Unable to project this route.';
      if (dialog.open) { options.open = true; return false; }
      const controls = container.querySelector<HTMLDetailsElement>('#city-controls-hud');
      if (controls) controls.open = true;
      settingsPanel.closest('details')!.open = true;
      return false;
    }
  }
  function refresh() {
    if (!dialog.open) return;
    const journey = getJourney(); if (!journey) return;
    const next = `${journey.world.seed}:${journey.route.join('|')}:${journey.minimumTurnRadius}:${journey.routeGeometryRevision}:${JSON.stringify(settings)}`;
    if (next === key) return;
    key = next; render();
  }
  function open() {
    if (!changeSettings()) return;
    const journey = getJourney(); if (!journey) return;
    if (journey.ready) {
      const remaining = routeToGoal(journey.world, journey.route.at(-1)!);
      if (remaining) journey.setRoute([...journey.route, ...remaining.slice(1)]);
    }
    if (!render()) return;
    key = ''; dialog.querySelector('.projection-options-content')!.append(settingsPanel);
    dialog.showModal(); options.querySelector('summary')!.focus();
  }
  function close() { if (dialog.open) { dialog.close(); settingsHome.insertBefore(settingsPanel, settingsAnchor.nextSibling); options.open = false; trigger.focus(); } }
  function cancel(event: Event) { event.preventDefault(); close(); }
  function changeSettings() {
    if (physicalLocked) { status.textContent = 'Close the physical projection and reconnect the robots before changing its settings.'; return false; }
    const next = { ...settings, mirrorVertical: settingsPanel.querySelector<HTMLInputElement>('#projection-mirror-vertical')!.checked, mirror: settingsPanel.querySelector<HTMLInputElement>('#projection-mirror')!.checked, autoFit: settingsPanel.querySelector<HTMLInputElement>('#projection-auto-fit')!.checked };
    for (const field of projectionFields) next[field.key] = settingsPanel.querySelector<HTMLInputElement>(`#projection-${field.key}`)!.valueAsNumber;
    try {
      settings = validateProjectionSettings(next);
      try { localStorage.setItem('inclusive-city-projection-settings', JSON.stringify(settings)); } catch { /* Retain session settings. */ }
      status.textContent = ''; refresh(); return true;
    } catch (reason) { status.textContent = reason instanceof Error ? reason.message : 'Check the projection settings.'; return false; }
  }
  trigger.addEventListener('click', open); closeButton.addEventListener('click', close);
  dialog.addEventListener('cancel', cancel); settingsPanel.addEventListener('change', changeSettings);
  function openPhysical(stoppingClearance: number) {
    if (physicalWindow && !physicalWindow.closed) return { ...physicalSettings! };
    if (!changeSettings()) throw new Error('Check the projection settings.');
    const journey = getJourney(); if (!journey || !journey.ready) throw new Error('Reset the city before preparing a physical route.');
    const remaining = routeToGoal(journey.world, journey.route.at(-1)!);
    if (!remaining) throw new Error('The route cannot reach the studio.');
    journey.setRoute([...journey.route, ...remaining.slice(1)]);
    if (!render()) throw new Error('This route cannot be projected.');
    physicalWindow = window.open('', 'inclusive-city-physical-projection', 'popup,width=1000,height=700');
    if (!physicalWindow) throw new Error('Allow the projector window to open.');
    physicalWindow.document.title = 'Physical robot projection';
    physicalWindow.document.body.replaceChildren();
    const style = physicalWindow.document.createElement('style');
    style.textContent = 'html,body{margin:0;width:100%;height:100%;overflow:hidden;background:white}svg{display:block;width:100%;height:100%}';
    physicalWindow.document.head.append(style);
    const data = routeProjection(journey, settings, stoppingClearance);
    const copy = svg.cloneNode(false) as SVGElement;
    copy.innerHTML = `<polyline points="${data.points.map(p => `${p.x},${p.z}`).join(' ')}" fill="none" stroke="#000" stroke-width="${data.lineWidth}" stroke-linejoin="round" stroke-linecap="round"/>` +
      data.markers.map(marker => `<g>${marker.bars.map(bar => `<rect x="${-data.barcodeWidth / 2}" y="${-bar.width / 2}" width="${data.barcodeWidth}" height="${bar.width}" fill="#000" transform="translate(${bar.x} ${bar.z}) rotate(${bar.angle})"/>`).join('')}</g>`).join('');
    physicalWindow.document.body.append(physicalWindow.document.importNode(copy, true));
    physicalSettings = { ...settings }; physicalLocked = true; physicalViewport = '';
    physicalDocument = physicalWindow.document;
    return { ...settings };
  }
  function lockPhysicalViewport() {
    if (!physicalWindow || physicalWindow.closed) throw new Error('Open the physical projection first.');
    if (!physicalHealthy()) throw new Error('The projector window changed. Reconnect and prepare again.');
    physicalViewport ||= viewportKey(physicalWindow);
  }
  function physicalHealthy() {
    try { return !!physicalWindow && !physicalWindow.closed && physicalDocument === physicalWindow.document && (!physicalViewport || physicalViewport === viewportKey(physicalWindow)); }
    catch { return false; }
  }
  function closePhysical() { physicalWindow?.close(); physicalWindow = null; physicalLocked = false; physicalSettings = undefined; physicalDocument = undefined; }
  return { refresh, close, openPhysical, lockPhysicalViewport, physicalHealthy, closePhysical, dispose() {
    closePhysical();
    close(); dialog.remove(); settingsAnchor.remove(); trigger.removeEventListener('click', open);
    settingsPanel.removeEventListener('change', changeSettings);
  } };
}
