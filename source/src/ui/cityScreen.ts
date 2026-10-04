import { reducedMotionPreference } from '../app/accessibilityPreferences';
import { Engine } from '@babylonjs/core/Engines/engine';
import { createCityScene } from '../city/createCityScene';
import type { CityView } from '../city/cityCamera';
import { sides } from '../city/cityDimensions';
import { generateCity, streetActions, streetNames, streetBetween } from '../city/proceduralCity';
import type { Theme } from '../app/theme';
import type { ArtBot } from '../robot/botHistory';
import type { CitySounds } from '../audio/CitySounds';
import type { ScreenSpeech } from '../audio/ScreenSpeech';
import { JourneyCreativity } from '../art/JourneyCreativity';
import { AsyncPaintingRenderer } from '../art/AsyncPaintingRenderer';
import type { MusicPlayback } from '../audio/CitySounds';
import { musicDuration } from '../art/finishedJourney';
import { captureFinishedJourney } from '../art/finishedJourney';
import type { FinishedJourney } from '../art/finishedJourney';
import { pianoSynthScore } from '../audio/pianoSynth';

export function mountCityScreen(container: HTMLElement, sounds: CitySounds, onPresent: (journey: FinishedJourney) => void, speech?: ScreenSpeech) {
  container.innerHTML = `
    <h1 class="sr-only">Get your ArtBot to the studio</h1>
    <header class="city-toolbar">
      <div class="city-identity"><strong id="city-bot-name"></strong><span id="city-seed"></span></div>
      <div class="city-tools" role="group" aria-label="City tools">
        <button id="city-tool-route" type="button" aria-pressed="false">Draw route</button>
        <button id="city-tool-edit" type="button" aria-pressed="true">Change city</button>
        <button id="city-pause" type="button">Start robot</button>
      </div>
      <button id="back-to-designer" type="button">Edit robot</button>
    </header>
    <div class="city-map">
      <canvas id="city-canvas" role="img" aria-label="Your robot starts at the Workshop. Its goal is the Duet studio, marked by a large finish flag. Start the robot and change the city when a barrier blocks its journey."></canvas>
      <div id="city-goal" class="city-goal-marker"><strong>⚑ GOAL</strong><span>Duet studio</span><small>Use Show goal</small></div>
      <section id="studio-track" class="studio-track" aria-label="Your duet track" hidden>
        <p class="city-eyebrow">ARTBOT + YOU / THE DUET</p><h2 id="studio-track-title"></h2>
        <p class="studio-invitation">Join your ArtBot! Sway, clap or dance along in your own way.</p>
        <p id="studio-track-status" role="status" aria-live="polite"></p>
        <progress id="studio-track-progress" max="1" value="0" aria-label="Duet playback progress"></progress>
        <div class="studio-track-controls"><button id="studio-track-play" type="button">Replay from start</button><button id="studio-track-stop" type="button" disabled>Stop track</button><span id="studio-track-time">0:00 / 0:00</span></div>
      </section>
      <p id="city-hover" class="city-hover" hidden></p>
    </div>
    <aside class="city-plan" aria-label="Route and city changes">
      <div class="city-view-tools" role="group" aria-label="City view">
        <button type="button" data-view="overhead" aria-pressed="true">Map view</button>
        <button type="button" data-view="angled" aria-pressed="false">3D view</button>
        <button type="button" data-view="follow" aria-pressed="false">Follow robot</button>
        <button type="button" data-view="robot-eye" aria-pressed="false">Robot eye</button>
        <button id="city-map-fit" type="button">Show goal</button>
      </div>
      <p class="city-eyebrow" id="city-phase">YOUR LINE. YOUR CITY.</p>
      <h2 id="city-heading" tabindex="-1">Reach the goal</h2>
      <p id="journey-status" role="status" aria-live="polite">Press Start robot. Help it reach the flagged Duet studio.</p>
      <div class="city-route-stats" id="city-route-stats"></div>
      <section id="city-route-controls" aria-label="Draw your route">
        <p class="city-plan-hint">Drawing is optional. Choose stops or draw between junctions to explore. Start robot fills in the rest of the route to the flagged goal.</p>
        <h3 id="city-next-heading">Next stop</h3>
        <div id="city-next-stops" class="city-next-stops"></div>
        <div class="city-secondary-actions"><button id="city-route-undo" type="button" disabled>Undo line</button><button id="city-route-clear" type="button" disabled>Clear line</button></div>
      </section>
      <section id="city-change-controls" aria-label="Change the city" hidden>
        <label for="city-street">Place to change</label><select id="city-street" aria-label="Place to change"></select>
        <h3 id="city-feature-name"></h3><p id="city-feature-reason"></p>
        <p id="city-signal-status" role="status" aria-live="polite" hidden></p>
        <div id="city-size-controls" hidden>
          <label id="city-size-label" for="city-size">Size</label>
          <input id="city-size" type="range" aria-describedby="city-size-value" />
          <output id="city-size-value" for="city-size"></output>
          <p>Drag a wall, doorway or street edge on the map, or use this slider. Undo lets you try again.</p>
        </div>
        <button id="city-repair" type="button" disabled>Choose a place</button>
        <button id="city-crossing-cues" type="button" hidden>Add beeper and tactile cues</button>
        <button id="city-undo" type="button" disabled>Undo city change</button>
      </section>
      <p id="city-feedback" role="status" aria-live="polite"></p>
      <div id="city-finished" hidden><p id="city-result"></p><button id="city-exhibition" type="button">See your artwork</button></div>
      <details class="city-map-options"><summary>Zoom and move the map <span class="disclosure-chevron" aria-hidden="true">⌄</span></summary>
        <div class="city-map-buttons" role="group" aria-label="Zoom and pan controls">
          <button type="button" data-map="zoom-in">Zoom in</button><button type="button" data-map="zoom-out">Zoom out</button>
          <button type="button" data-map="up">Move up</button><button type="button" data-map="down">Move down</button>
          <button type="button" data-map="left">Move left</button><button type="button" data-map="right">Move right</button>
        </div>
      </details>
      <details class="city-art"><summary><span>Journey artwork</span><span id="painting-strokes">0 marks</span><span class="disclosure-chevron" aria-hidden="true">⌄</span></summary><canvas id="journey-art" role="img" width="800" height="400" aria-label="Your painting grows as the robot travels."></canvas><p id="painting-action">Every step leaves paint.</p></details>
      <div class="city-new-actions"><button id="city-restart" type="button" disabled>Redraw route</button><button id="city-new" type="button">New city</button></div>
      <p class="city-rule">You change the city. Your ArtBot makes the journey. Together, you make a duet at the studio.</p>
    </aside>`;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!;
  const canvas = get<HTMLCanvasElement>('city-canvas'), painting = get<HTMLCanvasElement>('journey-art');
  const plan = container.querySelector<HTMLElement>('.city-plan')!;
  const pause = get<HTMLButtonElement>('city-pause'), streetSelect = get<HTMLSelectElement>('city-street');
  const sizeInput = get<HTMLInputElement>('city-size');
  let sizeId: string | null = null;
  let engine: Engine | null = null, city: ReturnType<typeof createCityScene> | null = null;
  let active = false, theme: Theme = 'dark', bot: ArtBot | null = null, robots: readonly ArtBot[] = [];
  let mode: 'route' | 'edit' = 'edit', selected: string | null = null, lastBlock: string | null = null;
  let creation: JourneyCreativity | null = null, renderer: AsyncPaintingRenderer | null = null;
  let eventCursor = 0, lastPaint = performance.now(), routeKey = '', panelKey = '', lastMood = '';
  let finished: FinishedJourney | null = null, playback: MusicPlayback | undefined;
  let studioStarted = false, studioPreparing = false, trackElapsed = 0;
  let cityMusicTime = 0, lastMusicFrame = performance.now();
  let stopArrivalBed: (() => void) | undefined;
  const timestamp = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
  function stopTrack(reset = true) {
    stopArrivalBed?.(); stopArrivalBed = undefined;
    trackElapsed = reset ? 0 : playback?.elapsed() ?? trackElapsed;
    playback?.stop(); playback = undefined; city?.setSinging(false); city?.stopDancing();
    get<HTMLButtonElement>('studio-track-stop').disabled = true;
  }
  function playTrack() {
    if (!finished || !active) return;
    stopTrack(); sounds.stop(); sounds.unlock();
    playback = sounds.perform(finished.score);
    if (playback) { const handle = playback; city?.danceToMusic(finished, () => handle.elapsed()); }
    get<HTMLButtonElement>('studio-track-stop').disabled = !playback;
    setText('studio-track-status', playback ? 'Your duet is playing. Move to the beat and try a turn together!' : sounds.isMuted ? 'Unmute sound, then play your duet.' : 'Press play to hear your duet.');
  }
  const reducedMotion = reducedMotionPreference();
  const setText = (id: string, value: string) => { if (get(id).textContent !== value) get(id).textContent = value; };
  function feedback(text: string) { setText('city-feedback', text); }
  function beginCreation() {
    if (!city) return;
    stopTrack(); finished = null; studioStarted = false; studioPreparing = false; get('studio-track').hidden = true;
    delete container.dataset.studioPerformance;
    renderer?.dispose(); creation = new JourneyCreativity(city.journey.bot); renderer = new AsyncPaintingRenderer(creation.painting);
    cityMusicTime = 0; lastMusicFrame = performance.now();
    city.journey.machine.run.creative = { seed: creation.seed, bpm: creation.bpm, music: creation.music, art: true, harmony: false, colour: false, artist: structuredClone(creation.artist), score: creation.score, marks: creation.marks };
    eventCursor = city.journey.machine.record.events.length; lastPaint = performance.now();
  }
  function setMode(value: typeof mode) {
    if (!city) return;
    if (value === 'route' && !city.journey.ready) return;
    city.resizer.finish(false); mode = value; plan.scrollTop = 0; city.highlight(null); get('city-hover').hidden = true; panelKey = ''; refresh();
  }
  function selectStreet(id: string) {
    if (!city) return;
    selected = id;
    if (!city.journey.ready && !city.journey.complete && !city.journey.blocked) city.journey.setPaused(true);
    mode = 'edit'; plan.scrollTop = 0; streetSelect.value = id; city.highlight(id); panelKey = ''; refresh();
  }
  function updateCityMusic() {
    const now = performance.now();
    if (!active || document.hidden || !city || !creation || finished || studioPreparing) { lastMusicFrame = now; return; }
    cityMusicTime += Math.max(0, (now - lastMusicFrame) / 1000);
    lastMusicFrame = now;
    const j = city.journey;
    creation.observeMotion(city.musicPosition, j.heading, cityMusicTime, j.ready || j.paused);
    sounds.perform(creation.advance(cityMusicTime, false, j.complete), cityMusicTime);
  }
  // Audio keeps its beat even when rendering is slow or animation frames are throttled.
  const musicTimer = window.setInterval(updateCityMusic, 50);
  function refresh() {
    if (!city) return;
    const j = city.journey;
    container.dataset.journeyState = j.complete ? 'complete' : j.blocked ? 'blocked' : j.ready ? 'ready' : j.paused ? 'paused' : j.waiting ? 'waiting' : 'travelling';
    const goal = city.projectNode(j.world.destination), marker = get('city-goal');
    const onMap = goal.z >= 0 && goal.z <= 1 && goal.x >= 0 && goal.x <= canvas.clientWidth && goal.y >= 0 && goal.y <= canvas.clientHeight;
    marker.classList.toggle('is-offscreen', !onMap);
    const insetX = Math.min(marker.offsetWidth / 2 + 12, canvas.clientWidth / 2), insetY = marker.offsetHeight / 2 + 12;
    const left = Math.max(insetX, Math.min(canvas.clientWidth - insetX, goal.x));
    const below = goal.y < marker.offsetHeight + 26;
    marker.classList.toggle('is-below-goal', below);
    marker.style.left = `${left}px`;
    marker.style.top = `${Math.max(insetY, Math.min(canvas.clientHeight - insetY, goal.y + (below ? 1 : -1) * (marker.offsetHeight / 2 + 14)))}px`;
    marker.style.setProperty('--goal-pointer-offset', `${Math.max(-marker.offsetWidth / 2 + 12, Math.min(marker.offsetWidth / 2 - 12, goal.x - left))}px`);
    get<HTMLButtonElement>('city-tool-route').disabled = !j.ready;
    get('city-tool-route').setAttribute('aria-pressed', String(mode === 'route'));
    get('city-tool-edit').setAttribute('aria-pressed', String(mode === 'edit'));
    for (const id of ['city-map-fit', 'city-tool-edit']) get<HTMLButtonElement>(id).disabled = j.complete;
    container.dataset.cityView = city.view;
    for (const button of container.querySelectorAll<HTMLButtonElement>('[data-view]')) {
      button.disabled = j.complete;
      button.setAttribute('aria-pressed', String(button.dataset.view === city.view));
    }
    const canPan = city.view === 'overhead' || city.view === 'angled';
    for (const button of container.querySelectorAll<HTMLButtonElement>('[data-map]')) button.disabled = j.complete || !canPan && !button.dataset.map?.startsWith('zoom-');
    pause.disabled = j.ready ? !j.canStart : j.complete;
    pause.textContent = j.complete ? 'At studio' : j.ready ? 'Start robot' : j.paused ? 'Resume robot' : 'Pause robot';
    get<HTMLButtonElement>('city-restart').disabled = j.ready;
    get('city-route-controls').hidden = mode !== 'route' || !j.ready;
    get('city-change-controls').hidden = mode !== 'edit' || j.complete;
    get('city-finished').hidden = !j.complete;
    get<HTMLButtonElement>('city-exhibition').disabled = !finished;
    if (j.blocked && j.blocked.id !== lastBlock) { selected = j.blocked.id; mode = 'edit'; plan.scrollTop = 0; streetSelect.value = selected; panelKey = ''; }
    lastBlock = j.blocked?.id ?? null;
    const stops = j.route.map(id => j.world.nodes.find(n => n.id === id)!);
    const discoveries = new Set(stops.filter(n => n.discovery).map(n => n.id)).size;
    get('city-route-stats').hidden = j.ready && mode !== 'route';
    setText('city-route-stats', `${j.route.length - 1} streets · ${Math.round(j.routeLength)} m · ${discoveries} of 6 discoveries`);
    const status = j.complete ? 'You reached the studio. Time for our duet.' : j.ready ? 'Press Start robot. It will head to the flagged Duet studio. Help it through barriers as you go.' : j.blocked ? j.blocked.reason : j.paused ? 'Paused. Change the city, then resume when you’re ready.' : j.waiting ? 'Waiting at the pelican crossing for a green light with enough time to cross safely.' : `Heading to the flagged Duet studio · ${Math.round(j.machine.record.telemetry!.progress * 100)}%`;
    setText('journey-status', status); setText('city-heading', j.complete ? 'You reached the goal!' : j.ready ? mode === 'route' ? 'Choose your own route' : 'Reach the goal' : j.blocked ? 'Help your robot through' : j.paused ? 'Journey paused' : 'Your robot is travelling');
    setText('city-phase', j.complete ? 'WELCOME TO THE DUET STUDIO' : 'GOAL / DUET STUDIO');
    if (j.complete) setText('city-result', `${j.metrics.stepsTaken} steps, ${j.metrics.pickups} discoveries, ${j.repaired.size} city changes. Try another line or generate a different city.`);
    const nextKey = j.route.join('|') + j.ready;
    if (routeKey !== nextKey) {
      routeKey = nextKey;
      const focusWasNext = get('city-next-stops').contains(document.activeElement);
      get('city-next-stops').replaceChildren(...j.nextStops.map(node => {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.nextStop = node.id;
        const street = streetBetween(j.world, j.route.at(-1)!, node.id)!;
        button.textContent = `${node.label}${node.discovery ? ' · discovery' : ''}${street.kind !== 'clear' ? ` · ${streetNames[street.kind].toLowerCase()}` : ''}`;
        button.addEventListener('click', () => { if (j.appendStop(node.id)) { sounds.interaction('tap'); city!.sync(); feedback(''); refresh(); } }); return button;
      }));
      if (focusWasNext) (get('city-next-stops').querySelector<HTMLButtonElement>('button') ?? pause).focus();
      setText('city-next-heading', j.route.at(-1) === j.world.destination ? 'Your line reaches the goal' : `Next stop from ${stops.at(-1)!.label}`);
    }
    get<HTMLButtonElement>('city-route-undo').disabled = j.route.length < 2 || !j.ready;
    get<HTMLButtonElement>('city-route-clear').disabled = j.route.length < 2 || !j.ready;
    const key = `${selected}:${[...j.repaired]}:${j.dimensionRevision}:${j.ready}:${j.paused}:${j.complete}:${j.currentStreet?.id}:${j.distanceOnEdge > 0}`;
    if (panelKey !== key) {
      panelKey = key;
      const street = j.world.streets.find(s => s.id === selected);
      const repaired = !!selected && j.repaired.has(selected);
      const transport = selected === 'transport';
      const dimension = selected && j.dimensions.limits(selected);
      sizeId = dimension ? selected : street ? `${street.kind === 'crossing' ? 'crossing' : 'width'}:${street.id}` : null;
      setText('city-feature-name', dimension ? j.dimensions.name(selected!) : transport ? 'Workshop transport' : street ? streetNames[street.kind] : 'Choose a place on the map');
      setText('city-feature-reason', dimension ? selected!.startsWith('door:') ? 'Widen or narrow the doorway and watch the opening change.' : 'Move this wall to change the building’s shape.' : repaired ? 'Changed. Your robot can use this street.' : transport ? 'Add transport for robots whose drive is disabled.' : street ? j.problem(street) ?? 'This robot can already use this street. You can still improve it for other robots.' : 'Choose a wall, doorway or street to change.');
      get('city-size-controls').hidden = !sizeId;
      if (sizeId) {
        const limits = j.dimensions.limits(sizeId)!;
        sizeInput.min = String(limits.min); sizeInput.max = String(limits.max); sizeInput.step = 'any';
        sizeInput.value = String(city.resizer.value(sizeId)); sizeInput.disabled = !j.canEdit(sizeId);
        setText('city-size-label', sizeId.startsWith('wall:') ? 'Wall position' : sizeId.startsWith('crossing:') ? 'Crossing time' : 'Width');
      }
      const repair = get<HTMLButtonElement>('city-repair');
      repair.hidden = !!dimension;
      repair.textContent = repaired ? 'City changed ✓' : transport ? 'Add transport' : street ? streetActions[street.kind] : 'Choose a place';
      repair.disabled = !selected || repaired || !!street && street.kind === 'clear' || !j.canEdit(selected);
      const cues = get<HTMLButtonElement>('city-crossing-cues');
      cues.hidden = street?.kind !== 'crossing';
      cues.disabled = !street || j.hasCrossingCues(street) || !j.canEdit(`signals:${street.id}`);
      cues.textContent = street && j.hasCrossingCues(street) ? 'Beeper and tactile cues added ✓' : 'Add beeper and tactile cues';
      if (street?.kind === 'crossing' && !j.bot.profile.enabledFunctions.includes('vision') && !j.hasCrossingCues(street)) repair.textContent = 'Add beeper and tactile cues';
      get<HTMLButtonElement>('city-undo').disabled = !j.undoAvailable;
    }
    if (sizeId) setText('city-size-value', `${city.resizer.value(sizeId).toFixed(2)} ${sizeId.startsWith('crossing:') ? 'seconds' : 'm'}`);
    const crossing = j.world.streets.find(s => s.id === selected && s.kind === 'crossing');
    get('city-signal-status').hidden = !crossing;
    if (crossing) setText('city-signal-status', `${j.signal(crossing).green ? 'GREEN · Cross when there is enough time' : 'RED · Wait at the kerb'}. ${j.hasCrossingCues(crossing) ? 'Beeper sounds and tactile cue activates on green.' : 'Visual light only. Add a beeper and tactile cues for robots without eyes.'}`);
    if (!j.ready && !j.complete && !j.paused && j.currentStreet?.kind === 'crossing' && j.hasCrossingCues(j.currentStreet) && j.signal(j.currentStreet).green) sounds.crossingBeep();
    for (const event of j.machine.record.events.slice(eventCursor)) creation?.consume(event);
    eventCursor = j.machine.record.events.length;
    if (creation) {
      updateCityMusic();
      Object.assign(j.machine.run.creative!, { music: creation.music, harmony: creation.harmony, colour: creation.colour });
      const now = performance.now(); renderer?.frame(painting, (now - lastPaint) / 1000, reducedMotion.matches || j.complete); lastPaint = now;
      setText('painting-strokes', `${creation.marks.length} marks`); setText('painting-action', creation.painting.lastAction);
    }
    if (j.complete && creation && !finished && !studioPreparing) {
      studioPreparing = true;
      const currentCreation = creation, currentCity = city;
      const bed = [...creation.score].reverse().find(entry => entry.label?.includes(':city-bed:'));
      if (bed) stopArrivalBed = sounds.loop([{ ...bed, at: 0 }], (creation.artist.musician === 'waltz' ? 3 : 4) * 60 / creation.bpm);
      setText('journey-status', 'At the studio. Adding new verses and harmonies for our duet.');
      void currentCreation.extendStudioMusic().then(() => {
        if (creation !== currentCreation || city !== currentCity) return;
        Object.assign(j.machine.run.creative!, { music: true, harmony: true });
        j.machine.run.creative!.score = pianoSynthScore(currentCreation.score);
        finished = captureFinishedJourney(j.machine.run);
        refresh();
      });
    }
    if (finished && city.arrivalComplete && !studioStarted) {
      studioStarted = true; get('studio-track').hidden = false;
      container.append(get('studio-track'));
      container.dataset.studioPerformance = 'true';
      setText('studio-track-title', `${finished.name} · ${finished.artworkTitle.text}`);
      playTrack();
    }
    if (finished && studioStarted) {
      const duration = musicDuration(finished.score), elapsed = playback?.elapsed() ?? trackElapsed;
      get<HTMLProgressElement>('studio-track-progress').value = duration ? elapsed / duration : 0;
      setText('studio-track-time', `${timestamp(elapsed)} / ${timestamp(duration)}`);
      const origin = finished.score[0]?.at ?? 0;
      const singing = !!playback && finished.score.some(entry => entry.label?.includes('melody') && entry.score.notes.some(note => elapsed >= entry.at - origin + note.start && elapsed < entry.at - origin + note.start + note.duration));
      city.setSinging(singing);
      if (playback && (elapsed >= duration || sounds.isMuted)) {
        stopTrack(false); setText('studio-track-status', sounds.isMuted ? 'Sound is muted. Unmute, then replay your duet.' : 'Your duet has finished. Replay it from the start.');
      }
    }
    const mood = j.complete ? 'celebrating' : j.blocked ? 'sad' : 'curious';
    if (mood !== lastMood) lastMood = mood;
  }
  function newCity() {
    if (!bot || !engine) return;
    pointers.clear(); drawing = false; sounds.stop(); city?.journey.leave(); city?.scene.dispose();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    const world = generateCity(seed, robots.length ? robots : [bot]);
    engine.resize(); city = createCityScene(engine, bot, world); city.setTheme(theme);
    city.onResizeSelected(id => selectStreet(id.startsWith('width:') ? id.slice(6) : id));
    selected = null; mode = 'edit'; lastBlock = null; routeKey = ''; panelKey = ''; lastMood = ''; feedback('');
    streetSelect.replaceChildren();
    const initial = document.createElement('option'); initial.value = ''; initial.textContent = 'Choose a street…'; streetSelect.append(initial);
    const transport = document.createElement('option'); transport.value = 'transport'; transport.textContent = 'Workshop · transport'; streetSelect.append(transport);
    for (const street of world.streets) {
      const a = world.nodes.find(n => n.id === street.a)!, b = world.nodes.find(n => n.id === street.b)!;
      const option = document.createElement('option'); option.value = street.id; option.textContent = `${a.label} → ${b.label} · ${streetNames[street.kind]}`; streetSelect.append(option);
    }
    for (const building of world.buildings) {
      for (const id of [`door:${building.name}`, ...sides.map(side => `wall:${building.name}:${side}`)]) {
        const option = document.createElement('option'); option.value = id; option.textContent = city.journey.dimensions.name(id); streetSelect.append(option);
      }
    }
    setText('city-bot-name', bot.name); setText('city-seed', `2 / Reach the Duet studio`);
    plan.scrollTop = 0; beginCreation(); refresh();
  }
  get('studio-track-play').addEventListener('click', playTrack);
  get('studio-track-stop').addEventListener('click', () => { stopTrack(); setText('studio-track-status', 'Track stopped. Replay from the beginning when you’re ready.'); });
  get('city-tool-route').addEventListener('click', () => setMode('route'));
  get('city-tool-edit').addEventListener('click', () => setMode('edit'));
  streetSelect.addEventListener('change', () => { city?.resizer.finish(false); selectStreet(streetSelect.value); });
  sizeInput.addEventListener('input', () => { if (city && sizeId) { city.resizer.previewSize(sizeId, Number(sizeInput.value)); refresh(); } });
  sizeInput.addEventListener('change', () => { city?.resizer.finish(); sounds.interaction('tap'); panelKey = ''; refresh(); });
  pause.addEventListener('click', () => { if (!city) return; if (city.journey.ready) { if (city.journey.start()) mode = 'edit'; } else city.journey.setPaused(!city.journey.paused); refresh(); });
  get('city-route-undo').addEventListener('click', () => { city?.journey.undoStop(); city?.sync(); feedback(''); refresh(); });
  get('city-route-clear').addEventListener('click', () => { city?.journey.clearRoute(); city?.sync(); feedback(''); refresh(); });
  get('city-repair').addEventListener('click', () => { if (selected && city?.journey.repair(selected)) { city.sync(); feedback(city.journey.paused ? 'City changed. Resume when you’re ready.' : city.journey.ready ? 'City changed. Start whenever you’re ready.' : 'City changed. Your robot can continue.'); refresh(); } });
  get('city-crossing-cues').addEventListener('click', () => { if (selected && city?.journey.repair(`signals:${selected}`)) { city.sync(); feedback('Beeper and tactile cues added. They signal when the pedestrian light is green.'); refresh(); } });
  get('city-undo').addEventListener('click', () => { if (city?.journey.undoRepair()) { city.sync(); feedback('City change undone.'); refresh(); } });
  get('city-restart').addEventListener('click', () => { if (!city) return; sounds.stop(); city.journey.restart(); city.journey.clearRoute(); beginCreation(); plan.scrollTop = 0; selected = null; mode = 'route'; routeKey = ''; panelKey = ''; lastBlock = null; city.sync(); feedback('City changes kept. Draw a different line.'); refresh(); });
  get('city-new').addEventListener('click', newCity);
  container.querySelector('.city-view-tools')!.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-view]') : null;
    if (!button || button.disabled || !city) return;
    city.resizer.finish(false); city.setView(button.dataset.view as CityView);
    refresh();
  });
  get('city-map-fit').addEventListener('click', () => { city?.fit(); refresh(); });
  container.querySelector('.city-map-buttons')!.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-map]') : null;
    if (!button || button.disabled || !city) return;
    const action = button.dataset.map;
    if (action === 'zoom-in' || action === 'zoom-out') city.setZoom(action === 'zoom-in' ? .8 : 1.25);
    else {
      const camera = city.scene.activeCamera!;
      const step = (camera.orthoRight! - camera.orthoLeft!) * .15;
      city.pan(action === 'left' ? -step : action === 'right' ? step : 0, action === 'up' ? step : action === 'down' ? -step : 0);
    }
  });
  get('city-exhibition').addEventListener('click', () => { if (finished) onPresent(structuredClone(finished)); });
  const pointers = new Map<number, { x: number; y: number }>();
  let drawing = false, moved = false, origin = { x: 0, y: 0 }, savedRoute: readonly string[] = [], pinch = 0;
  function local(x: number, y: number) { const bounds = canvas.getBoundingClientRect(); return { x: x - bounds.left, y: y - bounds.top }; }
  function drawAt(x: number, y: number) {
    if (!city?.journey.ready) return;
    const p = local(x, y), id = city.nodeAt(p.x, p.y), route = city.journey.route;
    if (!id || id === route.at(-1)) return;
    if (id === route.at(-2)) city.journey.undoStop();
    else if (!city.journey.appendStop(id)) { feedback('Use a connected junction. The line must stay on the streets.'); return; }
    city.sync(); feedback(''); refresh();
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !city || city.journey.complete) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); canvas.setPointerCapture(event.pointerId);
    if (pointers.size > 1) { city.resizer.finish(false); if (drawing) city.journey.setRoute(savedRoute); drawing = false; city.sync(); pinch = 0; moved = true; refresh(); return; }
    origin = { x: event.clientX, y: event.clientY }; moved = false; savedRoute = [...city.journey.route];
    const p = local(event.clientX, event.clientY), id = city.nodeAt(p.x, p.y);
    if (mode === 'edit' && city.resizer.begin(p.x, p.y)) return;
    drawing = mode === 'route' && city.journey.ready && !!id;
    if (drawing) drawAt(event.clientX, event.clientY);
  });
  canvas.addEventListener('pointermove', event => {
    if (!city || !engine || city.journey.complete) return;
    const previous = pointers.get(event.pointerId), p = local(event.clientX, event.clientY);
    if (!previous) {
      const target = mode === 'edit' ? city.resizer.inspect(p.x, p.y) : null;
      if (target) {
        get('city-hover').hidden = false; setText('city-hover', `${city.journey.dimensions.name(target.id)} · drag to resize`);
        city.highlight(target.id); canvas.style.cursor = target.available ? 'ew-resize' : 'not-allowed'; return;
      }
      const id = mode === 'edit' ? city.streetAt(p.x, p.y) : city.nodeAt(p.x, p.y);
      const street = city.journey.world.streets.find(s => s.id === id), node = city.journey.world.nodes.find(n => n.id === id);
      get('city-hover').hidden = !id;
      if (id) setText('city-hover', street ? `${streetNames[street.kind]} · tap to change` : `${node!.label} · draw through this junction`);
      if (mode === 'edit') city.highlight(id ?? null); canvas.style.cursor = id ? 'pointer' : 'grab'; return;
    }
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 8) moved = true;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a!.x - b!.x, a!.y - b!.y); if (pinch > 0 && d > 0) city.setZoom(pinch / d); pinch = d; return; }
    if (city.resizer.active) { city.resizer.move(p.x, p.y); refresh(); return; }
    if (drawing) { const steps = Math.ceil(Math.hypot(event.clientX - previous.x, event.clientY - previous.y) / 8); for (let i = 1; i <= steps; i++) drawAt(previous.x + (event.clientX - previous.x) * i / steps, previous.y + (event.clientY - previous.y) * i / steps); }
    else if (moved) { const camera = city.scene.activeCamera!; const width = camera.orthoRight! - camera.orthoLeft!; city.pan(-(event.clientX - previous.x) / canvas.clientWidth * width, (event.clientY - previous.y) / canvas.clientWidth * width); }
  });
  function release(event: PointerEvent) {
    if (!pointers.has(event.pointerId)) return;
    if (city?.resizer.active) { city.resizer.finish(event.type === 'pointerup'); panelKey = ''; refresh(); }
    else if (event.type !== 'pointerup' && drawing) { city?.journey.setRoute(savedRoute); city?.sync(); refresh(); }
    else if (mode === 'edit' && !moved && city) { const p = local(event.clientX, event.clientY); const id = city.streetAt(p.x, p.y); if (id) selectStreet(id); }
    drawing = false; pointers.delete(event.pointerId); pinch = 0;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }
  canvas.addEventListener('pointerup', release); canvas.addEventListener('pointercancel', release); canvas.addEventListener('lostpointercapture', release);
  canvas.addEventListener('pointerleave', () => { if (!drawing) { city?.highlight(selected); get('city-hover').hidden = true; } });
  canvas.addEventListener('wheel', event => { event.preventDefault(); city?.setZoom(event.deltaY > 0 ? 1.1 : .9); }, { passive: false });
  function escape(event: KeyboardEvent) {
    if (event.key !== 'Escape') return;
    if (city?.resizer.active) { city.resizer.finish(false); pointers.clear(); feedback('Resize cancelled.'); refresh(); }
    if (drawing) { city?.journey.setRoute(savedRoute); city?.sync(); drawing = false; pointers.clear(); feedback('Line drawing cancelled.'); refresh(); }
  }
  window.addEventListener('keydown', escape);
  function visibilityChanged() {
    lastMusicFrame = performance.now();
    if (document.hidden && playback) { stopTrack(false); setText('studio-track-status', 'Track stopped while you were away. Replay when you return.'); }
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  const observer = new ResizeObserver(() => { if (active) { engine?.resize(); city?.resize(); } }); observer.observe(canvas);
  return {
    setTheme(value: Theme) { theme = value; city?.setTheme(value); },
    showInstructions() { /* Instructions stay beside the map; no blocking tutorial. */ },
    suspend() { stopTrack(); active = false; sounds.stop(); speech?.stop(); city?.resizer.finish(false); if (drawing) { city?.journey.setRoute(savedRoute); city?.sync(); } pointers.clear(); drawing = false; },
    resume() { active = true; lastMusicFrame = performance.now(); engine?.resize(); city?.resize(); refresh(); },
    enter(value: ArtBot, remembered: readonly ArtBot[] = [value]) {
      bot = value; robots = remembered; active = true; sounds.unlock();
      if (!engine) { engine = new Engine(canvas, true); engine.runRenderLoop(() => { if (!active || !city || document.hidden) return; city.update(Math.min(.1, engine!.getDeltaTime() / 1000)); refresh(); city.scene.render(); }); }
      newCity();
    },
    dispose() { stopTrack(); active = false; window.clearInterval(musicTimer); observer.disconnect(); window.removeEventListener('keydown', escape); document.removeEventListener('visibilitychange', visibilityChanged); renderer?.dispose(); city?.journey.leave(); city?.scene.dispose(); engine?.dispose(); },
  };
}
