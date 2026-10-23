import { AsyncPaintingRenderer } from '../art/AsyncPaintingRenderer';
import { ProceduralPainting } from '../art/ProceduralPainting';
import { musicDuration } from '../art/finishedJourney';
import type { FinishedJourney } from '../art/finishedJourney';
import type { CitySounds } from '../audio/CitySounds';
import type { createExhibitionPerformer } from '../app/createExhibitionPerformer';
import type { MusicPlayback } from '../audio/CitySounds';
import { inspirationItem } from './journeyInspirations';
import './journeyInspirations.css';
import { extendExhibitionSong, jamEffect, jamPads } from '../audio/exhibitionJam';

const timestamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

export function mountExhibitionScreen(container: HTMLElement, sounds: CitySounds, borrowPerformer: (journey: FinishedJourney) => ReturnType<typeof createExhibitionPerformer> | null) {
  container.innerHTML = `
    <header class="performance-caption"><h1 id="exhibition-title" tabindex="-1"></h1><p id="exhibition-attribution" class="sr-only"></p></header>
    <div class="performance-artwork"><canvas id="exhibition-art" width="1600" height="800" role="img" aria-label="The robot's finished journey painting"></canvas></div>
    <div class="exhibition-performer" hidden><span class="exhibition-performer-shadow" aria-hidden="true"></span></div>
    <aside class="performance-hud" aria-label="Performance controls">
      <details class="performance-jam" open>
        <summary>Play along</summary>
        <p>Tap a drum or use Z X C V. Play melody with A S D F G H J K. MIDI channel 10 plays drums; other channels play notes. Live playing is not recorded.</p>
        <div class="jam-controls">
          ${jamPads.map(pad => `<button type="button" data-drum="${pad.midi}">${pad.name} <kbd>${pad.key.toUpperCase()}</kbd></button>`).join('')}
          <button type="button" id="exhibition-extend">Add 3 minutes</button>
          <button type="button" id="exhibition-midi">Connect MIDI input</button>
          <label>MIDI input <select id="exhibition-midi-input" disabled><option>No input connected</option></select></label>
        </div>
        <p id="exhibition-jam-status" role="status">Three extra minutes of backing music. Join in whenever you like.</p>
      </details>
      <div class="performance-timeline">
        <input id="exhibition-progress" type="range" min="0" max="0" step="0.1" value="0" aria-label="Music playback position" disabled>
      </div>
      <div class="performance-actions">
        <div class="performance-buttons">
          <button id="exhibition-play" class="performance-icon-button" type="button" aria-label="Start playback" title="Start playback"><span class="sr-only">Start</span></button>
          <button id="exhibition-stop" class="performance-icon-button" type="button" aria-label="Stop playback" title="Stop playback" disabled><span class="sr-only">Stop</span></button>
          <button id="exhibition-rewind" class="performance-icon-button" type="button" aria-label="Rewind to beginning" title="Rewind to beginning"><span class="sr-only">Rewind</span></button>
          <span id="exhibition-time">0:00 / 0:00</span>
        </div>
        <div class="performance-secondary-actions">
          <details id="exhibition-inspirations" class="journey-inspirations" hidden>
            <summary>Journey inspirations</summary>
            <div class="inspiration-content"><p>These places helped shape the painting and song during this journey. Later discoveries may change an earlier influence.</p><ul class="inspiration-list"></ul></div>
          </details>
          <details class="performance-save">
            <summary>Save</summary>
            <div class="performance-save-options">
              <button id="exhibition-download" type="button">Save painting</button>
              <button id="exhibition-download-mp3" type="button">Save song (MP3)</button>
            </div>
          </details>
          <button id="exhibition-attract" type="button">Start Again</button>
        </div>
      </div>
    </aside>
    <p id="exhibition-playback-status" class="sr-only" role="status" aria-live="polite"></p>
    <p id="exhibition-download-status" class="sr-only" role="status" aria-live="polite"></p>
  `;
  const title = container.querySelector<HTMLElement>('#exhibition-title')!;
  const canvas = container.querySelector<HTMLCanvasElement>('#exhibition-art')!;
  const play = container.querySelector<HTMLButtonElement>('#exhibition-play')!;
  const stop = container.querySelector<HTMLButtonElement>('#exhibition-stop')!;
  const progress = container.querySelector<HTMLInputElement>('#exhibition-progress')!;
  const time = container.querySelector('#exhibition-time')!;
  const status = container.querySelector('#exhibition-playback-status')!;
  const performerContainer = container.querySelector<HTMLElement>('.exhibition-performer')!;
  let journey: FinishedJourney | null = null;
  let renderer: AsyncPaintingRenderer | null = null;
  let duration = 0, timer = 0, position = 0;
  let playback: MusicPlayback | undefined;
  let continuationClock: (() => number) | undefined;
  let performer: ReturnType<typeof createExhibitionPerformer> | null = null;
  let active = false, playing = false;
  let songExport: AbortController | null = null, songBlob: Blob | null = null;
  const jamStatus = container.querySelector<HTMLElement>('#exhibition-jam-status')!;
  const midiButton = container.querySelector<HTMLButtonElement>('#exhibition-midi')!;
  const midiSelect = container.querySelector<HTMLSelectElement>('#exhibition-midi-input')!;
  let midiAccess: MIDIAccess | null = null;
  let midiInput: MIDIInput | null = null;
  let midiPending = false;
  const hit = (note: number, velocity = 100, percussion = false) => {
    if (!active || document.hidden || container.closest('[inert]') || document.querySelector('dialog[open]')) return;
    sounds.unlock();
    sounds.play(jamEffect(note, velocity, percussion), percussion ? 'percussion' : 'keyboard');
  };
  container.querySelectorAll<HTMLButtonElement>('[data-drum]').forEach(button => {
    button.disabled = !sounds.supported;
    button.addEventListener('click', () => hit(Number(button.dataset.drum), 100, true));
  });
  const onKey = (event: KeyboardEvent) => {
    if (!active || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target instanceof HTMLElement && event.target.closest('input, select, textarea, summary, [contenteditable]')) return;
    const key = event.key.toLowerCase(), drum = jamPads.find(pad => pad.key === key);
    const index = 'asdfghjk'.indexOf(key);
    if (drum) { event.preventDefault(); hit(drum.midi, 100, true); }
    else if (key.length === 1 && index >= 0) { event.preventDefault(); hit([60, 62, 64, 65, 67, 69, 71, 72][index]!); }
  };
  window.addEventListener('keydown', onKey);
  const onMidi = (event: MIDIMessageEvent) => {
    const [command = 0, note = 0, velocity = 0] = event.data ?? [];
    if ((command & 0xf0) === 0x90 && velocity > 0) hit(note, velocity, (command & 15) === 9);
  };
  function selectInput() {
    midiInput?.removeEventListener('midimessage', onMidi);
    midiInput = midiAccess?.inputs.get(midiSelect.value) ?? null;
    midiInput?.addEventListener('midimessage', onMidi);
  }
  function refreshInputs() {
    const selected = midiSelect.value;
    const inputs = [...(midiAccess?.inputs.values() ?? [])].filter(input => input.state === 'connected');
    midiSelect.replaceChildren(...inputs.map(input => new Option(input.name ?? 'MIDI input', input.id)));
    if (inputs.some(input => input.id === selected)) midiSelect.value = selected;
    midiSelect.disabled = !inputs.length;
    selectInput();
    jamStatus.textContent = inputs.length ? 'MIDI ready. Play your keyboard or drum pads.' : 'No MIDI input found. Connect a device; buttons and QWERTY are ready.';
  }
  function disconnectInput() {
    midiInput?.removeEventListener('midimessage', onMidi); midiInput = null;
    midiAccess?.removeEventListener('statechange', refreshInputs); midiAccess = null;
    midiSelect.replaceChildren(new Option('No input connected', '')); midiSelect.disabled = true;
    midiButton.textContent = 'Connect MIDI input';
  }
  midiSelect.addEventListener('change', selectInput);
  midiButton.disabled = !navigator.requestMIDIAccess;
  midiButton.addEventListener('click', async () => {
    if (midiAccess) { disconnectInput(); jamStatus.textContent = 'MIDI input disconnected.'; return; }
    if (midiPending) return;
    sounds.unlock(); midiPending = true; midiButton.disabled = true;
    try {
      const access = await navigator.requestMIDIAccess();
      if (!active) return;
      midiAccess = access; midiAccess.addEventListener('statechange', refreshInputs);
      midiButton.textContent = 'Disconnect MIDI input'; refreshInputs();
    } catch { jamStatus.textContent = 'MIDI input could not connect. Use the buttons or QWERTY keyboard.'; }
    finally { midiPending = false; midiButton.disabled = !navigator.requestMIDIAccess; }
  });
  container.querySelector('#exhibition-extend')!.addEventListener('click', () => {
    if (!journey?.score.length) return;
    const resume = playing;
    stopMusic(false); cancelSongExport(); songBlob = null;
    mp3Download.disabled = !canExportSong();
    extendExhibitionSong(journey.score, journey.bpm);
    duration = musicDuration(journey.score); progress.max = String(duration); updateTime(position);
    if (resume) playMusic();
    jamStatus.textContent = 'Added another three minutes. Keep playing along!';
  });
  const mp3Download = container.querySelector<HTMLButtonElement>('#exhibition-download-mp3')!;
  const canExportSong = () => !!journey?.score.length && typeof OfflineAudioContext !== 'undefined' && typeof Worker !== 'undefined';
  function cancelSongExport() { songExport?.abort(); songExport = null; mp3Download.textContent = 'Save song (MP3)'; }
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
      if (songExport === controller) { songExport = null; mp3Download.disabled = !canExportSong(); mp3Download.textContent = 'Save song (MP3)'; }
    }
  });
  function updateTime(elapsed: number) {
    position = Math.max(0, Math.min(duration, elapsed));
    progress.value = String(position);
    progress.style.setProperty('--allocation', `${duration ? position / duration * 100 : 0}%`);
    progress.setAttribute('aria-valuetext', `${timestamp(position)} of ${timestamp(duration)}`);
    time.textContent = `${timestamp(position)} / ${timestamp(duration)}`;
  }
  function stopMusic(reset = true, keepMusic = false) {
    if (!reset && playback) updateTime(playback.elapsed());
    window.clearInterval(timer); timer = 0; playing = false;
    performer?.stop(); playback?.stop(); playback = undefined;
    if (!keepMusic) sounds.stop();
    container.classList.remove('is-playing');
    play.disabled = !journey?.score.length || !sounds.supported; stop.disabled = true;
    if (reset) updateTime(0);
  }
  function playMusic() {
    if (!active || !journey?.score.length || !sounds.supported) return;
    const continuation = continuationClock?.();
    continuationClock = undefined;
    stopMusic(false);
    if (continuation !== undefined) updateTime(continuation);
    if (position >= duration) {
      if (continuation !== undefined) { status.textContent = 'The journey’s music has finished.'; return; }
      updateTime(0);
    }
    sounds.unlock();
    if (sounds.isMuted) { status.textContent = 'Unmute sound to hear this journey.'; return; }
    playback = sounds.perform(journey.score, journey.score[0]?.at, position, journey.bpm);
    if (!playback) { status.textContent = 'Playback could not start. Please try again.'; return; }
    playing = true;
    performer?.play(() => playback?.elapsed() ?? 0);
    play.disabled = true; stop.disabled = false; container.classList.add('is-playing');
    status.textContent = continuation !== undefined ? 'Your robot continues the journey’s song into its studio crescendo. Dance along!' : 'Replaying your studio song, including its extra verses and harmonies. Dance along!';
    timer = window.setInterval(() => {
      const elapsed = playback?.elapsed() ?? 0;
      updateTime(elapsed);
      if (elapsed >= duration) { stopMusic(false); updateTime(duration); status.textContent = 'The journey’s music has finished.'; }
    }, 100);
  }
  play.addEventListener('click', playMusic);
  stop.addEventListener('click', () => { stopMusic(false); status.textContent = 'Music stopped. Start to continue.'; });
  function seek(seconds: number) {
    const resume = playing;
    stopMusic(false);
    updateTime(seconds);
    if (resume && position < duration) playMusic();
    else status.textContent = `Music position: ${timestamp(position)}.`;
  }
  progress.addEventListener('input', () => seek(Number(progress.value)));
  const rewind = container.querySelector<HTMLButtonElement>('#exhibition-rewind')!;
  rewind.addEventListener('click', () => seek(0));
  const onVisibility = () => { if (document.hidden && playing) { stopMusic(false); status.textContent = 'Music stopped while the page was away. Start to continue.'; } };
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
    async prepare(value: FinishedJourney, clock?: () => number) {
      cancelSongExport(); songBlob = null;
      stopMusic(true, !!clock); continuationClock = clock; renderer?.dispose(); performer?.dispose(); performer = null; performerContainer.hidden = true; active = false;
      journey = structuredClone(value); duration = musicDuration(journey.score);
      extendExhibitionSong(journey.score, journey.bpm); duration = musicDuration(journey.score);
      container.querySelector<HTMLButtonElement>('#exhibition-extend')!.disabled = !journey.score.length;
      const inspirations = container.querySelector<HTMLDetailsElement>('#exhibition-inspirations')!;
      inspirations.open = false; inspirations.hidden = !journey.inspirations?.length;
      inspirations.querySelector('ul')!.replaceChildren(...(journey.inspirations ?? []).map(inspirationItem));
      progress.max = String(duration); progress.disabled = !duration || !sounds.supported;
      rewind.disabled = progress.disabled; updateTime(0);
      container.querySelector<HTMLDetailsElement>('.performance-save')!.open = false;
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
    leave() { active = false; disconnectInput(); cancelSongExport(); stopMusic(); renderer?.dispose(); renderer = null; performer?.dispose(); performer = null; },
    dispose() { active = false; disconnectInput(); window.removeEventListener('keydown', onKey); cancelSongExport(); stopMusic(); renderer?.dispose(); performer?.dispose(); document.removeEventListener('visibilitychange', onVisibility); },
  };
}
