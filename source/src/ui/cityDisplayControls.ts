/** Mirrors committed paint frames, including worker frames, without another renderer. */
export function mountCityDisplayControls(container: HTMLElement, painting: HTMLCanvasElement, feedback: (message: string) => void) {
  const fullscreen = container.querySelector<HTMLButtonElement>('#city-fullscreen')!;
  const popout = container.querySelector<HTMLButtonElement>('#city-art-window')!;
  let artWindow: Window | null = null;
  let artCanvas: HTMLCanvasElement | null = null;
  let changingFullscreen = false;

  function syncFullscreen() {
    const active = document.fullscreenElement !== null;
    const label = active ? 'Exit fullscreen' : 'Enter fullscreen';
    fullscreen.textContent = label;
    fullscreen.setAttribute('aria-label', label);
    fullscreen.setAttribute('aria-pressed', String(active));
    fullscreen.title = label;
    fullscreen.disabled = !document.fullscreenEnabled || changingFullscreen;
  }
  async function toggleFullscreen() {
    changingFullscreen = true; syncFullscreen();
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { feedback('Fullscreen is unavailable in this browser.'); }
    finally { changingFullscreen = false; syncFullscreen(); }
  }
  function paint() {
    if (!artWindow || artWindow.closed) { artWindow = null; artCanvas = null; return; }
    if (!artCanvas) return;
    const context = artCanvas.getContext('2d');
    if (!context) return;
    context.clearRect(0, 0, painting.width, painting.height);
    context.drawImage(painting, 0, 0);
    artCanvas.setAttribute('aria-label', painting.getAttribute('aria-label') ?? 'Live robot painting');
  }
  function openArtwork() {
    if (artWindow && !artWindow.closed) { paint(); artWindow.focus(); return; }
    artWindow = window.open('', '_blank', `popup=yes,width=${painting.width},height=${painting.height}`);
    if (!artWindow) { feedback('Allow pop-ups for this site to open the live painting window.'); return; }
    const doc = artWindow.document;
    doc.title = 'Live robot painting';
    doc.documentElement.lang = document.documentElement.lang || 'en';
    const style = doc.createElement('style');
    style.textContent = 'html,body{margin:0;padding:0;background:#171717}canvas{display:block}';
    doc.head.append(style);
    artCanvas = doc.createElement('canvas');
    artCanvas.width = painting.width; artCanvas.height = painting.height;
    artCanvas.setAttribute('role', 'img');
    doc.body.replaceChildren(artCanvas);
    paint();
    // Compensate for browser chrome to request an exact artwork-sized content area.
    try {
      artWindow.resizeTo(painting.width + artWindow.outerWidth - artWindow.innerWidth,
        painting.height + artWindow.outerHeight - artWindow.innerHeight);
    } catch { /* Some browsers constrain popup sizing. The canvas retains its exact size. */ }
    artWindow.focus();
  }
  fullscreen.addEventListener('click', toggleFullscreen);
  popout.addEventListener('click', openArtwork);
  document.addEventListener('fullscreenchange', syncFullscreen);
  syncFullscreen();
  return {
    paint,
    dispose() {
      fullscreen.removeEventListener('click', toggleFullscreen);
      popout.removeEventListener('click', openArtwork);
      document.removeEventListener('fullscreenchange', syncFullscreen);
      artWindow?.close(); artWindow = null; artCanvas = null;
    },
  };
}
