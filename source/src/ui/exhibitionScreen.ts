import { AsyncPaintingRenderer } from '../art/AsyncPaintingRenderer';
import { ProceduralPainting } from '../art/ProceduralPainting';
import { musicDuration } from '../art/finishedJourney';
import type { FinishedJourney } from '../art/finishedJourney';
import type { CitySounds } from '../audio/CitySounds';
import type { createExhibitionPerformer } from '../app/createExhibitionPerformer';
import type { MusicPlayback } from '../audio/CitySounds';

const timestamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function mountExhibitionScreen(container: HTMLElement, sounds: CitySounds, borrowPerformer: (journey: FinishedJourney) => ReturnType<typeof createExhibitionPerformer> | null) {
  container.innerHTML = `
    <header class="performance-caption"><h1 id="exhibition-title" tabindex="-1"></h1><p id="exhibition-attribution" class="sr-only"></p></header>
    <div class="performance-artwork"><canvas id="exhibition-art" width="1600" height="800" role="img" aria-label="The robot's finished journey painting"></canvas></div>
    <div class="exhibition-performer" hidden><span class="exhibition-performer-shadow" aria-hidden="true"></span></div>
    <aside class="performance-hud" aria-label="Performance controls">
      <progress id="exhibition-progress" max="1" value="0" aria-label="Music playback progress"></progress>
      <span id="exhibition-time">0:00 / 0:00</span>
      <div class="performance-buttons">
        <button id="exhibition-play" type="button" aria-label="Replay studio song" title="Replay studio song">Replay studio song</button>
        <button id="exhibition-stop" type="button" disabled aria-label="Stop music" title="Stop music">Stop music</button>
        <button id="exhibition-download" type="button" aria-label="Download painting" title="Download painting">Download painting</button>
        <button id="exhibition-download-mp3" type="button" aria-label="Download song as MP3" title="Download song as MP3">Download song as MP3</button>
        <button id="exhibition-attract" type="button" aria-label="Return to attractor" title="Return to attractor">Return to attractor</button>
      </div>
    </aside>
    <p id="exhibition-playback-status" class="sr-only" role="status" aria-live="polite"></p>
    <p id="exhibition-download-status" class="sr-only" role="status" aria-live="polite"></p>
  `;
  const title = container.querySelector<HTMLElement>('#exhibition-title')!;
  const canvas = container.querySelector<HTMLCanvasElement>('#exhibition-art')!;
  const play = container.querySelector<HTMLButtonElement>('#exhibition-play')!;
  const stop = container.querySelector<HTMLButtonElement>('#exhibition-stop')!;
  const progress = container.querySelector<HTMLProgressElement>('#exhibition-progress')!;
  const time = container.querySelector('#exhibition-time')!;
  const status = container.querySelector('#exhibition-playback-status')!;
  const performerContainer = container.querySelector<HTMLElement>('.exhibition-performer')!;
  let journey: FinishedJourney | null = null;
  let renderer: AsyncPaintingRenderer | null = null;
  let duration = 0, timer = 0;
  let playback: MusicPlayback | undefined;
  let performer: ReturnType<typeof createExhibitionPerformer> | null = null;
  let active = false, playing = false;
  let songExport: AbortController | null = null, songBlob: Blob | null = null;
  const mp3Download = container.querySelector<HTMLButtonElement>('#exhibition-download-mp3')!;
  const canExportSong = () => !!journey?.score.length && typeof OfflineAudioContext !== 'undefined' && typeof Worker !== 'undefined';
  function cancelSongExport() { songExport?.abort(); songExport = null; mp3Download.textContent = 'Download song as MP3'; }
  mp3Download.addEventListener('click', async () => {
    if (!active || !canExportSong() || songExport) return;
    const current = journey!, controller = new AbortController();
    songExport = controller; mp3Download.disabled = true; mp3Download.textContent = 'Preparing MP3…';
    status.textContent = 'Preparing your complete studio song for download.';
    try {
      const { exportSongMp3 } = await import('../audio/exportSong');
      const blob = songBlob ?? await exportSongMp3(current.score, controller.signal);
      if (!active || journey !== current || controller.signal.aborted) return;
      songBlob = blob;
      const name = current.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().replace(/\s+/g, '-').slice(0, 70) || 'artbot';
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `${name}-studio-duet-${current.runId}.mp3`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      status.textContent = 'Your studio song is ready. Check your downloads for the MP3.';
    } catch {
      if (!controller.signal.aborted) status.textContent = 'The MP3 could not be created. Please try again.';
    } finally {
      if (songExport === controller) { songExport = null; mp3Download.disabled = !canExportSong(); mp3Download.textContent = 'Download song as MP3'; }
    }
  });
  function updateTime(elapsed: number) {
    progress.value = duration ? Math.min(1, elapsed / duration) : 0;
    time.textContent = `${timestamp(elapsed)} / ${timestamp(duration)}`;
  }
  function stopMusic(reset = true) {
    window.clearInterval(timer); timer = 0; playing = false;
    performer?.stop(); playback?.stop(); playback = undefined;
    sounds.stop(); container.classList.remove('is-playing');
    play.disabled = !journey?.score.length || !sounds.supported; stop.disabled = true;
    play.textContent = '▶ Replay studio song';
    if (reset) updateTime(0);
  }
  function playMusic() {
    if (!active || !journey?.score.length || !sounds.supported) return;
    stopMusic(); sounds.unlock();
    if (sounds.isMuted) { status.textContent = 'Unmute sound to hear this journey.'; return; }
    playback = sounds.perform(journey.score);
    if (!playback) { status.textContent = 'Playback could not start. Please try again.'; return; }
    playing = true;
    performer?.play(() => playback?.elapsed() ?? 0);
    play.disabled = true; stop.disabled = false; container.classList.add('is-playing');
    status.textContent = 'Replaying your studio song, including its extra verses and harmonies. Dance along!';
    timer = window.setInterval(() => {
      const elapsed = playback?.elapsed() ?? 0;
      updateTime(elapsed);
      if (elapsed >= duration) { stopMusic(false); play.textContent = '↻ Replay studio song'; status.textContent = 'The journey’s music has finished.'; }
    }, 100);
  }
  play.addEventListener('click', playMusic);
  stop.addEventListener('click', () => { stopMusic(); status.textContent = 'Music stopped. Play to listen again.'; });
  const onVisibility = () => { if (document.hidden && playing) { stopMusic(); status.textContent = 'Music stopped while the page was away. Play to listen again.'; } };
  document.addEventListener('visibilitychange', onVisibility);
  const download = container.querySelector<HTMLButtonElement>('#exhibition-download')!;
  const downloadStatus = container.querySelector('#exhibition-download-status')!;
  download.addEventListener('click', async () => {
    if (!journey || !renderer) return;
    download.disabled = true;
    const current = journey;
    try {
      const blob = await renderer.exportPNG();
      if (!active || journey !== current) return;
      const name = current.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().replace(/\s+/g, '-').slice(0, 70) || 'artbot';
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `${name}-journey-${current.runId}-painting.png`;
      document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      downloadStatus.textContent = 'Painting ready. Check your downloads.';
    } catch { downloadStatus.textContent = 'The painting could not be downloaded. Please try again.'; }
    finally { download.disabled = false; }
  });
  return {
    title,
    async prepare(value: FinishedJourney) {
      cancelSongExport(); songBlob = null;
      stopMusic(); renderer?.dispose(); performer?.dispose(); performer = null; performerContainer.hidden = true; active = false;
      journey = structuredClone(value); duration = musicDuration(journey.score); updateTime(0);
      mp3Download.disabled = !canExportSong();
      play.disabled = !journey.score.length || !sounds.supported;
      title.textContent = journey.artworkTitle.text;
      title.title = `A title remix of “${journey.artworkTitle.inspirations[0]}” and “${journey.artworkTitle.inspirations[1]}”.`;
      container.querySelector('#exhibition-attribution')!.textContent = `A painting & composition by ${journey.name}. Made through one unforgettable city journey.`;
      status.textContent = !sounds.supported ? 'Audio playback is unavailable in this browser.' : 'Your robot plays its studio song with its own synth voices. Download your painting or song using the controls.';
      canvas.setAttribute('aria-label', `${journey.artworkTitle.text}, by ${journey.name}. A finished journey painting made from ${journey.marks.length} expressive gestures.`);
      const painting = new ProceduralPainting(journey.seed); painting.marks.push(...journey.marks);
      renderer = new AsyncPaintingRenderer(painting);
      await renderer.snapshot(canvas);
      performer = borrowPerformer(journey);
      performerContainer.hidden = !performer;
    },
    enter() { active = true; mp3Download.disabled = !canExportSong(); performer?.enter(performerContainer); playMusic(); },
    leave() { active = false; cancelSongExport(); stopMusic(); renderer?.dispose(); renderer = null; performer?.dispose(); performer = null; },
    dispose() { active = false; cancelSongExport(); stopMusic(); renderer?.dispose(); performer?.dispose(); document.removeEventListener('visibilitychange', onVisibility); },
  };
}
