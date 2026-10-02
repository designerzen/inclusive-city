import { Engine } from '@babylonjs/core/Engines/engine';
import { createCityScene } from '../city/createCityScene';
import type { Theme } from '../app/theme';
import type { CityView } from '../city/cityCamera';
import { cityPowerups } from '../city/cityLayout';
import { buildings } from '../city/cityLayout';
import { buildingKey, wallSides, pavementEdges } from '../city/buildingDimensions';
import { resizeLimits } from '../city/cityResizer';
import type { BarrierId, PowerupId } from '../city/cityLayout';
import type { ArtBot } from '../robot/botHistory';
import type { CitySounds } from '../audio/CitySounds';
import type { ScreenSpeech } from '../audio/ScreenSpeech';
import type { RobotMood } from '../audio/soundPresets';
import { JourneyCreativity } from '../art/JourneyCreativity';
import { SoundEffect } from '../audio/SoundEffect';
import { mapIcon } from './mapIcons';
import { AsyncPaintingRenderer } from '../art/AsyncPaintingRenderer';
import { mountCityFeaturePanel } from './cityFeaturePanel';
import { mountCityHud } from './cityHud';
import { describeFeature, featureNames, cityEditName } from '../city/cityDocument';
import type { CityValue, CityEditId } from '../city/cityDocument';
import { captureFinishedJourney } from '../art/finishedJourney';
import type { FinishedJourney } from '../art/finishedJourney';
import { painterStyles, musicianStyles } from '../art/artistStyles';

export function mountCityScreen(container: HTMLElement, onBack: () => void, sounds: CitySounds, onPresent: (journey: FinishedJourney) => void, speech?: ScreenSpeech) {
  container.innerHTML = `
    <h1 class="sr-only">Inclusive city</h1>
    <dialog id="city-instructions" class="city-instructions" aria-labelledby="city-instructions-title" aria-describedby="city-instructions-intro">
      <span class="editor-eyebrow">WELCOME TO YOUR CITY</span>
      <h2 id="city-instructions-title" tabindex="-1">Make room for your robot.</h2>
      <p id="city-instructions-intro">Help your robot reach the gallery by changing the city, while keeping its abilities the same.</p>
      <ol class="city-instruction-steps">
        <li><div><h3>Plan your city</h3><p>Tap a place on the map or choose a city feature. Lower a curb, widen a pavement, add a ramp, or try another improvement. You can undo and redo your edits.</p></div></li>
        <li><div><h3>Start, watch, improve</h3><p>Press <strong>Start journey</strong>. Your robot moves by itself. If it meets a barrier, change that part of the city so it can continue. Pause whenever you need time.</p></div></li>
        <li><div><h3>Explore and create</h3><p>Queue coloured detours to collect music and art sparks. Every step adds to your painting. Reach the gallery to see and hear the finished work.</p></div></li>
      </ol>
      <p class="city-instructions-map">Drag to pan; pinch or scroll to zoom. Camera views and map buttons give you keyboard-friendly alternatives.</p>
      <button id="city-instructions-close" type="button">Let’s explore <span aria-hidden="true">↗</span></button>
    </dialog>
    <div class="city-toolbar"><button id="back-to-designer" type="button">← Designer</button><span id="city-bot-name"></span>
      <button id="city-pause" type="button">Start journey</button><button id="city-restart" type="button">Try again</button></div>
    <div class="city-layout">
    <div class="city-stage">
      <div class="city-viewport">
      <div class="map-camera-hud">
        <div class="map-camera-picker">
          <span id="city-camera-icon" class="camera-fallback-icon" aria-hidden="true">${mapIcon('overhead')}</span>
          <select id="city-camera-view" aria-label="Map camera view" title="Camera view: Overhead">
            <button type="button" data-select-trigger><selectedcontent></selectedcontent></button>
            <option value="overhead">${mapIcon('overhead')}<span class="camera-option-label">Overhead</span></option>
            <option value="angled">${mapIcon('angled')}<span class="camera-option-label">45° angle</span></option>
            <option value="follow">${mapIcon('follow')}<span class="camera-option-label">Follow robot</span></option>
            <option value="robot-eye">${mapIcon('eye')}<span class="camera-option-label">Robot-eye</span></option>
          </select>
        </div>
        <details class="map-key-picker"><summary aria-label="Map key" title="Map key">${mapIcon('legend')}</summary><div class="city-map-key" aria-label="Map key"><span><i class="key-building" aria-hidden="true"></i>Buildings</span><span><i class="key-route" aria-hidden="true"></i>Robot route</span><span><i class="key-feature" aria-hidden="true"></i>Editable places</span><span><i class="key-spark" aria-hidden="true">♫</i>Creative sparks</span></div></details>
      </div>
      <canvas id="city-canvas" role="img" aria-label="City map with named solid buildings, marked roads and zebra crossing, pavements, a river, a bridge with railings, stairs and an elevator. A contrasting route leads from the workshop to the gallery. Rings mark editable places; notes and gems mark creative sparks."></canvas>
      <aside id="journey-art-preview" class="painting-hud" aria-label="Live procedural painting">
        <div class="painting-hud-heading"><h2><span aria-hidden="true">●</span> Live painting</h2><span id="painting-strokes">0 strokes</span></div>
        <div class="artwork-download">
          <canvas id="journey-art" width="800" height="400" role="img" aria-label="A procedural painting grows with every robot step. Barriers add charcoal fractures; discoveries and access improvements add luminous blooms." aria-describedby="painting-action"></canvas>
          <button id="download-live-painting" class="painting-download" type="button" aria-label="Download current painting as PNG">↓ Download painting</button>
        </div>
        <p id="painting-action">Every step leaves paint</p>
      </aside>
      <div class="map-controls" role="group" aria-label="Map controls">
        <div class="map-zoom"><button type="button" data-map="zoom-in" aria-label="Zoom in" title="Zoom in">${mapIcon('plus')}</button><span class="map-control-divider"></span><button type="button" data-map="zoom-out" aria-label="Zoom out" title="Zoom out">${mapIcon('minus')}</button></div>
        <div class="map-pan" role="group" aria-label="Pan and fit map">
        <button type="button" data-map="left" aria-label="Pan left" title="Pan left">${mapIcon('left')}</button><button type="button" data-map="up" aria-label="Pan up" title="Pan up">${mapIcon('up')}</button>
        <button type="button" data-map="fit" aria-label="Fit city in overhead view" title="Fit city · overhead view">${mapIcon('fit')}</button>
        <button type="button" data-map="down" aria-label="Pan down" title="Pan down">${mapIcon('down')}</button><button type="button" data-map="right" aria-label="Pan right" title="Pan right">${mapIcon('right')}</button>
        </div>
      </div>
      </div>
    </div>
    <aside id="city-editor" class="city-editor" aria-label="City feature editor"></aside>
    </div>
    <div class="city-hud"><p id="journey-status" role="status" aria-live="polite">Ready to explore</p>
      <span id="robot-mood" role="status" aria-live="polite">Curious · exploring</span>
      <button id="city-waiting" type="button" hidden>Show waiting feature</button>
    </div>
    <section class="creative-studio" aria-label="Journey creativity">
      <div class="powerup-panel"><h2>Explore & create</h2><p class="creative-hint">Follow the coloured detours. Music and drawing sparks are queued near the workshop; discover upgrades farther into the city.</p>
        <div class="powerup-list">${cityPowerups.map(pickup => `<button id="explore-${pickup.id}" type="button" data-powerup="${pickup.id}" style="--powerup-colour: ${pickup.colour}" title="${pickup.description}"><span aria-hidden="true">${pickup.kind === 'music' || pickup.kind === 'harmony' ? '♫' : '◇'}</span> ${pickup.label}<small data-pickup-status>Explore</small></button>`).join('')}</div>
        <p id="creative-status" role="status" aria-live="polite">Find a spark to unlock a creative mode.</p>
      </div>
    </section>
    <section id="catwalk-presentation" class="catwalk-presentation" hidden aria-labelledby="catwalk-heading">
      <div><p class="catwalk-eyebrow">Final presentation</p><h2 id="catwalk-heading"></h2><p id="catwalk-description"></p><button id="catwalk-replay" type="button">Replay presentation ♫</button><button id="city-exhibition" type="button">View exhibition ↗</button></div>
      <div class="artwork-download">
        <canvas id="catwalk-art" width="960" height="480" role="img" aria-label="The robot’s finished journey artwork, presented on the catwalk."></canvas>
        <button id="download-final-painting" class="painting-download" type="button" aria-label="Download finished painting as PNG">↓ Download painting</button>
      </div>
    </section>
    <p id="painting-download-status" class="sr-only" role="status" aria-live="polite"></p>
  `;
  const hud = mountCityHud(container);
  const canvas = container.querySelector<HTMLCanvasElement>('#city-canvas')!;
  const status = container.querySelector('#journey-status')!;
  const pause = container.querySelector<HTMLButtonElement>('#city-pause')!;
  const instructions = container.querySelector<HTMLDialogElement>('#city-instructions')!;
  let instructionsShown = false;
  container.querySelector('#city-instructions-close')!.addEventListener('click', () => instructions.close());
  instructions.addEventListener('close', () => { if (active && !container.hidden) pause.focus({ preventScroll: true }); });
  let engine: Engine | null = null;
  let city: ReturnType<typeof createCityScene> | null = null;
  let theme: Theme = 'dark';
  let active = false;
  let selected: BarrierId | null = null;
  let lastBlock: BarrierId | null = null;
  let manualSelection = false;
  let autoPaused = false;
  let accumulator = 0;
  let eventCursor = 0;
  let mood: RobotMood = 'curious';
  let creativity: JourneyCreativity | null = null;
  let paintingRenderer: AsyncPaintingRenderer | null = null;
  let lastPaintFrame = performance.now();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let presented = false;
  let exhibitionTimer = 0;
  function clearExhibitionTimer() { window.clearTimeout(exhibitionTimer); exhibitionTimer = 0; }
  function showExhibition() {
    if (!active || !city?.journey.complete) return;
    clearExhibitionTimer();
    onPresent(captureFinishedJourney(city.journey.machine.run));
  }
  const creativeStatus = container.querySelector('#creative-status')!;
  const artCanvas = container.querySelector<HTMLCanvasElement>('#journey-art')!;
  const finalCanvas = container.querySelector<HTMLCanvasElement>('#catwalk-art')!;
  const presentation = container.querySelector<HTMLElement>('#catwalk-presentation')!;
  const downloadButtons = container.querySelectorAll<HTMLButtonElement>('.painting-download');
  const downloadStatus = container.querySelector('#painting-download-status')!;
  async function downloadPainting() {
    if (!creativity || !city || !paintingRenderer) return;
    downloadButtons.forEach(button => { button.disabled = true; });
    try {
      const name = city.journey.bot.name.normalize('NFKC').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().replace(/\s+/g, '-').slice(0, 70) || 'artbot';
      const filename = `${name}-journey-${city.journey.machine.run.id}-painting.png`;
      const blob = await paintingRenderer.exportPNG();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = filename; link.hidden = true;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      downloadStatus.textContent = `PNG ready: ${filename}. Check your downloads.`;
    } catch (error) {
      downloadStatus.textContent = error instanceof Error ? error.message : 'The painting could not be downloaded.';
    } finally { downloadButtons.forEach(button => { button.disabled = false; }); }
  }
  downloadButtons.forEach(button => button.addEventListener('click', () => { void downloadPainting(); }));
  function selectFeature(id: BarrierId) {
    if (!city) return;
    selected = id; manualSelection = true;
    hud.openEditor();
    if (!city.journey.ready && !city.journey.paused && !city.journey.blocked && !city.journey.complete) {
      city.journey.paused = true; autoPaused = true; accumulator = 0; sounds.stop();
    }
    sounds.interaction('tap'); updatePanel();
  }
  function announceEdit(id: CityEditId, prefix = '') {
    if (!city) return;
    city.syncCity();
    editor.announce(`${prefix}${cityEditName(id)} · ${id.startsWith('building:') || id.startsWith('door:') || id.startsWith('pavement:') ? Number(city.journey.city.get(id)).toFixed(2) + ' m' : describeFeature(city.journey.city, id as BarrierId)}.`);
    sounds.interaction('tap'); updatePanel();
  }
  const editor = mountCityFeaturePanel(container.querySelector<HTMLElement>('#city-editor')!, {
    select: selectFeature,
    edit(id: BarrierId, value: CityValue) { if (city?.journey.edit(id, value)) announceEdit(id); },
    undo() { const id = city?.journey.city.undoEdit?.id; if (id && city?.journey.undo()) announceEdit(id, 'Undone. '); },
    redo() { const id = city?.journey.city.redoEdit?.id; if (id && city?.journey.redo()) announceEdit(id, 'Redone. '); },
    done() {
      if (!city) return;
      if (city.journey.complete) container.querySelector<HTMLButtonElement>('#city-restart')!.click();
      else if (city.journey.ready || city.journey.paused) pause.click();
      pause.focus();
    },
  }, speech);
  const reshapePanel = document.createElement('details');
  reshapePanel.className = 'city-reshape';
  reshapePanel.innerHTML = `<summary>Resize places</summary>
    <p>Drag a wall, pavement edge or door frame on the map. Use the 45° view to see front faces.</p>
    <label for="resize-place">Place</label><select id="resize-place"><option value="sidewalk">Narrow pavement</option>${pavementEdges.map(edge => `<option value="pavement:${edge}">Route pavement ${edge + 1}</option>`).join('')}${buildings.map(b => `${wallSides.map(wall => `<option value="${buildingKey(b.name, wall)}">${b.name} · ${wall} wall</option>`).join('')}<option value="door:${b.name}">${b.name} · door frame</option>`).join('')}</select>
    <label for="resize-dimension">Size / wall position</label><input id="resize-dimension" type="range" step="0.1" /><output id="resize-value" for="resize-dimension"></output>`;
  container.querySelector('#city-editor')!.append(reshapePanel);
  const reshapeSelect = reshapePanel.querySelector<HTMLSelectElement>('select')!;
  const reshapeRange = reshapePanel.querySelector<HTMLInputElement>('input')!;
  function refreshResizeControls() {
    if (!city || city.resizer.active) return;
    const id = reshapeSelect.value as CityEditId;
    const { min, max } = resizeLimits(city.journey, id);
    reshapeRange.min = String(min); reshapeRange.max = String(max);
    reshapeRange.step = id.startsWith('door:') ? '0.05' : '0.1';
    reshapeRange.value = String(city.journey.city.get(id));
    reshapeRange.disabled = !city.journey.canEdit(id);
    reshapeRange.setAttribute('aria-label', cityEditName(id));
    reshapePanel.querySelector('output')!.textContent = `${Number(reshapeRange.value).toFixed(2)} m`;
  }
  function selectResize(id: CityEditId) {
    reshapeSelect.value = id;
    manualSelection = true;
    if (!city?.journey.ready && !city?.journey.paused && !city?.journey.complete) {
      city!.journey.paused = true; autoPaused = true; accumulator = 0; sounds.stop();
    }
    // Keep focus and scroll on the canvas during direct manipulation.
    editor.announce(`${cityEditName(id)} selected. Drag to resize.`);
    refreshResizeControls();
  }
  reshapeSelect.addEventListener('change', () => { if (city) selectResize(reshapeSelect.value as CityEditId); });
  let rangeValue: number | null = null;
  reshapeRange.addEventListener('input', () => {
    rangeValue = Number(reshapeRange.value);
    reshapePanel.querySelector('output')!.textContent = `${rangeValue.toFixed(2)} m`;
  });
  reshapeRange.addEventListener('change', () => {
    if (!city || rangeValue === null) return;
    const id = reshapeSelect.value as CityEditId;
    if (city.journey.edit(id, rangeValue)) announceEdit(id);
    rangeValue = null; refreshResizeControls();
  });
  function beginCreation(bot: ArtBot) {
    clearExhibitionTimer();
    paintingRenderer?.dispose();
    creativity = new JourneyCreativity(bot); paintingRenderer = new AsyncPaintingRenderer(creativity.painting); lastPaintFrame = performance.now(); presented = false;
    presentation.hidden = true;
    if (!city) return;
    city.journey.machine.run.creative = { seed: creativity.seed, bpm: creativity.bpm, artist: structuredClone(creativity.artist),
      music: false, art: true, harmony: false, colour: false, score: creativity.score, marks: creativity.marks };
    city.journey.explore('music-seed'); city.journey.explore('art-seed');
  }
  function explore(id: PowerupId) {
    if (!city?.journey.explore(id)) return;
    sounds.button(`explore-${id}`); updatePanel();
  }
  const moodLabel = container.querySelector('#robot-mood')!;
  const moodLabels: Record<RobotMood, string> = {
    curious: 'Curious · exploring', sad: 'Sad · needs access', happy: 'Happy · access improved', celebrating: 'Celebrating · taking the stage',
  };
  function setMood(value: RobotMood) { mood = value; moodLabel.textContent = moodLabels[value]; sounds.mood(value); }
  function updateMapControls() {
    if (!city) return;
    const picker = container.querySelector<HTMLSelectElement>('#city-camera-view')!;
    picker.value = city.view;
    picker.title = `Camera view: ${picker.selectedOptions[0]!.textContent?.trim()}`;
    container.querySelector('#city-camera-icon')!.innerHTML = mapIcon({ overhead: 'overhead', angled: 'angled', follow: 'follow', 'robot-eye': 'eye' }[city.view] as 'overhead' | 'angled' | 'follow' | 'eye');
    container.querySelectorAll<HTMLButtonElement>('[data-map="left"], [data-map="right"], [data-map="up"], [data-map="down"]').forEach(button => {
      button.disabled = !city!.canPan();
    });
  }
  function updatePanel() {
    if (!city) return;
    const journey = city.journey;
    // State changes and achievements also live in the machine's complete event stream.
    for (const event of journey.machine.record.events.slice(eventCursor).filter(event => event.runId === journey.machine.run.id)) {
      if (!journey.ready) creativity?.consume(event);
      if (event.type === 'blocked') setMood('sad');
      else if (event.type === 'intervention' || event.type === 'pickup') setMood('happy');
      else if (event.type === 'arrived') { sounds.stop(); setMood('celebrating'); }
    }
    eventCursor = journey.machine.record.events.length;
    moodLabel.textContent = journey.ready ? 'Curious · ready to explore' : journey.paused ? `Resting · ${moodLabels[mood].split(' · ')[0].toLowerCase()}` : moodLabels[mood];
    const exploring = cityPowerups.find(item => item.id === journey.exploring);
    const text = journey.ready ? 'Plan your city, then start the journey' : journey.complete ? 'Presenting on the catwalk' : journey.paused ? 'Paused · take your time' : journey.blocked ? `Waiting · ${featureNames[journey.blocked.id]}` : exploring ? `Exploring · ${exploring.label}` : 'Following route';
    if (status.textContent !== text) status.textContent = text;
    pause.textContent = journey.ready ? 'Start journey' : journey.paused ? 'Resume journey' : 'Pause';
    pause.disabled = journey.complete;
    container.querySelector<HTMLButtonElement>('#city-restart')!.disabled = journey.ready;
    if (journey.blocked && journey.blocked.id !== lastBlock && (!manualSelection || !selected)
      && !container.querySelector('#city-editor')!.contains(document.activeElement)) selected = journey.blocked.id;
    if (journey.blocked?.id === 'stairs' && lastBlock !== 'stairs') {
      selected = 'stairs'; hud.openEditor();
    }
    lastBlock = journey.blocked?.id ?? null;
    const waiting = container.querySelector<HTMLButtonElement>('#city-waiting')!;
    waiting.hidden = !journey.blocked || journey.blocked.id === selected;
    if (journey.blocked) waiting.textContent = `Show ${featureNames[journey.blocked.id].toLowerCase()}`;
    editor.render(journey, selected, autoPaused);
    if (document.activeElement !== reshapeRange) refreshResizeControls();
    city.highlightFeature(selected);
    container.querySelectorAll<HTMLButtonElement>('[data-powerup]').forEach(button => {
      const id = button.dataset.powerup as PowerupId;
      const collected = journey.machine.run.pickups.some(item => item.id === id);
      const queued = journey.plannedPowerups.has(id);
      const available = journey.canExplore(id);
      button.disabled = collected || queued || !available;
      const text = collected ? 'Collected' : queued ? 'Detour queued' : available ? 'Explore' : 'Passed · restart to explore';
      const label = button.querySelector('[data-pickup-status]')!;
      if (label.textContent !== text) label.textContent = text;
    });
    if (creativity) {
      const time = journey.machine.record.clock - journey.machine.run.startedAt - journey.metrics.pausedSeconds;
      if (!journey.complete) for (const phrase of creativity.advance(time, journey.paused || journey.ready)) sounds.play(SoundEffect.fromScore(phrase.score), phrase.label!);
      const artist = creativity.artist;
      const text = [creativity.music ? `${musicianStyles.find(style => style.id === artist.musician)!.label} · ${creativity.bpm} BPM${creativity.harmony ? ' · harmony unlocked' : ''}` : 'Music locked', `${painterStyles.find(style => style.id === artist.painter)!.label}${creativity.colour ? ' · expanded palette' : ''}`].join(' / ');
      if (creativeStatus.textContent !== text) creativeStatus.textContent = text;
      const record = journey.machine.run.creative!;
      Object.assign(record, { music: creativity.music, art: creativity.art, harmony: creativity.harmony, colour: creativity.colour });
      const now = performance.now();
      paintingRenderer?.frame(artCanvas, (now - lastPaintFrame) / 1000, reducedMotion.matches || journey.complete);
      lastPaintFrame = now;
      const strokeLabel = container.querySelector('#painting-strokes')!;
      const strokeText = `${creativity.marks.length} strokes`;
      if (strokeLabel.textContent !== strokeText) strokeLabel.textContent = strokeText;
      const action = container.querySelector('#painting-action')!;
      if (action.textContent !== creativity.painting.lastAction) action.textContent = creativity.painting.lastAction;
      if (journey.complete && !presented) {
        presented = true; presentation.hidden = false;
        const finished = captureFinishedJourney(journey.machine.run);
        container.querySelector('#catwalk-heading')!.textContent = finished.artworkTitle.text;
        container.querySelector('#catwalk-description')!.textContent = `${journey.bot.name} presents a journey of ${journey.metrics.stepsTaken} steps and ${journey.machine.run.pickups.length} discoveries. ${creativity.score.length} musical phrases and ${creativity.marks.length} drawn marks tell this robot’s story.`;
        const renderer = paintingRenderer;
        const currentCity = city;
        void renderer?.snapshot(finalCanvas).then(() => {
          if (paintingRenderer === renderer && city === currentCity && active) {
            currentCity.present(finalCanvas); updateMapControls();
            exhibitionTimer = window.setTimeout(showExhibition, reducedMotion.matches ? 600 : 2200);
          }
        });
        container.querySelector<HTMLButtonElement>('#catwalk-replay')!.disabled = !creativity.score.length;
        finalCanvas.setAttribute('aria-label', `${journey.bot.name}’s finished procedural painting: ${creativity.marks.length} textured strokes, charcoal fractures for barriers, and luminous blooms for discoveries and access improvements.`);
        sounds.perform(creativity.score);
      }
    }
  }
  const observer = new ResizeObserver(() => {
    if (active && engine && city) { engine.resize(); city.resize(); }
  });
  observer.observe(canvas);
  container.querySelector('#back-to-designer')!.addEventListener('click', () => { editor.stopGuide(); clearExhibitionTimer(); active = false; accumulator = 0; city?.journey.leave(); paintingRenderer?.dispose(); sounds.stop(); onBack(); });
  container.querySelector('#city-exhibition')!.addEventListener('click', showExhibition);
  pause.addEventListener('click', () => {
    if (!city) return;
    if (city.journey.ready) city.journey.start();
    else city.journey.paused = !city.journey.paused;
    autoPaused = false; accumulator = 0;
    if (city.journey.paused) sounds.stop(); updatePanel();
  });
  container.querySelector('#city-restart')!.addEventListener('click', () => {
    sounds.stop(); city?.journey.restart(); if (city) { beginCreation(city.journey.bot); city.fit(); updateMapControls(); } eventCursor = 0; setMood('curious'); selected = null; manualSelection = false; autoPaused = false; lastBlock = null; accumulator = 0; city?.update(0); updatePanel();
  });
  container.querySelector('.powerup-list')!.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-powerup]') : null;
    if (button) explore(button.dataset.powerup as PowerupId);
  });
  container.querySelector('#catwalk-replay')!.addEventListener('click', () => {
    sounds.stop(); sounds.unlock();
    if (creativity && city) {
      sounds.perform(creativity.score); city.present(finalCanvas); updateMapControls();
      canvas.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  });
  container.querySelector('#city-waiting')!.addEventListener('click', () => { if (city?.journey.blocked) selectFeature(city.journey.blocked.id); });
  container.querySelector<HTMLSelectElement>('#city-camera-view')!.addEventListener('change', event => {
    if (!city) return;
    const view = (event.currentTarget as HTMLSelectElement).value as CityView;
    city.setView(view);
    sounds.button(`city-view-${view}`);
    updateMapControls();
  });
  container.querySelector('.map-controls')!.addEventListener('click', event => {
    const action = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-map]')?.dataset.map : undefined;
    if (!city) return;
    switch (action) {
      case 'zoom-in': city.setZoom(0.8); break;
      case 'zoom-out': city.setZoom(1.25); break;
      case 'fit': city.fit(); break;
      case 'left': city.pan(-4, 0); break;
      case 'right': city.pan(4, 0); break;
      case 'up': city.pan(0, 4); break;
      case 'down': city.pan(0, -4); break;
    }
    updateMapControls();
  });
  const pointers = new Map<number, { x: number; y: number }>();
  let previousPinch = 0;
  let gestureMoved = false;
  let gestureOrigin = { x: 0, y: 0 };
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    previousPinch = 0;
    if (pointers.size === 1) { gestureOrigin = { x: event.clientX, y: event.clientY }; gestureMoved = false; }
    else { gestureMoved = true; city?.resizer.finish(false); }
    if (pointers.size === 1 && city) {
      const bounds = canvas.getBoundingClientRect();
      city.resizer.begin(event.clientX - bounds.left, event.clientY - bounds.top);
      if (city.resizer.active) canvas.style.cursor = 'grabbing';
    }
  });
  canvas.addEventListener('pointermove', event => {
    const previous = pointers.get(event.pointerId);
    if (!previous || !city || !engine) return;
    if (Math.hypot(event.clientX - gestureOrigin.x, event.clientY - gestureOrigin.y) > 8) gestureMoved = true;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (city.resizer.active) {
      if (gestureMoved) { const bounds = canvas.getBoundingClientRect(); city.resizer.move(event.clientX - bounds.left, event.clientY - bounds.top); }
      return;
    }
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (previousPinch > 0 && distance > 0) city.setZoom(previousPinch / distance);
      previousPinch = distance;
    } else if (gestureMoved && city.canPan()) {
      const camera = city.scene.activeCamera!;
      const worldWidth = camera.orthoRight! - camera.orthoLeft!;
      city.pan(-(event.clientX - previous.x) / canvas.clientWidth * worldWidth, (event.clientY - previous.y) / canvas.clientWidth * worldWidth * 1.15);
    }
  });
  const release = (event: PointerEvent) => {
    if (city?.resizer.active) {
      const id = city.resizer.finish(event.type === 'pointerup');
      if (id) announceEdit(id);
      canvas.style.cursor = ''; refreshResizeControls();
    } else if (event.type === 'pointerup' && pointers.size === 1 && !gestureMoved) {
      const bounds = canvas.getBoundingClientRect();
      city?.selectAt(event.clientX - bounds.left, event.clientY - bounds.top);
    }
    pointers.delete(event.pointerId); previousPinch = 0;
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', event => { pointers.delete(event.pointerId); previousPinch = 0; city?.resizer.finish(false); canvas.style.cursor = ''; });
  canvas.addEventListener('wheel', event => { event.preventDefault(); if (!city?.resizer.active) city?.setZoom(event.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });

  return {
    setTheme(value: Theme) { theme = value; city?.setTheme(value); },
    suspend() { editor.stopGuide(); clearExhibitionTimer(); active = false; instructions.close(); sounds.stop(); },
    resume() { active = true; accumulator = 0; engine?.resize(); city?.resize(); updatePanel(); },
    showInstructions() {
      if (instructionsShown || !active || container.hidden) return;
      instructions.showModal();
      container.querySelector<HTMLElement>('#city-instructions-title')!.focus({ preventScroll: true });
      instructions.scrollTop = 0;
      instructionsShown = true;
    },
    enter(bot: ArtBot) {
      active = true;
      selected = null;
      manualSelection = false; autoPaused = false; editor.announce('');
      lastBlock = null;
      accumulator = 0;
      eventCursor = 0;
      sounds.stop(); sounds.unlock(); setMood('curious');
      pointers.clear();
      container.querySelector('#city-bot-name')!.textContent = bot.name;
      try {
        if (!engine) {
          engine = new Engine(canvas, true);
          engine.runRenderLoop(() => {
            if (!active || !city || document.hidden) return;
            accumulator += Math.min(engine!.getDeltaTime() / 1000, 0.1);
            while (accumulator >= 1 / 30) { city.update(1 / 30); accumulator -= 1 / 30; }
            updatePanel();
            city.scene.render();
          });
        }
        city?.scene.dispose();
        engine.resize();
        city = createCityScene(engine, bot, selectFeature, explore, selectResize);
        city.setTheme(theme);
        beginCreation(bot);
        updateMapControls();
        updatePanel();
      } catch (error) {
        active = false;
        status.textContent = 'The city could not load. Return to the designer and try again.';
        console.error('City initialization failed:', error);
      }
    },
    dispose() { editor.dispose(); clearExhibitionTimer(); active = false; instructions.close(); observer.disconnect(); paintingRenderer?.dispose(); city?.journey.leave(); city?.scene.dispose(); engine?.dispose(); },
  };
}
