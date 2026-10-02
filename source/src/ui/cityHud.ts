/** Floating panels leave the city canvas as the full viewport backdrop. */
export function mountCityHud(container: HTMLElement) {
  const dock = document.createElement('div');
  dock.className = 'city-panel-hud';
  const disclosure = (id: string, title: string, content: Element) => {
    const details = document.createElement('details');
    details.id = id; details.className = 'city-hud-disclosure';
    const summary = document.createElement('summary'); summary.textContent = title;
    details.append(summary, content);
    return details;
  };
  const editor = disclosure('city-editor-toggle', 'Edit city', container.querySelector('#city-editor')!);
  const creative = disclosure('city-creative-toggle', 'Create', container.querySelector('.creative-studio')!);
  dock.append(editor, creative); container.append(dock);
  const painting = disclosure('city-painting-toggle', 'Live painting', container.querySelector('.painting-hud')!);
  painting.classList.add('city-painting-disclosure');
  painting.open = !window.matchMedia('(max-width: 700px)').matches;
  container.querySelector('.city-viewport')!.append(painting);
  const panels = [editor, creative, painting];
  panels.forEach(panel => panel.addEventListener('toggle', () => {
    if (!panel.open) return;
    panels.forEach(other => {
      if (other !== panel && (other !== painting && panel !== painting || window.matchMedia('(max-width: 700px)').matches)) other.open = false;
    });
  }));
  return { openEditor() { editor.open = true; creative.open = false; if (window.matchMedia('(max-width: 700px)').matches) painting.open = false; } };
}
