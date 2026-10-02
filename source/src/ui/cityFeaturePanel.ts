import { cityBarriers } from '../city/cityLayout';
import type { BarrierId } from '../city/cityLayout';
import { describeFeature, featureNames, cityEditName } from '../city/cityDocument';
import type { CityValue } from '../city/cityDocument';
import type { CityJourney } from '../simulation/cityJourney';
import { mapIcon } from './mapIcons';
import type { ScreenSpeech } from '../audio/ScreenSpeech';
import { mountRobotGuide } from './robotGuide';
import { robotGuidance } from './robotGuidance';

const actions: Record<BarrierId, [string, string]> = {
  transport: ['Add transport', 'Remove transport'], curb: ['Lower curb', 'Raise curb'],
  crossing: ['More time', 'Less time'], guidance: ['Add route cues', 'Remove route cues'],
  sidewalk: ['Widen pavement', 'Narrow pavement'], bridge: ['Lower bridge', 'Raise bridge'],
  stairs: ['Add ramp', 'Remove ramp'], elevator: ['Enable elevator', 'Disable elevator'],
};
const icons = { transport: 'follow', curb: 'angled', crossing: 'plus', guidance: 'eye', sidewalk: 'overhead', bridge: 'angled', stairs: 'angled', elevator: 'up' } as const;

export function mountCityFeaturePanel(container: HTMLElement, callbacks: {
  select: (id: BarrierId) => void; edit: (id: BarrierId, value: CityValue) => void;
  undo: () => void; redo: () => void; done: () => void;
}, speech?: ScreenSpeech) {
  container.innerHTML = `
    <div class="city-editor-heading"><span class="editor-eyebrow">SHAPE YOUR CITY</span><h2>Plan. Test. Improve.</h2><p id="city-plan-prompt">What would you change before your robot sets off?</p></div>
    <div class="city-how-to" aria-label="How to change the city">
      <ol class="city-edit-steps"><li data-edit-step="0"><span>1</span> Choose</li><li data-edit-step="1"><span>2</span> Change</li><li data-edit-step="2"><span>3</span> Test</li></ol>
      <div class="city-next-step" role="status" aria-live="polite" aria-atomic="true"><strong id="city-guide-title">Choose a place to change</strong><p id="city-guide-copy">Select a feature below, or tap its ring on the map. Your robot will wait while you plan.</p></div>
    </div>
    <details class="city-robot-facts"><summary>Your robot</summary><dl id="city-robot-facts"></dl></details>
    <details class="city-feature-list" open><summary>City features <span>8 places to explore</span></summary>
      <div class="feature-grid">${cityBarriers.map(b => `<button type="button" data-city-feature="${b.id}" aria-pressed="false">${mapIcon(icons[b.id])}<span>${featureNames[b.id]}</span></button>`).join('')}</div>
    </details>
    <div class="feature-card" aria-labelledby="feature-heading">
      <h3 id="feature-heading">Choose a feature</h3><p id="feature-property">Choose any feature above to reveal its controls. You can edit before your robot moves.</p>
      <section id="city-robot-guide" class="robot-guide" aria-label="Your robot’s explanation" hidden></section>
      <div id="feature-edit-controls" hidden>
        <div class="feature-actions"><button id="feature-primary" type="button"></button><button id="feature-secondary" type="button" hidden></button></div>
        <p id="feature-occupied" hidden>The robot is using this feature. You can change it when the robot has moved clear.</p>
        <button id="feature-help" class="feature-help" type="button" aria-expanded="false" aria-controls="feature-hint">${mapIcon('eye')} Help me decide</button>
        <div id="feature-hint" class="feature-hint" hidden><p id="feature-explanation"></p><button id="feature-suggestion" type="button">Apply suggestion</button></div>
      </div>
    </div>
    <div id="city-edit-feedback" class="city-edit-feedback" hidden><span class="edit-feedback-icon" aria-hidden="true">✓</span><div><strong>City updated</strong><p id="city-edit-status" role="status" aria-live="polite" aria-atomic="true"></p></div></div>
    <div class="city-edit-history"><button id="city-undo" type="button" disabled>${mapIcon('left')} Undo</button><button id="city-redo" type="button" disabled>${mapIcon('right')} Redo</button></div>
    <p id="city-history-reason" class="city-edit-status" hidden></p>
    <button id="city-edit-done" type="button">Start journey <span aria-hidden="true">→</span></button>
  `;
  const get = <T extends HTMLElement = HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!;
  const guide = mountRobotGuide(get('city-robot-guide'), speech);
  const primary = get<HTMLButtonElement>('feature-primary'), secondary = get<HTMLButtonElement>('feature-secondary');
  const help = get<HTMLButtonElement>('feature-help'), hint = get('feature-hint');
  let journey: CityJourney | null = null, selected: BarrierId | null = null, showHelp = false;
  let lastKey = '';
  function render(current: CityJourney, id: BarrierId | null, autoPaused: boolean) {
    journey = current;
    if (id !== selected) { showHelp = false; selected = id; }
    const key = `${current.city.revision}:${id}:${current.ready}:${current.paused}:${current.complete}:${current.blocked?.id}:${current.edge}:${current.canEdit(id ?? 'transport')}:${showHelp}:${autoPaused}`;
    if (key === lastKey) return; lastKey = key;
    // Bring the explanation and choices into view without moving keyboard focus.
    const card = container.querySelector<HTMLElement>('.feature-card')!;
    container.insertBefore(card, id ? container.querySelector('.city-how-to') : get('city-edit-feedback'));
    const changed = current.city.changedFeatures.length > 0;
    const changedSelection = id && current.city.changedFeatures.includes(id);
    const contextual = current.blocked?.id === id && !!id;
    let step = id ? changedSelection ? 2 : 1 : 0;
    let title = 'Choose a place to change';
    let copy = 'Select a feature below, or tap its ring on the map. Your robot will wait while you plan.';
    if (current.complete) {
      step = 2; title = 'Try another version of your city'; copy = 'Change any feature, then choose Try again. Your city changes are kept.';
    } else if (contextual) {
      step = 1; title = `Your robot is waiting at ${featureNames[id!].toLowerCase()}`;
      copy = 'Use the main button below to help it pass. You can also change other features ahead of it.';
    } else if (autoPaused) {
      title = 'Paused so you can edit'; copy = 'Use the buttons below to change this feature. Choose Continue journey when you are ready.';
    } else if (current.paused) {
      title = 'Edit at your own pace'; copy = 'Choose a feature and use its buttons. Your robot stays paused until you choose Resume journey.';
    } else if (current.ready && changedSelection) {
      title = 'Ready to test your idea?'; copy = 'Your change is visible on the map. Choose Start journey to see what happens. Undo lets you change your mind.';
    } else if (id) {
      title = `Change ${featureNames[id].toLowerCase()}`; copy = 'Use the buttons below. Each change updates the map straight away. Help me decide offers an optional hint.';
    } else if (!current.ready) {
      title = 'Watch your robot explore'; copy = 'Select any feature to pause and edit. If your robot gets stuck, a suggested change will appear here.';
    }
    container.querySelectorAll<HTMLElement>('[data-edit-step]').forEach(item => {
      if (Number(item.dataset.editStep) === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    const setText = (name: string, text: string) => { if (get(name).textContent !== text) get(name).textContent = text; };
    setText('city-guide-title', title); setText('city-guide-copy', copy);
    get('city-plan-prompt').textContent = current.ready ? 'What would you change before your robot sets off?' : current.complete ? 'Keep experimenting, then try your city again.' : current.paused ? 'Take your time. Your city is yours to change.' : 'Edit ahead, or help your robot along the way.';
    get('city-robot-facts').innerHTML = `<dt>Footprint</dt><dd>${current.footprint.toFixed(1)} m wide</dd><dt>Travel speed</dt><dd>${current.speed.toFixed(1)} m/s</dd><dt>Visual navigation</dt><dd>${current.bot.profile.enabledFunctions.includes('vision') ? 'On' : 'Off'}</dd><dt>Route memory</dt><dd>${current.bot.profile.effectiveAbilities.routeMemory}/100</dd><dt>Movement</dt><dd>Wheels · step-free routes</dd>`;
    container.querySelectorAll<HTMLButtonElement>('[data-city-feature]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.cityFeature === id));
    });
    get('feature-heading').textContent = id ? featureNames[id] : 'Choose a feature';
    get('feature-property').textContent = id ? describeFeature(current.city, id) : 'Choose any feature above to reveal its controls. You can edit before your robot moves.';
    get('feature-edit-controls').hidden = !id;
    if (id && (current.ready || current.paused || current.blocked || current.complete)) guide.show(current.bot, robotGuidance(current, id, showHelp));
    else guide.hide();
    if (id) {
      const value = current.city.get(id), numeric = typeof value === 'number';
      const contextual = current.blocked?.id === id;
      primary.textContent = contextual ? cityBarriers.find(b => b.id === id)!.action : actions[id][numeric || !value ? 0 : 1];
      secondary.textContent = actions[id][1]; secondary.hidden = !numeric;
      const occupied = !current.canEdit(id);
      primary.disabled = occupied || (numeric && Number(value) >= (id === 'sidewalk' ? 6 : 20));
      secondary.disabled = occupied || Number(value) <= (id === 'sidewalk' ? 0.8 : 1.5);
      get('feature-occupied').hidden = !occupied;
      hint.hidden = !(showHelp || contextual);
      help.setAttribute('aria-expanded', String(!hint.hidden));
      get('feature-explanation').textContent = current.inaccessibleFeature(id)
        ? cityBarriers.find(b => b.id === id)!.explanation
        : 'Your robot can use this feature as it is. You can still experiment with other settings.';
      const suggestion = get<HTMLButtonElement>('feature-suggestion');
      suggestion.hidden = contextual;
      suggestion.textContent = cityBarriers.find(b => b.id === id)!.action;
      suggestion.disabled = occupied || !current.inaccessibleFeature(id);
    }
    const undo = get<HTMLButtonElement>('city-undo'), redo = get<HTMLButtonElement>('city-redo');
    undo.disabled = !current.city.undoEdit || !current.canEdit(current.city.undoEdit.id);
    redo.disabled = !current.city.redoEdit || !current.canEdit(current.city.redoEdit.id);
    undo.title = current.city.undoEdit ? `Undo change to ${cityEditName(current.city.undoEdit.id)}` : 'No changes to undo';
    redo.title = current.city.redoEdit ? `Redo change to ${cityEditName(current.city.redoEdit.id)}` : 'No changes to redo';
    const occupiedHistory = [current.city.undoEdit, current.city.redoEdit].find(edit => edit && !current.canEdit(edit.id));
    get('city-history-reason').hidden = !occupiedHistory;
    if (occupiedHistory) get('city-history-reason').textContent = `The robot is using ${cityEditName(occupiedHistory.id).toLowerCase()}. Resume the journey to move clear before undoing or redoing this change.`;
    const next = get<HTMLButtonElement>('city-edit-done');
    next.hidden = !(current.ready || current.paused || current.complete);
    next.textContent = current.ready ? 'Start journey →' : current.complete ? 'Try again →' : autoPaused ? 'Continue journey →' : 'Resume journey →';
    next.title = current.ready ? changed ? 'Test your edited city' : 'Explore the city as it is; you can edit along the way' : current.complete ? 'Start a new journey with your city changes kept' : 'Continue with your city changes kept';
    next.dataset.autoPaused = String(autoPaused);
  }
  container.querySelector('.feature-grid')!.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-city-feature]') : null;
    if (button) callbacks.select(button.dataset.cityFeature as BarrierId);
  });
  function adjust(direction: number) {
    if (!journey || !selected) return;
    if (direction > 0 && journey.blocked?.id === selected) {
      callbacks.edit(selected, journey.suggestedValue(selected)); return;
    }
    const value = journey.city.get(selected);
    const next = typeof value === 'number' ? value + direction * (selected === 'sidewalk' ? 0.4 : 1) : !value;
    callbacks.edit(selected, typeof next === 'number' ? Math.max(selected === 'sidewalk' ? 0.8 : 1.5, Math.min(selected === 'sidewalk' ? 6 : 20, next)) : next);
  }
  primary.addEventListener('click', () => adjust(1)); secondary.addEventListener('click', () => adjust(-1));
  help.addEventListener('click', () => { showHelp = !showHelp; if (journey) { lastKey = ''; render(journey, selected, get('city-edit-done').dataset.autoPaused === 'true'); } });
  get('feature-suggestion').addEventListener('click', () => { if (journey && selected) callbacks.edit(selected, journey.suggestedValue(selected)); });
  get('city-undo').addEventListener('click', callbacks.undo); get('city-redo').addEventListener('click', callbacks.redo);
  get('city-edit-done').addEventListener('click', callbacks.done);
  return { render, stopGuide: guide.stop, dispose: guide.dispose, announce(message: string) { get('city-edit-status').textContent = message; get('city-edit-feedback').hidden = !message; } };
}
