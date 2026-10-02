import { AsyncPaintingRenderer } from '../art/AsyncPaintingRenderer';
import { ProceduralPainting } from '../art/ProceduralPainting';
import { musicDuration } from '../art/finishedJourney';
import type { FinishedJourney } from '../art/finishedJourney';
import type { CitySounds } from '../audio/CitySounds';
import { painterStyles, musicianStyles } from '../art/artistStyles';

const timestamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function mountExhibitionScreen(container: HTMLElement, sounds: CitySounds, onCity: () => void, onDesigner: () => void) {
  container.innerHTML = `
    <div class="exhibition-topline"><span>ARTBOT / JOURNEY COLLECTION</span><span id="exhibition-edition"></span></div>
    <header class="exhibition-header"><p class="exhibition-eyebrow">A journey, made visible.</p><h1 id="exhibition-title" tabindex="-1"></h1><p id="exhibition-attribution"></p></header>
    <figure class="exhibition-work">
      <div class="exhibition-mat artwork-download"><canvas id="exhibition-art" width="1600" height="800" role="img" aria-label="The robot’s finished journey painting"></canvas><button id="exhibition-download" class="painting-download" type="button">↓ Download painting</button></div>
      <figcaption><div><span class="exhibition-work-label">01 / THE PAINTING</span><h2>Every step left a trace</h2><p id="exhibition-art-description"></p></div><span id="exhibition-strokes"></span></figcaption>
    </figure>
    <section class="exhibition-music" aria-labelledby="exhibition-music-title">
      <div class="exhibition-track"><span class="exhibition-work-label">02 / THE MUSIC</span><h2 id="exhibition-music-title">The sound of the journey</h2><p id="exhibition-music-description"></p></div>
      <div class="exhibition-player"><div id="exhibition-wave" class="exhibition-wave" aria-hidden="true"></div><progress id="exhibition-progress" max="1" value="0" aria-label="Music playback progress"></progress><div class="exhibition-player-controls"><button id="exhibition-play" type="button">▶ Play journey music</button><button id="exhibition-stop" type="button" disabled>■ Stop</button><span id="exhibition-time">0:00 / 0:00</span></div><p id="exhibition-playback-status" role="status" aria-live="polite"></p></div>
    </section>
    <div id="exhibition-stats" class="exhibition-stats" aria-label="Journey highlights"></div>
    <footer class="exhibition-footer"><p>Every journey makes something different.</p><div><button id="exhibition-city" type="button">← Return to city</button><button id="exhibition-designer" type="button">Create another journey ↗</button></div></footer>
    <p id="exhibition-download-status" class="sr-only" role="status" aria-live="polite"></p>
  `;
  const title = container.querySelector<HTMLElement>('#exhibition-title')!;
  const canvas = container.querySelector<HTMLCanvasElement>('#exhibition-art')!;
  const play = container.querySelector<HTMLButtonElement>('#exhibition-play')!;
  const stop = container.querySelector<HTMLButtonElement>('#exhibition-stop')!;
  const progress = container.querySelector<HTMLProgressElement>('#exhibition-progress')!;
  const time = container.querySelector('#exhibition-time')!;
  const status = container.querySelector('#exhibition-playback-status')!;
  let journey: FinishedJourney | null = null;
  let renderer: AsyncPaintingRenderer | null = null;
  let duration = 0, started = 0, timer = 0;
  let active = false, playing = false;
  function updateTime(elapsed: number) {
    progress.value = duration ? Math.min(1, elapsed / duration) : 0;
    time.textContent = `${timestamp(elapsed)} / ${timestamp(duration)}`;
  }
  function stopMusic(reset = true) {
    window.clearInterval(timer); timer = 0; playing = false;
    sounds.stop(); container.classList.remove('is-playing');
    play.disabled = !journey?.score.length || !sounds.supported; stop.disabled = true;
    play.textContent = '▶ Play journey music';
    if (reset) updateTime(0);
  }
  function playMusic() {
    if (!active || !journey?.score.length || !sounds.supported) return;
    stopMusic(); sounds.unlock();
    if (sounds.isMuted) { status.textContent = 'Unmute sound to hear this journey.'; return; }
    sounds.perform(journey.score); started = performance.now(); playing = true;
    play.disabled = true; stop.disabled = false; container.classList.add('is-playing');
    status.textContent = 'Playing the music composed during this journey.';
    timer = window.setInterval(() => {
      const elapsed = Math.min(duration, (performance.now() - started) / 1000);
      updateTime(elapsed);
      if (elapsed >= duration) { stopMusic(false); play.textContent = '↻ Replay journey music'; status.textContent = 'The journey’s music has finished.'; }
    }, 100);
  }
  play.addEventListener('click', playMusic);
  stop.addEventListener('click', () => { stopMusic(); status.textContent = 'Music stopped. Play to listen again.'; });
  container.querySelector('#exhibition-city')!.addEventListener('click', onCity);
  container.querySelector('#exhibition-designer')!.addEventListener('click', onDesigner);
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
      stopMusic(); renderer?.dispose(); active = false;
      journey = structuredClone(value); duration = musicDuration(journey.score); updateTime(0);
      play.disabled = !journey.score.length || !sounds.supported;
      title.textContent = journey.artworkTitle.text;
      title.title = `A title remix of “${journey.artworkTitle.inspirations[0]}” and “${journey.artworkTitle.inspirations[1]}”.`;
      container.querySelector('#exhibition-attribution')!.textContent = `A painting & composition by ${journey.name}. Made through one unforgettable city journey.`;
      container.querySelector('#exhibition-edition')!.textContent = `ROBOT ${String(journey.robotId).padStart(3, '0')} / JOURNEY ${String(journey.runId).padStart(2, '0')}`;
      container.querySelector('#exhibition-strokes')!.textContent = `${journey.marks.length} gestures on paper`;
      container.querySelector('#exhibition-art-description')!.textContent = `${painterStyles.find(style => style.id === journey!.artist.painter)!.label} · Pigment, discoveries, setbacks, and small triumphs.`;
      container.querySelector('#exhibition-music-description')!.textContent = journey.score.length ? `${musicianStyles.find(style => style.id === journey!.artist.musician)!.label} · ${journey.bpm} BPM · ${journey.score.length} musical phrases` : 'No musical spark was collected. This journey found its voice in paint.';
      status.textContent = !sounds.supported ? 'Audio playback is unavailable in this browser.' : journey.score.length ? 'Press play to hear this robot’s journey.' : 'Explore a melody spark on your next journey to compose music.';
      const stats = container.querySelector('#exhibition-stats')!;
      stats.replaceChildren(...[[journey.steps, 'steps taken'], [journey.discoveries, 'discoveries'], [journey.improvements, 'access improvements']].map(([count, label]) => {
        const item = document.createElement('div'), number = document.createElement('strong'), caption = document.createElement('span');
        number.textContent = String(count); caption.textContent = String(label); item.append(number, caption); return item;
      }));
      const wave = container.querySelector('#exhibition-wave')!;
      wave.replaceChildren(...Array.from({ length: 64 }, (_, i) => {
        const bar = document.createElement('i');
        const note = journey!.score[i % Math.max(1, journey!.score.length)]?.score.notes[0];
        bar.style.height = `${note ? 12 + (note.midi % 24) * 2 : 4}px`; return bar;
      }));
      canvas.setAttribute('aria-label', `${journey.artworkTitle.text}, by ${journey.name}. A finished journey painting made from ${journey.marks.length} expressive gestures.`);
      const painting = new ProceduralPainting(journey.seed); painting.marks.push(...journey.marks);
      renderer = new AsyncPaintingRenderer(painting);
      await renderer.snapshot(canvas);
    },
    enter() { active = true; },
    leave() { active = false; stopMusic(); renderer?.dispose(); renderer = null; },
    dispose() { active = false; stopMusic(); renderer?.dispose(); document.removeEventListener('visibilitychange', onVisibility); },
  };
}
