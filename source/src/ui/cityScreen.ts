import { reducedMotionPreference } from '../app/accessibilityPreferences';
import { mountRobotConditionHud } from './robotConditionHud';
import { Engine } from '@babylonjs/core/Engines/engine';
import { createCityScene } from '../city/createCityScene';
import type { CityView } from '../city/cityCamera';
import { sides } from '../city/cityDimensions';
import { generateCity, streetActions, streetNames, streetBetween } from '../city/proceduralCity';
import type { StudioDoorType } from '../city/proceduralCity';
import type { Theme } from '../app/theme';
import type { ArtBot } from '../robot/botHistory';
import type { CitySounds } from '../audio/CitySounds';
import type { ScreenSpeech } from '../audio/ScreenSpeech';
import { JourneyCreativity } from '../art/JourneyCreativity';
import { AsyncPaintingRenderer } from '../art/AsyncPaintingRenderer';
import { captureFinishedJourney } from '../art/finishedJourney';
import type { FinishedJourney } from '../art/finishedJourney';
import { pianoSynthScore } from '../audio/pianoSynth';
import { environmentChoiceCards, studioDoorChoiceCards } from './environmentChoices';
import type { EnvironmentChoiceKind } from './environmentChoices';
import { mountCityVoicePanel } from './cityVoicePanel';
import { interpretCityReply, applyCityReply } from './cityReply';

export function mountCityScreen(container: HTMLElement, sounds: CitySounds, onPresent: (journey: FinishedJourney) => void, speech?: ScreenSpeech) {
  container.innerHTML = `
    <h1 class="sr-only">Get your ArtBot to the studio</h1>
    <header class="city-toolbar">
      <div class="city-tools" role="group" aria-label="City tools">
        <button id="city-tool-route" type="button" aria-pressed="false">Draw route</button>
        <button id="city-tool-edit" type="button" aria-pressed="true">Change city</button>
        <button id="city-pause" type="button">Start robot</button>
      </div>
      <button id="city-exhibition" type="button" hidden disabled>Watch performance</button>
      <button id="back-to-designer" type="button">Edit robot</button>
    </header>
    <div class="city-map">
      <canvas id="city-canvas" role="img" aria-label="Your robot starts at the Workshop. Its goal is the Duet studio, marked by a large finish flag. Start the robot and change the city when a barrier blocks its journey."></canvas>
      <div id="city-robot-name" class="city-robot-name" hidden></div>
      <div id="city-goal" class="city-goal-marker"><strong>⚑ GOAL</strong><span>Duet studio</span><small>Use Show goal</small></div>
      <p id="city-hover" class="city-hover" hidden></p>
    </div>
    <details class="city-controls-hud" id="city-controls-hud"><summary>City controls <span class="disclosure-chevron" aria-hidden="true">&#8964;</span></summary>
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
      <section id="city-reply" class="city-reply" aria-label="Reply to your robot"></section>
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
        <div id="city-environment-choices" hidden></div>
        <div id="city-signal-choices" hidden></div>
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
      <p id="city-garage-status" role="status" aria-live="polite"></p>
      <div id="city-finished" hidden><p id="city-result"></p></div>
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
    </aside></details>`;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!;
  const canvas = get<HTMLCanvasElement>('city-canvas'), painting = get<HTMLCanvasElement>('journey-art');
  const plan = container.querySelector<HTMLElement>('.city-plan')!;
  const updateRobotConditions = mountRobotConditionHud(plan);
  plan.querySelector('.city-route-stats')!.after(plan.querySelector('.city-robot-states')!);
  const controlsHud = get<HTMLDetailsElement>('city-controls-hud');
  const map = container.querySelector<HTMLElement>('.city-map')!;
  map.append(container.querySelector('.city-view-tools')!);
  for (const button of container.querySelectorAll<HTMLButtonElement>('.city-toolbar button, .city-view-tools button')) {
    button.setAttribute('aria-label', button.textContent!); button.title = button.textContent!;
  }
  const statusHud = document.createElement('div'); statusHud.className = 'city-status-hud';
  statusHud.innerHTML = '<p id="city-hud-status" role="status" aria-live="polite"></p>'; map.append(statusHud);
  const pause = get<HTMLButtonElement>('city-pause'), streetSelect = get<HTMLSelectElement>('city-street');
  const sizeInput = get<HTMLInputElement>('city-size');
  let sizeId: string | null = null;
  let engine: Engine | null = null, city: ReturnType<typeof createCityScene> | null = null;
  let active = false, theme: Theme = 'dark', bot: ArtBot | null = null, robots: readonly ArtBot[] = [];
  let mode: 'route' | 'edit' = 'edit', selected: string | null = null, lastBlock: string | null = null;
  let creation: JourneyCreativity | null = null, renderer: AsyncPaintingRenderer | null = null;
  let eventCursor = 0, lastPaint = performance.now(), routeKey = '', panelKey = '', lastMood = '';
  let finished: FinishedJourney | null = null;
  let performancePresented = false, studioPreparing = false;
  let cityMusicTime = 0, lastMusicFrame = performance.now();
  let stopArrivalBed: (() => void) | undefined;
  function stopArrivalMusic() {
    stopArrivalBed?.(); stopArrivalBed = undefined;
  }
  const reducedMotion = reducedMotionPreference();
  const setText = (id: string, value: string) => { if (get(id).textContent !== value) get(id).textContent = value; };
  function feedback(text: string) { setText('city-feedback', text); }
  const voicePanel = mountCityVoicePanel(get('city-reply'), {
    context: () => city ? `${city.journey.machine.run.id}:${city.journey.edge}:${city.journey.blocked?.id ?? ''}:${city.journey.dimensionRevision}:${[...city.journey.repaired]}:${city.journey.complete}` : '',
    capture: value => { if (value) speech?.stop(); sounds.setVoiceCapture(value); },
    submit: text => {
      if (!city || !active) return 'Open the city to reply to your robot.';
      city.resizer.finish(false);
      const message = applyCityReply(city.journey, interpretCityReply(text, city.journey));
      city.sync(); panelKey = ''; feedback(message); refresh(); speech?.say(message); return message;
    },
  });
  function beginCreation() {
    if (!city) return;
    stopArrivalMusic(); finished = null; performancePresented = false; studioPreparing = false;
    renderer?.dispose(); creation = new JourneyCreativity(city.journey.bot); renderer = new AsyncPaintingRenderer(creation.painting);
    cityMusicTime = 0; lastMusicFrame = performance.now();
    city.journey.machine.run.creative = { seed: creation.seed, bpm: creation.bpm, music: creation.music, art: true, harmony: false, colour: false, artist: structuredClone(creation.artist), score: creation.score, marks: creation.marks };
    eventCursor = city.journey.machine.record.events.length; lastPaint = performance.now();
  }
  function setMode(value: typeof mode) {
    if (!city) return;
    if (value === 'route' && !city.journey.ready) return;
    city.resizer.finish(false); controlsHud.open = true; mode = value; plan.scrollTop = 0; city.highlight(null); get('city-hover').hidden = true; panelKey = ''; refresh();
  }
  function selectStreet(id: string) {
    if (!city) return;
    selected = id; controlsHud.open = true;
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
    voicePanel.update();
    updateRobotConditions(city.robotConditions);
    const j = city.journey;
    const bikes = j.world.bicycles ?? [];
    setText('city-garage-status', `Bicycle garage · ${bikes.filter(bike => j.repaired.has(bike.id)).length} / ${bikes.length} bikes stored. Move blocking bicycles here to clear pavements and roads.`);
    container.dataset.journeyState = j.complete ? 'complete' : j.blocked ? 'blocked' : j.ready ? 'ready' : j.paused ? 'paused' : j.waiting ? 'waiting' : 'travelling';
    const nameTag = get('city-robot-name'), robotBounds = city.projectRobotBounds();
    // A screen-space billboard faces the camera even in the overhead view.
    // Leave space above the complete animated silhouette, including its antenna.
    nameTag.hidden = !robotBounds || robotBounds.right < 0 || robotBounds.left > canvas.clientWidth || robotBounds.bottom < 0 || robotBounds.top > canvas.clientHeight;
    if (!nameTag.hidden && robotBounds) {
      const halfWidth = nameTag.offsetWidth / 2;
      const x = Math.max(halfWidth + 8, Math.min(canvas.clientWidth - halfWidth - 8, (robotBounds.left + robotBounds.right) / 2));
      const bottom = robotBounds.top - 18;
      nameTag.style.left = `${x}px`; nameTag.style.top = `${bottom}px`;
      nameTag.style.setProperty('--robot-pointer-offset', `${Math.max(-halfWidth + 10, Math.min(halfWidth - 10, (robotBounds.left + robotBounds.right) / 2 - x))}px`);
      // Never clamp down onto the robot when it approaches the top edge.
      nameTag.hidden = bottom < nameTag.offsetHeight + 8;
    }
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
    if (pause.getAttribute('aria-label') !== pause.textContent) { pause.setAttribute('aria-label', pause.textContent!); pause.title = pause.textContent!; }
    get<HTMLButtonElement>('city-restart').disabled = j.ready;
    get('city-route-controls').hidden = mode !== 'route' || !j.ready;
    get('city-change-controls').hidden = mode !== 'edit' || j.complete;
    get('city-finished').hidden = !j.complete;
    get('city-exhibition').hidden = !j.complete;
    get<HTMLButtonElement>('city-exhibition').disabled = !finished || !city.arrivalComplete;
    if (j.blocked && j.blocked.id !== lastBlock) { controlsHud.open = true; selected = j.blocked.id; mode = 'edit'; plan.scrollTop = 0; streetSelect.value = selected; panelKey = ''; }
    lastBlock = j.blocked?.id ?? null;
    const stops = j.route.map(id => j.world.nodes.find(n => n.id === id)!);
    const discoveries = new Set(stops.filter(n => n.discovery).map(n => n.id)).size;
    get('city-route-stats').hidden = j.ready && mode !== 'route';
    setText('city-route-stats', `${j.route.length - 1} streets · ${Math.round(j.routeLength)} m · ${discoveries} of 6 discoveries`);
    setText('city-hud-status', j.complete ? 'At studio' : j.ready ? 'Ready' : j.blocked ? 'Blocked' : j.paused ? 'Paused' : j.trainStatus ? j.trainStatus : j.waiting ? 'Waiting to cross' : `Travelling · ${Math.round(j.machine.record.telemetry!.progress * 100)}%`);
    const status = j.complete ? 'You reached the studio. Time for our duet.' : j.ready ? 'Press Start robot. It will head to the flagged Duet studio. Help it through barriers as you go.' : j.blocked ? j.blocked.reason : j.paused ? 'Paused. Change the city, then resume when you’re ready.' : j.trainStatus ? j.trainStatus : j.waiting ? 'Waiting at the pelican crossing for a green light with enough time to cross safely.' : `Heading to the flagged Duet studio · ${Math.round(j.machine.record.telemetry!.progress * 100)}%`;
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
      const bicycle = j.world.bicycles?.find(bike => bike.id === selected);
      const communication = selected === 'communication';
      const studio = selected === 'studio-entrance' || selected === 'studio:width';
      const dimension = selected && j.dimensions.limits(selected);
      sizeId = studio ? 'studio:width' : dimension ? selected : street ? `${street.kind === 'crossing' ? j.reachProblem(street) ? 'panel' : 'crossing' : 'width'}:${street.id}` : null;
      setText('city-feature-name', bicycle ? `Bicycle on ${bicycle.location}` : studio ? 'Duet studio entrance' : dimension ? j.dimensions.name(selected!) : communication ? 'Workshop communication board board' : street ? streetNames[street.kind] : 'Choose a place on the map');
      setText('city-feature-reason', bicycle ? repaired ? 'Stored in the bicycle garage. The route is clear of this bike.' : `This bicycle blocks the ${bicycle.location}. Move it into the garage to let the robot pass.` : studio ? j.entranceProblem ?? 'The robot can enter through this door. Try different doors and widths.' : dimension ? selected!.startsWith('panel:') ? 'Lower the button panel so robots with shorter reach can press it to request a green light.' : selected!.startsWith('door:') ? 'Widen or narrow the doorway and watch the opening change.' : 'Move this wall to change the building’s shape.' : repaired ? 'Changed. Your robot can use this street.' : communication ? 'Add a symbol board so robots can share messages and request help.' : street ? j.problem(street) ?? 'This robot can already use this street. You can still improve it for other robots.' : 'Choose a wall, doorway or street to change.');
      get('city-size-controls').hidden = !sizeId;
      if (sizeId) {
        const limits = j.dimensions.limits(sizeId)!;
        sizeInput.min = String(limits.min); sizeInput.max = String(limits.max); sizeInput.step = 'any';
        sizeInput.value = String(city.resizer.value(sizeId)); sizeInput.disabled = !j.canEdit(sizeId);
        setText('city-size-label', sizeId.startsWith('panel:') ? 'Button panel height' : sizeId.startsWith('wall:') ? 'Wall position' : sizeId.startsWith('crossing:') ? 'Crossing time' : 'Width');
      }
      const repair = get<HTMLButtonElement>('city-repair');
      const choiceKind = communication ? 'communication' : street && ['curb', 'stairs', 'bridge', 'guidance'].includes(street.kind) ? street.kind as EnvironmentChoiceKind : null;
      const choices = get('city-environment-choices'), signalChoices = get('city-signal-choices');
      const focusedDoor = document.activeElement instanceof HTMLElement ? document.activeElement.dataset.studioDoor : undefined;
      const focusedChoice = container.contains(document.activeElement) ? document.activeElement?.closest<HTMLButtonElement>('[data-environment-value]') : null;
      const focusedGroup = focusedChoice?.closest('div[id]')?.id;
      const focusedValue = focusedChoice?.dataset.environmentValue;
      choices.hidden = !choiceKind && !studio;
      choices.innerHTML = studio ? studioDoorChoiceCards(j.world.studioEntrance!.doorType, !j.canEdit('studio:type')) : choiceKind ? environmentChoiceCards(choiceKind, repaired, !j.canEdit(selected!)) : '';
      if (focusedDoor) choices.querySelector<HTMLButtonElement>(`[data-studio-door="${focusedDoor}"]`)?.focus({ preventScroll: true });
      signalChoices.hidden = street?.kind !== 'crossing';
      signalChoices.innerHTML = street?.kind === 'crossing' ? `<h4>Crossing cues</h4>${environmentChoiceCards('signals', j.hasCrossingCues(street), !j.canEdit(`signals:${street.id}`))}` : '';
      if (focusedGroup && focusedValue) get(focusedGroup).querySelector<HTMLButtonElement>(`[data-environment-value="${focusedValue}"]`)?.focus({ preventScroll: true });
      repair.hidden = studio || !!dimension || !!choiceKind;
      repair.textContent = bicycle ? repaired ? 'Bicycle stored ✓' : 'Move into bicycle garage' : repaired ? 'City changed ✓' : communication ? 'Add communication board' : street ? streetActions[street.kind] : 'Choose a place';
      repair.disabled = !selected || repaired || !!street && street.kind === 'clear' || !j.canEdit(selected);
      const cues = get<HTMLButtonElement>('city-crossing-cues');
      cues.hidden = true;
      cues.disabled = !street || j.hasCrossingCues(street) || !j.canEdit(`signals:${street.id}`);
      cues.textContent = street && j.hasCrossingCues(street) ? 'Beeper and tactile cues added ✓' : 'Add beeper and tactile cues';
      if (street?.kind === 'crossing' && !j.bot.profile.enabledFunctions.includes('vision') && !j.hasCrossingCues(street)) repair.hidden = true;
      if (street?.kind === 'crossing' && j.reachProblem(street)) { repair.hidden = false; repair.textContent = 'Lower button panel'; }
      get<HTMLButtonElement>('city-undo').disabled = !j.undoAvailable;
    }
    if (sizeId) setText('city-size-value', `${city.resizer.value(sizeId).toFixed(2)} ${sizeId.startsWith('crossing:') ? 'seconds' : 'm'}`);
    const crossing = j.world.streets.find(s => s.id === selected && s.kind === 'crossing');
    get('city-signal-status').hidden = !crossing;
    if (crossing) setText('city-signal-status', `${j.signal(crossing).green ? 'GREEN · Cross when there is enough time' : 'RED · Wait at the kerb'}. ${j.hasRequestedCrossing(crossing) ? 'Button pressed · crossing requested.' : 'Press the button to request a crossing.'} ${j.hasCrossingCues(crossing) ? 'Beeper sounds and tactile cue activates on green.' : 'Visual light only. Add a beeper and tactile cues for robots without eyes.'}`);
    if (!j.ready && !j.complete && !j.paused && j.currentStreet?.kind === 'crossing' && j.hasCrossingCues(j.currentStreet) && j.signal(j.currentStreet).green) sounds.crossingBeep();
    for (const event of j.machine.record.events.slice(eventCursor)) {
      creation?.consume(event);
      if (event.type === 'collision') sounds.collision(Number(event.data.speed), String(event.data.kind));
    }
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
    if (finished && city.arrivalComplete && !performancePresented && active && !container.closest('[inert]')) {
      performancePresented = true;
      stopArrivalMusic();
      onPresent(structuredClone(finished));
    }
    const mood = j.complete ? 'celebrating' : j.blocked ? 'sad' : 'curious';
    if (mood !== lastMood) lastMood = mood;
  }
  function newCity() {
    voicePanel.stop();
    if (!bot || !engine) return;
    pointers.clear(); drawing = false; sounds.stop(); city?.journey.leave(); city?.scene.dispose();
    const seed = crypto.getRandomValues(new Uint32Array(1))[0]!;
    const world = generateCity(seed, robots.length ? robots : [bot]);
    engine.resize(); city = createCityScene(engine, bot, world); city.setTheme(theme);
    city.onResizeSelected(id => selectStreet(id.startsWith('width:') ? id.slice(6) : id));
    selected = null; mode = 'edit'; lastBlock = null; routeKey = ''; panelKey = ''; lastMood = ''; feedback('');
    streetSelect.replaceChildren();
    const initial = document.createElement('option'); initial.value = ''; initial.textContent = 'Choose a street…'; streetSelect.append(initial);
    const entrance = document.createElement('option'); entrance.value = 'studio-entrance'; entrance.textContent = 'Duet studio · Entrance door'; streetSelect.append(entrance);
    const communication = document.createElement('option'); communication.value = 'communication'; communication.textContent = 'Workshop · communication board'; streetSelect.append(communication);
    for (const street of world.streets) {
      const a = world.nodes.find(n => n.id === street.a)!, b = world.nodes.find(n => n.id === street.b)!;
      const option = document.createElement('option'); option.value = street.id; option.textContent = `${a.label} → ${b.label} · ${streetNames[street.kind]}`; streetSelect.append(option);
      if (street.kind === 'crossing') {
        const panel = document.createElement('option'); panel.value = `panel:${street.id}`; panel.textContent = `${a.label} → ${b.label} · Button panel height`; streetSelect.append(panel);
      }
    }
    for (const bike of world.bicycles ?? []) {
      const option = document.createElement('option'); option.value = bike.id; option.textContent = `Bicycle ${bike.id.slice(8)} · ${bike.location}`; streetSelect.append(option);
    }
    for (const building of world.buildings) {
      for (const id of [`door:${building.name}`, ...sides.map(side => `wall:${building.name}:${side}`)]) {
        const option = document.createElement('option'); option.value = id; option.textContent = city.journey.dimensions.name(id); streetSelect.append(option);
      }
    }
    setText('city-robot-name', bot.name); controlsHud.open = false;
    plan.scrollTop = 0; beginCreation(); refresh();
  }
  get('city-tool-route').addEventListener('click', () => setMode('route'));
  get('city-tool-edit').addEventListener('click', () => setMode('edit'));
  streetSelect.addEventListener('change', () => { city?.resizer.finish(false); selectStreet(streetSelect.value); });
  sizeInput.addEventListener('input', () => { if (city && sizeId) { city.resizer.previewSize(sizeId, Number(sizeInput.value)); refresh(); } });
  sizeInput.addEventListener('change', () => { city?.resizer.finish(); sounds.interaction('tap'); panelKey = ''; refresh(); });
  pause.addEventListener('click', () => { if (!city) return; if (city.journey.ready) { if (city.journey.start()) mode = 'edit'; } else city.journey.setPaused(!city.journey.paused); refresh(); });
  get('city-route-undo').addEventListener('click', () => { city?.journey.undoStop(); city?.sync(); feedback(''); refresh(); });
  get('city-route-clear').addEventListener('click', () => { city?.journey.clearRoute(); city?.sync(); feedback(''); refresh(); });
  get('city-repair').addEventListener('click', () => { if (selected && city?.journey.repair(selected)) { city.sync(); feedback(city.journey.paused ? 'City changed. Resume when you’re ready.' : city.journey.ready ? 'City changed. Start whenever you’re ready.' : 'City changed. Your robot can continue.'); refresh(); } });
  get('city-environment-choices').addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-studio-door]') : null;
    if (button && !button.disabled && city?.journey.setStudioDoor(button.dataset.studioDoor as StudioDoorType)) { city.sync(); feedback('Studio door changed. Undo lets you try another door.'); refresh(); }
  });
  for (const group of ['city-environment-choices', 'city-signal-choices']) get(group).addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-environment-value]') : null;
    if (!button || button.disabled || !selected || !city) return;
    const id = group === 'city-signal-choices' ? `signals:${selected}` : selected;
    if (city.journey.setFeature(id, button.dataset.environmentValue === 'true')) {
      city.sync(); feedback('City setting updated. Undo lets you change your mind.'); refresh();
    }
  });
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
  get('city-exhibition').addEventListener('click', () => { if (finished && city?.arrivalComplete) { performancePresented = true; onPresent(structuredClone(finished)); } });
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
      if (id) setText('city-hover', city.journey.world.bicycles?.some(bike => bike.id === id) ? 'Bicycle · tap to move into garage' : id === 'studio-entrance' ? 'Studio entrance · tap to change' : street ? `${streetNames[street.kind]} · tap to change` : `${node!.label} · draw through this junction`);
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
    if (document.hidden) voicePanel.stop();
    lastMusicFrame = performance.now();
    if (document.hidden) stopArrivalMusic();
  }
  document.addEventListener('visibilitychange', visibilityChanged);
  const observer = new ResizeObserver(() => { if (active) { engine?.resize(); city?.resize(); } }); observer.observe(canvas);
  return {
    setTheme(value: Theme) { theme = value; city?.setTheme(value); },
    showInstructions() { /* Instructions stay beside the map; no blocking tutorial. */ },
    suspend() { voicePanel.stop(); stopArrivalMusic(); active = false; sounds.stop(); speech?.stop(); city?.resizer.finish(false); if (drawing) { city?.journey.setRoute(savedRoute); city?.sync(); } pointers.clear(); drawing = false; },
    resume() { active = true; lastMusicFrame = performance.now(); engine?.resize(); city?.resize(); refresh(); },
    enter(value: ArtBot, remembered: readonly ArtBot[] = [value]) {
      bot = value; robots = remembered; active = true; sounds.unlock();
      if (!engine) { engine = new Engine(canvas, true); engine.runRenderLoop(() => { if (!active || !city || document.hidden) return; city.update(Math.min(.1, engine!.getDeltaTime() / 1000)); refresh(); city.scene.render(); }); }
      newCity();
    },
    dispose() { voicePanel.dispose(); stopArrivalMusic(); active = false; window.clearInterval(musicTimer); observer.disconnect(); window.removeEventListener('keydown', escape); document.removeEventListener('visibilitychange', visibilityChanged); renderer?.dispose(); city?.journey.leave(); city?.scene.dispose(); engine?.dispose(); },
  };
}
