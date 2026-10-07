import { abilityPairs, clampAllocation, defaultAbilities } from '../robot/abilities';
import type { AbilityId } from '../robot/abilities';
import { createRobotProfile, defaultFunctions, robotFunctions, toggleFunction } from '../robot/functions';
import type { RobotProfile } from '../robot/functions';
import type { EditorFeedback } from '../robot/editorFeedback';
import { painterStyles, musicianStyles, defaultArtist, normaliseArtist } from '../art/artistStyles';
import type { PainterStyle, MusicianStyle, ArtistPreferences } from '../art/artistStyles';
import { ProceduralPainting } from '../art/ProceduralPainting';
import { AsyncPaintingRenderer } from '../art/AsyncPaintingRenderer';

export function mountAbilityDesigner(container: HTMLElement, onChange: (profile: RobotProfile, feedback?: EditorFeedback) => void, onArtistChange?: (artist: ArtistPreferences, previous: ArtistPreferences) => void, initialProfile?: RobotProfile, onStart?: () => void) {
  const allocation = defaultAbilities();
  if (initialProfile) for (const pair of abilityPairs) allocation[pair.id] = initialProfile.abilities[pair.id];
  let enabledFunctions = initialProfile ? [...initialProfile.enabledFunctions] : defaultFunctions();
  let artist = initialProfile ? normaliseArtist(initialProfile.artist) : defaultArtist();
  let previewRenderer: AsyncPaintingRenderer | null = null;
  let previewStyle: PainterStyle | null = null;
  container.innerHTML = `
    <div class="designer-hud-views" role="group" aria-label="Robot settings">
      <button id="designer-capabilities" type="button" data-designer-panel="capabilities" aria-pressed="true" aria-controls="designer-capabilities-panel">Capabilities</button>
      <button id="designer-tuning" type="button" data-designer-panel="tuning" aria-pressed="false" aria-controls="designer-tuning-panel">Tuning</button>
      <button id="designer-creativity" type="button" data-designer-panel="creativity" aria-pressed="false" aria-controls="designer-creativity-panel">Creativity</button>
    </div>
    <div class="designer-settings-panels">
    <div id="designer-capabilities-panel" data-settings-panel="capabilities">
    <div class="designer-heading">
      <h2 id="functions-heading" class="designer-panel-heading">Pick 3 Capabilities</h2>
      <button hidden type="button" id="reset-abilities">Reset abilities</button>
    </div>
    <section class="function-designer" aria-labelledby="functions-heading">
      <div class="function-list">${robotFunctions.map(item => `
        <div class="function-item">
          <div class="function-row"><div><h3 id="function-label-${item.id}">${item.label}</h3>
            <p class="sr-only" id="function-description-${item.id}">${item.description}</p></div>
            <button type="button" role="switch" id="function-${item.id}" data-function="${item.id}" aria-checked="false"
              aria-labelledby="function-label-${item.id}" aria-describedby="function-description-${item.id} function-swap-${item.id}">
              <span class="switch-track" aria-hidden="true"><span></span></span><span class="switch-state" aria-hidden="true">Disabled</span>
            </button></div>
          <p class="sr-only" id="function-swap-${item.id}"></p>
        </div>`).join('')}</div>
      <p id="function-announcement" class="function-announcement" role="status" aria-live="polite"></p>
    </section>
    </div>
    <div id="designer-tuning-panel" data-settings-panel="tuning" hidden>
    <div class="ability-list" role="group" aria-label="Ability tradeoffs">
      <h2 class="designer-panel-heading">Balance your abilities</h2><p class="control-hint">Each pair shares 100 points. Move a slider towards the ability you want more of.</p>
      ${abilityPairs.map(pair => `
        <section class="ability-pair" aria-labelledby="label-${pair.id}">
          <h3 id="label-${pair.id}" class="sr-only">${pair.primary} versus ${pair.secondary}</h3>
          <div class="pair-values"><span>${pair.secondary} <output id="secondary-${pair.id}" for="ability-${pair.id}">50</output></span>
            <span>${pair.primary} <output id="primary-${pair.id}" for="ability-${pair.id}">50</output></span></div>
          <input type="range" id="ability-${pair.id}" data-ability="${pair.id}" min="0" max="100" step="1" value="50"
            aria-labelledby="label-${pair.id}" aria-describedby="description-${pair.id} feedback-${pair.id}" />
          <p id="description-${pair.id}" class="control-hint">${pair.description}</p>
          <p class="sr-only" id="feedback-${pair.id}"></p>
        </section>
      `).join('')}
    </div>
    </div>
    <section id="designer-creativity-panel" data-settings-panel="creativity" class="artist-designer" aria-labelledby="artist-heading" hidden>
      <h2 id="artist-heading" class="designer-panel-heading">Creative personality</h2><p class="artist-intro">Choose how this robot sees and hears its journey.</p>
      <label for="artist-painter">Painter</label><select id="artist-painter" aria-describedby="artist-painter-description">${painterStyles.map(style => `<option value="${style.id}">${style.label}</option>`).join('')}</select><p id="artist-painter-description"></p>
      <canvas id="artist-preview" width="480" height="240" role="img" aria-label="A study of this robot’s selected painting style"></canvas>
      <label for="artist-musician">Musician</label><select id="artist-musician" aria-describedby="artist-musician-description artist-musician-hint">${musicianStyles.map(style => `<option value="${style.id}">${style.label}</option>`).join('')}</select><p id="artist-musician-description"></p><p id="artist-musician-hint">Choose a style to hear a four-bar preview. Your robot will develop its own melody as it explores.</p>
      <p class="artist-note">Each is a generative interpretation. Your choices stay with this robot.</p>
    </section>
    </div>
    <div class="designer-step-actions"><button id="enter-city" class="primary-action" type="button" aria-controls="designer-tuning-panel">Next step</button></div>
    <p id="designer-announcement" class="sr-only" role="status" aria-live="polite"></p>
  `;

  function update(feedback?: EditorFeedback) {
    const profile = createRobotProfile(allocation, enabledFunctions, artist);
    container.querySelector<HTMLSelectElement>('#artist-painter')!.value = artist.painter;
    container.querySelector<HTMLSelectElement>('#artist-musician')!.value = artist.musician;
    container.querySelector('#artist-painter-description')!.textContent = painterStyles.find(style => style.id === artist.painter)!.description;
    container.querySelector('#artist-musician-description')!.textContent = musicianStyles.find(style => style.id === artist.musician)!.description;
    if (previewStyle !== artist.painter) {
      previewStyle = artist.painter; previewRenderer?.dispose();
      const painting = new ProceduralPainting(42661, .7, artist.painter);
      for (let i = 1; i <= 48; i++) painting.consume({ sequence: i, botId: 0, runId: 0, time: i, runTime: i, type: i === 1 ? 'pickup' : i % 15 === 0 ? 'achievement' : 'step', state: 'following', edge: Math.floor(i / 8),
        position: { x: Math.sin(i * .25) * 12, y: 0, z: i }, data: i === 1 ? { kind: 'colour' } : { step: i } });
      previewRenderer = new AsyncPaintingRenderer(painting);
      const previewCanvas = container.querySelector<HTMLCanvasElement>('#artist-preview')!;
      previewCanvas.setAttribute('aria-label', `${painterStyles.find(style => style.id === artist.painter)!.label} style study. The city journey will create a new painting using this approach.`);
      void previewRenderer.snapshot(previewCanvas);
    }
    const functionLabel = (id: string) => robotFunctions.find(item => item.id === id)!.label;
    for (const item of robotFunctions) {
      const on = enabledFunctions.includes(item.id);
      const button = container.querySelector<HTMLButtonElement>(`#function-${item.id}`)!;
      button.setAttribute('aria-checked', String(on));
      button.querySelector('.switch-state')!.textContent = on ? 'Enabled' : 'Disabled';
      const swap = toggleFunction(enabledFunctions, item.id);
      const swapText = on
        ? `Turn off: ${functionLabel(swap.enabled)} will turn on.`
        : `Turn on: ${functionLabel(swap.disabled)} will turn off.`;
      container.querySelector(`#function-swap-${item.id}`)!.textContent = swapText;
      button.title = swapText;
    }
    for (const pair of abilityPairs) {
      const value = allocation[pair.id];
      const slider = container.querySelector<HTMLInputElement>(`#ability-${pair.id}`)!;
      slider.value = String(value);
      const inactive = pair.id === 'visualDetail' && !enabledFunctions.includes('vision');
      slider.disabled = inactive;
      slider.title = inactive ? 'Module off; settings retained.' : pair.description;
      slider.style.setProperty('--allocation', `${value}%`);
      slider.setAttribute('aria-valuetext', `${pair.primary} ${value}, ${pair.secondary} ${100 - value}${pair.id === 'speed' ? `, effective forgetfulness ${profile.effectiveAbilities.forgetfulness}` : ''}`);
      container.querySelector(`#primary-${pair.id}`)!.textContent = String(value);
      container.querySelector(`#secondary-${pair.id}`)!.textContent = String(100 - value);
      const feedback = pair.id === 'speed'
        ? `Forgetfulness: ${profile.effectiveAbilities.forgetfulness}/100${!enabledFunctions.includes('memory') ? ' (route memory off)' : ''}. ${pair.support}` : pair.support;
      container.querySelector(`#feedback-${pair.id}`)!.textContent = inactive ? `Module off. Settings retained. ${pair.support}` : feedback;
    }
    onChange(profile, feedback);
  }

  const onInput = (event: Event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.disabled || !input.dataset.ability) return;
    const id = input.dataset.ability as AbilityId;
    if (!(id in allocation)) return;
    const previous = allocation[id];
    const value = clampAllocation(input.valueAsNumber);
    if (previous === value) return;
    allocation[id] = value;
    update({ type: 'ability', id, previous, value });
  };
  const onReset = () => {
    Object.assign(allocation, defaultAbilities());
    enabledFunctions = defaultFunctions();
    update({ type: 'reset' });
    container.querySelector('#function-announcement')!.textContent = '';
    container.querySelector('#designer-announcement')!.textContent = 'Designer reset: three default functions enabled; all ability pairs at 50 points each.';
  };
  const onArtistInput = (event: Event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement)) return;
    const previous = artist;
    if (select.id === 'artist-painter') artist = normaliseArtist({ ...artist, painter: select.value as PainterStyle });
    else if (select.id === 'artist-musician') artist = normaliseArtist({ ...artist, musician: select.value as MusicianStyle });
    else return;
    update();
    onArtistChange?.(artist, previous);
    container.querySelector('#designer-announcement')!.textContent = `Creative personality: ${painterStyles.find(style => style.id === artist.painter)!.label} and ${musicianStyles.find(style => style.id === artist.musician)!.label}.`;
  };
  const views = [...container.querySelectorAll<HTMLButtonElement>('[data-designer-panel]')];
  const nextStep = container.querySelector<HTMLButtonElement>('#enter-city')!;
  let activeStep = 0;
  function selectStep(index: number) {
    activeStep = index;
    const view = views[index]!;
    for (const button of views) button.setAttribute('aria-pressed', String(button === view));
    for (const panel of container.querySelectorAll<HTMLElement>('[data-settings-panel]')) panel.hidden = panel.dataset.settingsPanel !== view.dataset.designerPanel;
    const nextView = views[index + 1];
    nextStep.textContent = nextView ? 'Next step' : 'Start';
    if (nextView) nextStep.setAttribute('aria-controls', nextView.getAttribute('aria-controls')!);
    else nextStep.removeAttribute('aria-controls');
    container.querySelector<HTMLElement>('.designer-settings-panels')!.scrollTop = 0;
    container.querySelector('#designer-announcement')!.textContent = `Step ${index + 1} of ${views.length}: ${view.textContent}.`;
    container.dispatchEvent(new CustomEvent('designer-layout-change', { bubbles: true }));
  }
  const onNextStep = () => {
    if (activeStep < views.length - 1) selectStep(activeStep + 1);
    else onStart?.();
  };
  const onFunctionClick = (event: Event) => {
    const view = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('[data-designer-panel]') : null;
    if (view) {
      selectStep(views.indexOf(view));
      return;
    }
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[data-function]') : null;
    const item = robotFunctions.find(item => item.id === button?.dataset.function);
    if (!item) return;
    const swap = toggleFunction(enabledFunctions, item.id);
    enabledFunctions = swap.selected;
    update({ type: 'function', id: item.id, enabled: swap.enabled === item.id, swapEnabled: swap.enabled, swapDisabled: swap.disabled });
    const label = (id: string) => robotFunctions.find(item => item.id === id)!.label;
    container.querySelector('#function-announcement')!.textContent = `${label(swap.enabled)} enabled · ${label(swap.disabled)} disabled`;
  };
  container.addEventListener('input', onInput);
  container.addEventListener('click', onFunctionClick);
  container.addEventListener('change', onArtistInput);
  nextStep.addEventListener('click', onNextStep);
  container.querySelector('#reset-abilities')!.addEventListener('click', onReset);
  update();
  return {
    setProfile(profile: RobotProfile) {
      for (const pair of abilityPairs) allocation[pair.id] = clampAllocation(profile.abilities[pair.id]);
      enabledFunctions = [...profile.enabledFunctions];
      artist = normaliseArtist(profile.artist);
      update();
      container.querySelector('#function-announcement')!.textContent = '';
      container.querySelector('#designer-announcement')!.textContent = '';
    },
    dispose() {
      previewRenderer?.dispose();
      container.removeEventListener('input', onInput);
      container.removeEventListener('click', onFunctionClick);
      container.removeEventListener('change', onArtistInput);
      nextStep.removeEventListener('click', onNextStep);
      container.querySelector('#reset-abilities')?.removeEventListener('click', onReset);
    },
  };
}
