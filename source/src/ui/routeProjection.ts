import type { PlannedJourney } from '../simulation/plannedJourney';
import { routeToGoal } from '../city/proceduralCity';
import { barcodeSpan, routeProjection } from '../city/routeProjection';
import './routeProjection.css';

export function mountRouteProjection(container: HTMLElement, getJourney: () => PlannedJourney | undefined) {
  const trigger = container.querySelector<HTMLButtonElement>('#city-project-line')!;
  const dialog = document.createElement('dialog');
  dialog.className = 'route-projection';
  dialog.setAttribute('aria-label', 'Robot line projection');
  dialog.innerHTML = `<svg role="img" aria-label="Robot route with event barcodes" preserveAspectRatio="xMidYMid meet"></svg>
    <section class="projection-controls" aria-label="Projection controls">
      <h2>Project the robot’s line</h2>
      <p>The black line and barcodes are always projected on white. The complete route uses the same curve as the on-screen robot. Codes read in travel order: wide start, four data bars (thin = 0, medium = 1), wide stop.</p>
      <p>Size the projection to your robot’s sensors. Start projection hides these controls. Press Escape or tap the projection to bring them back.</p>
      <div class="projection-actions"><button type="button" data-projection="start">Start projection</button><button type="button" data-projection="close">Back to city</button></div>
      <p class="projection-error" role="status"></p>
      <details><summary>Barcode event legend</summary><ol class="projection-legend"></ol></details>
      <p><a href="https://rixlivinglab.com/2026/05/18/teaching-a-line-following-robot-to-read-barcodes/" target="_blank" rel="noopener noreferrer">RIX barcode format</a>. Configure your robot with these codes; projection does not send hardware commands.</p>
    </section>`;
  document.body.append(dialog);
  const svg = dialog.querySelector('svg')!;
  const controls = dialog.querySelector<HTMLElement>('.projection-controls')!;
  const error = dialog.querySelector<HTMLElement>('.projection-error')!;
  const start = dialog.querySelector<HTMLButtonElement>('[data-projection="start"]')!;
  let key = '', ownFullscreen = false;
  function refresh() {
    if (!dialog.open) return;
    const journey = getJourney();
    if (!journey) return;
    const next = `${journey.world.seed}:${journey.route.join('|')}:${journey.minimumTurnRadius}:${journey.routeGeometryRevision}`;
    if (next === key) return;
    key = next;
    try {
      const projection = routeProjection(journey);
      svg.setAttribute('viewBox', projection.viewBox);
      svg.innerHTML = `<polyline points="${projection.points.map(p => `${p.x},${p.z}`).join(' ')}" fill="none" stroke="#000" stroke-width="${projection.lineWidth}" stroke-linejoin="round" stroke-linecap="round"/>` +
        projection.markers.map(marker => `<g data-code="${marker.code.toString(2).padStart(4, '0')}">${marker.bars.map(bar => `<rect x="${-barcodeSpan / 2}" y="${-bar.width / 2}" width="${barcodeSpan}" height="${bar.width}" fill="#000" transform="translate(${bar.x} ${bar.z}) rotate(${bar.angle})"/>`).join('')}</g>`).join('');
      dialog.querySelector('.projection-legend')!.replaceChildren(...projection.markers.map(marker => {
        const item = document.createElement('li');
        item.textContent = `${marker.code.toString(2).padStart(4, '0')} — ${marker.node}: ${marker.label}`;
        return item;
      }));
      error.textContent = ''; start.disabled = false;
    } catch (reason) {
      svg.replaceChildren(); controls.hidden = false; start.disabled = true;
      error.textContent = reason instanceof Error ? reason.message : 'Unable to project this route.';
    }
  }
  function open() {
    const journey = getJourney();
    if (!journey) return;
    if (journey.ready) {
      const remaining = routeToGoal(journey.world, journey.route.at(-1)!);
      if (remaining) journey.setRoute([...journey.route, ...remaining.slice(1)]);
    }
    key = ''; controls.hidden = false; dialog.showModal(); refresh(); start.focus();
  }
  async function close() {
    if (!dialog.open) return;
    if (ownFullscreen && document.fullscreenElement === dialog) await document.exitFullscreen().catch(() => {});
    ownFullscreen = false; dialog.close(); trigger.focus();
  }
  async function action(event: MouseEvent) {
    const target = (event.target as Element).closest<HTMLButtonElement>('[data-projection]');
    if (!target) { if (controls.hidden) { controls.hidden = false; start.focus(); } return; }
    if (target.dataset.projection === 'close') { await close(); return; }
    if (target.dataset.projection === 'start') {
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        try { await dialog.requestFullscreen(); ownFullscreen = true; }
        catch { /* Clean display also works without browser fullscreen. */ }
      }
      controls.hidden = true; dialog.focus();
    }
  }
  function cancel(event: Event) {
    event.preventDefault();
    if (controls.hidden) { controls.hidden = false; start.focus(); }
    else void close();
  }
  function fullscreenChanged() {
    if (ownFullscreen && document.fullscreenElement !== dialog) { ownFullscreen = false; controls.hidden = false; start.focus(); }
  }
  trigger.addEventListener('click', open);
  dialog.addEventListener('click', action); dialog.addEventListener('cancel', cancel);
  document.addEventListener('fullscreenchange', fullscreenChanged);
  return { refresh, close, dispose() {
    void close(); dialog.remove(); trigger.removeEventListener('click', open);
    document.removeEventListener('fullscreenchange', fullscreenChanged);
  } };
}
