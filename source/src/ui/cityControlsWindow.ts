import { mapIcon } from './mapIcons';
import { mountButtonIcons } from './buttonIcons';

/** Adopt the live controls so their values and event handlers survive the move. */
export function mountCityControlsWindow(controls: HTMLDetailsElement, button: HTMLButtonElement, feedback: (message: string) => void, onPopupButton: (button: HTMLButtonElement) => void) {
  const home = controls.parentElement!;
  const anchor = document.createComment('City controls home');
  home.insertBefore(anchor, controls);
  let popup: Window | null = null;
  let stopIcons: (() => void) | undefined;
  let observer: MutationObserver | undefined;
  let closedTimer: number | undefined;

  function label(detached: boolean) {
    const text = detached ? 'Shrink controls' : 'Move controls to new window';
    button.setAttribute('aria-label', text); button.title = text;
    button.setAttribute('aria-pressed', String(detached));
    button.innerHTML = mapIcon(detached ? 'shrink' : 'window');
  }
  function restore(focus = true) {
    const previous = popup; popup = null;
    window.clearInterval(closedTimer); observer?.disconnect(); stopIcons?.();
    observer = undefined; stopIcons = undefined;
    anchor.after(controls); home.removeAttribute('data-controls-detached');
    label(false); controls.open = true; home.hidden = false;
    if (previous && !previous.closed) previous.close();
    if (focus) button.focus({ preventScroll: true });
  }
  function open() {
    if (popup && !popup.closed) { restore(); return; }
    const next = window.open('', '_blank', 'popup=yes,width=440,height=740');
    if (!next) { feedback('Allow pop-ups for this site to move the city controls to a new window.'); return; }
    popup = next;
    const doc = next.document;
    doc.title = 'City controls';
    const base = doc.createElement('base'); base.href = document.baseURI; doc.head.append(base);
    for (const style of document.querySelectorAll('style, link[rel="stylesheet"]')) doc.head.append(style.cloneNode(true));
    const layout = doc.createElement('style');
    layout.textContent = `
      html, body { margin: 0; min-height: 100%; overflow: auto; }
      #city-screen.city-controls-window { position: static; display: block; height: auto; min-height: 100dvh; padding: 0; overflow: visible; filter: none; }
      #city-screen.city-controls-window .city-controls-hud { width: 100%; }
      #city-screen.city-controls-window .city-plan { max-height: none; overflow: visible; }
      #city-screen.city-controls-window .city-controls-hud > summary { display: none; }
    `;
    doc.head.append(layout);
    const root = doc.createElement('main'); root.id = 'city-screen'; root.className = 'city-controls-window';
    doc.body.append(root);
    root.addEventListener('click', event => {
      const target = event.target as Element | null;
      const clicked = target?.closest<HTMLButtonElement>('button');
      if (clicked && !clicked.disabled) onPopupButton(clicked);
    }, true);
    function syncPreferences() {
      for (const attribute of [...doc.documentElement.attributes]) doc.documentElement.removeAttribute(attribute.name);
      for (const attribute of [...document.documentElement.attributes]) doc.documentElement.setAttribute(attribute.name, attribute.value);
      doc.documentElement.lang = document.documentElement.lang || 'en';
      root.dataset.journeyState = home.closest<HTMLElement>('#city-screen')?.dataset.journeyState ?? '';
    }
    syncPreferences();
    observer = new MutationObserver(syncPreferences);
    observer.observe(document.documentElement, { attributes: true });
    controls.open = true; root.append(controls); home.dataset.controlsDetached = 'true';
    label(true); stopIcons = mountButtonIcons(root);
    next.addEventListener('pagehide', () => { if (popup === next) restore(); });
    // Closing a native window must return the controls even if pagehide is skipped.
    closedTimer = window.setInterval(() => { if (popup?.closed) restore(); }, 250);
    next.focus(); button.focus({ preventScroll: true });
  }
  button.addEventListener('click', open); label(false);
  return {
    get detached() { return !!popup && !popup.closed; },
    restore() { if (popup) restore(false); },
    dispose() { if (popup) restore(false); button.removeEventListener('click', open); anchor.remove(); },
  };
}
