/** Controls occupy their own grid row, so no control can overlap the projection. */
export function mountConfigurationDock(page: HTMLElement) {
  const dock = document.createElement('aside');
  dock.className = 'configuration-dock';
  dock.ariaLabel = 'Projection controls';
  dock.innerHTML = `<details class="configuration-dock-disclosure" open><summary>Robot controls</summary><div class="configuration-dock-content"></div></details><button type="button" class="tertiary configuration-dock-move">Move controls to top</button>`;
  const content = dock.querySelector<HTMLElement>('.configuration-dock-content')!;
  content.append(page.querySelector('.configuration-header')!, page.querySelector('.configuration-robot')!);
  page.append(dock);
  const move = dock.querySelector<HTMLButtonElement>('.configuration-dock-move')!;
  move.addEventListener('click', () => {
    const top = page.dataset.dock !== 'top';
    page.dataset.dock = top ? 'top' : 'bottom';
    move.textContent = `Move controls to ${top ? 'bottom' : 'top'}`;
  });
}
