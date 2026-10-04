import { Engine } from '@babylonjs/core/Engines/engine';
import { createWorkshopScene } from './app/createWorkshopScene';
import { mountAbilityDesigner } from './ui/abilityDesigner';
import type { RobotProfile } from './robot/functions';
import { describeAppearance } from './robot/appearance';
import type { RobotAppearance } from './robot/appearance';
import { BotHistory } from './robot/botHistory';
import { robotPresets } from './robot/presets';
import scientistSurnamesText from './data/scientist-surnames.txt?raw';
import { parseScientistSurnames } from './robot/scientistNames';
import { mountCityScreen } from './ui/cityScreen';
import { CitySounds } from './audio/CitySounds';
import { ScreenSpeech } from './audio/ScreenSpeech';
import { mountMidiControls } from './ui/midiControls';
import { isButtonSound } from './audio/soundPresets';
import { createScreenTransition } from './app/screenTransition';
import type { EditorFeedback } from './robot/editorFeedback';
import { mountAttractScreen } from './ui/attractScreen';
import { mountExhibitionScreen } from './ui/exhibitionScreen';
import { JourneyCreativity } from './art/JourneyCreativity';
import { SoundEffect } from './audio/SoundEffect';
import { painterStyles } from './art/artistStyles';
import './styles.css';
import './lightTheme.css';
import './cityHud.css';
import './uiDesign.css';
import './accessibility.css';
import { applyTheme, savedTheme } from './app/theme';
import type { Theme } from './app/theme';
import { requireMusicModel } from './ui/musicSetup';
import { mountButtonIcons } from './ui/buttonIcons';
import { applyAccessibility, savedAccessibility, reducedMotionPreference } from './app/accessibilityPreferences';
import { mountAccessibilityControls } from './ui/accessibilityControls';
import './readingPreferences.css';
import './performance.css';

let theme = savedTheme();
applyTheme(theme);
applyAccessibility(savedAccessibility());
let updateWorkshopTheme: (theme: Theme) => void = () => {};

const app = document.querySelector<HTMLDivElement>('#app')!;
const stopButtonIcons = mountButtonIcons(app);
import.meta.hot?.dispose(stopButtonIcons);
await requireMusicModel(app);

app.innerHTML = `
  <main class="workshop attract-mode">
    <div class="sound-controls">
      <button id="app-options" type="button" aria-label="Open settings" aria-haspopup="dialog" aria-controls="options-dialog" aria-expanded="false"><span aria-hidden="true">☰</span><span class="settings-label">Settings</span></button>
    </div>
    <dialog id="options-dialog" class="options-dialog" aria-labelledby="options-title">
      <div class="options-heading"><h2 id="options-title">Settings</h2><button id="options-close" type="button" aria-label="Close settings">✕</button></div>
      <section class="options-appearance" aria-labelledby="options-appearance-title"><h3 id="options-appearance-title">Appearance</h3><label for="app-theme">Colour mode</label><select id="app-theme"><option value="dark">Dark</option><option value="light">Light</option></select></section>
      <section id="accessibility-controls" aria-labelledby="options-accessibility-title"></section>
      <section class="options-audio" aria-labelledby="options-audio-title"><h3 id="options-audio-title">Sound</h3>
      <button id="sound-mute" type="button" aria-pressed="false">Mute sound</button>
      <label for="sound-volume">Volume</label><input id="sound-volume" type="range" min="0" max="100" value="55" />
      <label class="speech-option" for="speech-enabled"><span>Spoken introductions & robot guidance</span><input id="speech-enabled" type="checkbox" role="switch" checked /></label>
      </section>
      <details class="midi-disclosure"><summary>Connect a MIDI instrument <span aria-hidden="true">⌄</span></summary><section id="midi-controls" class="midi-controls" aria-label="MIDI output"></section></details>
      <section id="attract-options" aria-labelledby="attract-options-title"><h3 id="attract-options-title">Attract screen</h3></section>
    </dialog>
    <section id="attract-screen" aria-labelledby="attract-title"></section>
    <div id="designer-screen" hidden>
    <header class="designer-introduction"
        <h1 id="designer-title" tabindex="-1">Meet your artbot</h1>
    </header>
    <div class="designer-layout"><div class="preview-column">
    <div class="bot-identity">
      <form id="rename-bot"><div class="rename-controls">
        <label for="bot-name-input">Robot name</label>
        <input id="bot-name-input" type="text" required maxlength="60" autocomplete="off" />
        <button id="random-name" type="button">Random name</button>
      </div>
      <p id="name-error" role="status" aria-live="polite"></p>
      </form>
    </div>
    <div class="robot-carousel" role="group" aria-label="Art bot navigation">
    <button id="previous-bot" type="button" aria-label="Previous robot" title="Previous robot" disabled><span aria-hidden="true">←</span></button>
    <section class="stage" aria-label="Artbot preview">
      <canvas id="render-canvas" role="img" aria-label="A mint robot with four wheels on a circular workshop platform."></canvas>
      <button id="rotation-toggle" type="button" aria-label="Pause rotation" title="Pause rotation" disabled>Ⅱ</button>
    </section>
    <button id="randomise-design" type="button" aria-label="Next robot" title="Next robot"><span aria-hidden="true">→</span></button>
    </div>
    <div class="designer-next"><button id="enter-city" class="primary-action" type="button">Start!</button><button id="choose-existing" type="button">Browse ready-made robots</button></div>
    <p id="engine-status" class="sr-only" role="status">Loading preview…</p>
    </div><aside id="ability-designer" aria-label="Robot ability designer"></aside></div>
    </div>
    <section id="presets-screen" hidden aria-label="Choose an existing robot" aria-roledescription="carousel">
      <div class="preset-carousel">
        <button id="preset-previous" class="preset-arrow" type="button" aria-label="Previous preset robot">←</button>
        <div id="preset-stage" class="preset-stage" aria-label="Preset robot preview"></div>
        <button id="preset-next" class="preset-arrow" type="button" aria-label="Next preset robot">→</button>
      </div>
      <div class="preset-caption" aria-live="polite" aria-atomic="true"><span id="preset-position"></span><h1 id="preset-name"></h1><p id="preset-description"></p></div>
      <button id="edit-robot" class="primary-action" type="button">Use this robot <span aria-hidden="true">→</span></button>
    </section>
    <section id="city-screen" hidden></section><section id="exhibition-screen" hidden aria-labelledby="exhibition-title"></section>
  </main>
`;

mountAccessibilityControls(document.querySelector<HTMLElement>('#accessibility-controls')!);

const canvas = document.querySelector<HTMLCanvasElement>('#render-canvas')!;
const status = document.querySelector<HTMLParagraphElement>('#engine-status')!;
const toggle = document.querySelector<HTMLButtonElement>('#rotation-toggle')!;
let inCity = false;
let inAttract = true;
let inExhibition = false;
let resizeWorkshop = () => {};
const workshop = document.querySelector<HTMLElement>('.workshop')!;
const designerScreen = document.querySelector<HTMLElement>('#designer-screen')!;
const presetsScreen = document.querySelector<HTMLElement>('#presets-screen')!;
const editorStage = canvas.parentElement!;
const presetStage = document.querySelector<HTMLElement>('#preset-stage')!;
const cityContainer = document.querySelector<HTMLElement>('#city-screen')!;
const exhibitionContainer = document.querySelector<HTMLElement>('#exhibition-screen')!;
const screenSpeech = new ScreenSpeech();
const speechEnabled = document.querySelector<HTMLInputElement>('#speech-enabled')!;
try { speechEnabled.checked = localStorage.getItem('inclusive-city-speech') !== 'disabled'; } catch { /* Settings work when storage is unavailable. */ }
screenSpeech.setEnabled(speechEnabled.checked);
speechEnabled.disabled = !screenSpeech.supported;
speechEnabled.addEventListener('change', () => {
  screenSpeech.setEnabled(speechEnabled.checked);
  try { localStorage.setItem('inclusive-city-speech', speechEnabled.checked ? 'enabled' : 'disabled'); } catch { /* Keep this session's preference. */ }
});
const screenTransition = createScreenTransition(workshop, {
  stop: () => screenSpeech.stop(),
  entered(screen) {
    if (document.hidden) return;
    if (screen === presetsScreen) screenSpeech.introduce('presets');
    else if (screen === designerScreen) screenSpeech.introduce('editor');
    else if (screen === cityContainer) screenSpeech.introduce('city', history.current.name);
    else if (screen === exhibitionContainer) screenSpeech.introduce('art');
  },
});
import.meta.hot?.dispose(() => screenSpeech.dispose());
import.meta.hot?.dispose(() => screenTransition.dispose());
const sounds = new CitySounds();
mountMidiControls(document.querySelector<HTMLElement>('#midi-controls')!, sounds.midi);
const optionsDialog = document.querySelector<HTMLDialogElement>('#options-dialog')!;
const optionsButton = document.querySelector<HTMLButtonElement>('#app-options')!;
optionsButton.addEventListener('click', () => {
  if (!inAttract) return;
  optionsDialog.showModal(); optionsButton.setAttribute('aria-expanded', 'true');
});
document.querySelector('#options-close')!.addEventListener('click', () => optionsDialog.close());
optionsDialog.addEventListener('close', () => {
  optionsButton.setAttribute('aria-expanded', 'false');
  if (inAttract) optionsButton.focus();
});
optionsDialog.addEventListener('click', event => {
  if (event.target !== optionsDialog) return;
  const bounds = optionsDialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) optionsDialog.close();
});
import.meta.hot?.dispose(() => optionsDialog.close());
const attractContainer = document.querySelector<HTMLElement>('#attract-screen')!;
const attract = mountAttractScreen(attractContainer, sounds, () => {
  void screenTransition.run(attractContainer, designerScreen, () => {
    inAttract = false;
    optionsDialog.close();
    attract.leave();
    attractContainer.hidden = true;
    designerScreen.hidden = false;
    workshop.classList.remove('attract-mode');
    window.scrollTo({ top: 0, behavior: 'instant' });
    resizeWorkshop();
  }, document.querySelector<HTMLElement>('#designer-title')!);
});
import.meta.hot?.dispose(() => attract.leave());
const muteButton = document.querySelector<HTMLButtonElement>('#sound-mute')!;
const volumeInput = document.querySelector<HTMLInputElement>('#sound-volume')!;
if (!sounds.supported && !screenSpeech.supported) {
  muteButton.disabled = true; volumeInput.disabled = true; muteButton.textContent = 'Sound unavailable';
}
const unlockSound = () => sounds.unlock();
app.addEventListener('pointerdown', unlockSound, true);
app.addEventListener('keydown', unlockSound, true);
const onInteraction = (event: Event) => {
  const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
  if (!button) return;
  sounds.unlock();
  if (button.id === 'sound-mute') {
    sounds.setMuted(!sounds.isMuted);
    screenSpeech.setMuted(sounds.isMuted);
    muteButton.setAttribute('aria-pressed', String(sounds.isMuted));
    muteButton.textContent = sounds.isMuted ? 'Unmute sound' : 'Mute sound';
    sounds.button('sound-mute', !sounds.isMuted);
    return;
  }
  // Successful form submission has its cue in the submit handler (also supports Enter).
  if (button.type === 'submit') return;
  if (button.dataset.powerup) return; // Successful queuing has the same cue as clicking its map pickup.
  const signature = button.dataset.map ? `map-${button.dataset.map}` : button.dataset.view ? `view-${button.dataset.view}` : button.id;
  if (isButtonSound(signature)) {
    const active = button.dataset.function ? button.getAttribute('aria-checked') === 'true'
      : button.id === 'rotation-toggle' ? button.getAttribute('aria-label') === 'Pause rotation'
      : button.id === 'city-pause' ? button.textContent === 'Pause' : true;
    sounds.button(signature, active);
  }
};
const onSoundInput = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return;
  sounds.unlock();
  if (event.target === volumeInput) {
    sounds.setVolume(volumeInput.valueAsNumber / 100);
    screenSpeech.setVolume(volumeInput.valueAsNumber / 100);
  }
  else if (event.target.dataset.ability && !event.target.disabled) sounds.tune(event.target.valueAsNumber);
};
app.addEventListener('click', onInteraction);
app.addEventListener('input', onSoundInput);
const onVisibility = () => { if (document.hidden) { sounds.stop(); screenSpeech.stop(); } };
document.addEventListener('visibilitychange', onVisibility);
import.meta.hot?.dispose(() => {
  app.removeEventListener('pointerdown', unlockSound, true);
  app.removeEventListener('keydown', unlockSound, true);
  app.removeEventListener('click', onInteraction);
  app.removeEventListener('input', onSoundInput);
  document.removeEventListener('visibilitychange', onVisibility);
  sounds.dispose();
});
const exhibition = mountExhibitionScreen(exhibitionContainer, sounds);
import.meta.hot?.dispose(() => exhibition.dispose());
let openingExhibition = false;
const cityScreen = mountCityScreen(cityContainer, sounds, journey => {
  if (openingExhibition) return;
  openingExhibition = true;
  cityScreen.suspend();
  void (async () => {
    try {
      await exhibition.prepare(journey);
      await screenTransition.run(cityContainer, exhibitionContainer, () => {
        inCity = false; inExhibition = true;
        cityContainer.hidden = true; exhibitionContainer.hidden = false;
        workshop.classList.remove('city-mode'); workshop.classList.add('exhibition-mode');
        window.scrollTo({ top: 0, behavior: 'instant' }); exhibition.enter();
      }, exhibition.title, 'gallery');
    } catch (error) { cityScreen.resume(); console.error('Exhibition could not open:', error); }
    finally { openingExhibition = false; }
  })();
}, screenSpeech);
let designStorage: Storage | undefined;
try { designStorage = window.localStorage; } catch { /* The designer works without storage. */ }
const history = new BotHistory(parseScientistSurnames(scientistSurnamesText), Math.random, designStorage);
document.querySelector('#enter-city')!.addEventListener('click', () => {
  void screenTransition.run(designerScreen, cityContainer, () => {
    inCity = true;
    designerScreen.hidden = true;
    cityContainer.hidden = false;
    workshop.classList.add('city-mode');
    window.scrollTo({ top: 0, behavior: 'instant' });
    cityScreen.enter(history.current, history.all);
  }, document.querySelector<HTMLElement>('#city-heading')!).then(() => cityScreen.showInstructions());
});
import.meta.hot?.dispose(() => cityScreen.dispose());
cityScreen.setTheme(theme);
document.querySelector('#back-to-designer')!.addEventListener('click', () => {
  cityScreen.suspend();
  void screenTransition.run(cityContainer, designerScreen, () => {
    inCity = false; cityContainer.hidden = true; designerScreen.hidden = false;
    workshop.classList.remove('city-mode'); resizeWorkshop();
  }, document.querySelector<HTMLButtonElement>('#enter-city')!);
});
document.querySelector('#exhibition-city')!.addEventListener('click', () => {
  exhibition.leave();
  void screenTransition.run(exhibitionContainer, cityContainer, () => {
    inExhibition = false; inCity = true; exhibitionContainer.hidden = true; cityContainer.hidden = false;
    workshop.classList.remove('exhibition-mode'); workshop.classList.add('city-mode'); cityScreen.resume();
  }, document.querySelector<HTMLButtonElement>('#city-restart')!);
});
const themeSelect = document.querySelector<HTMLSelectElement>('#app-theme')!;
themeSelect.value = theme;
themeSelect.addEventListener('change', () => {
  theme = themeSelect.value === 'light' ? 'light' : 'dark';
  applyTheme(theme); cityScreen.setTheme(theme); updateWorkshopTheme(theme);
});
let appearance = history.current.appearance;
let applyAppearance: (value: RobotAppearance) => void = () => {};
let profile = history.current.profile;
let applyProfile: (value: RobotProfile) => void = () => {};
let feelSettings: (change: EditorFeedback) => void = () => {};
let applyIdentity: (name: string, id: number) => void = () => {};
function describeRobot() {
  const description = describeAppearance(appearance);
  canvas.setAttribute('aria-label', `${history.current.name}, a four-wheeled robot. ${description}. Enabled functions: ${profile.enabledFunctions.join(', ')}.`);
}
let musicAudition = 0;
const designer = mountAbilityDesigner(document.querySelector('#ability-designer')!, (value, feedback) => {
  profile = value;
  history.updateProfile(value);
  applyProfile(value);
  if (feedback) feelSettings(feedback);
  describeRobot();
}, (artist, previous) => {
  if (previous.musician !== artist.musician) {
    sounds.unlock(); sounds.stop();
    const audition = ++musicAudition, botId = history.current.id;
    void new JourneyCreativity(history.current).previewEnhancedMusic().then(score => {
      if (audition === musicAudition && history.current.id === botId && !inCity && !inAttract && !inExhibition) sounds.perform(score);
    });
  } else if (previous.painter !== artist.painter) {
    sounds.play(new SoundEffect({ root: 60 + painterStyles.findIndex(style => style.id === artist.painter), intervals: [0, 4, 7], pattern: 'up', waveform: 'sine', gain: .08 }), `artist:painter:${artist.painter}`);
  }
}, history.current.profile);
import.meta.hot?.dispose(() => designer.dispose());
const nameInput = document.querySelector<HTMLInputElement>('#bot-name-input')!;
const nameError = document.querySelector('#name-error')!;
const presetDescription = document.querySelector<HTMLParagraphElement>('#preset-description')!;
const presetPrevious = document.querySelector<HTMLButtonElement>('#preset-previous')!;
const presetNext = document.querySelector<HTMLButtonElement>('#preset-next')!;
const editRobot = document.querySelector<HTMLButtonElement>('#edit-robot')!;
let presetIndex = 0;
let browsingPreset = false;
const carouselAnimations = new Set<Animation>();

function showPreset() {
  const preset = robotPresets[presetIndex]!;
  history.selectPreset(preset.id);
  showCurrentBot();
  document.querySelector('#preset-name')!.textContent = history.current.name;
  document.querySelector('#preset-position')!.textContent = `${presetIndex + 1} / ${robotPresets.length}`;
  presetDescription.textContent = preset.description;
}
document.querySelector('#choose-existing')!.addEventListener('click', () => {
  const currentIndex = robotPresets.findIndex(bot => bot.id === history.current.presetId);
  if (currentIndex !== -1) presetIndex = currentIndex;
  void screenTransition.run(designerScreen, presetsScreen, () => {
    designerScreen.hidden = true;
    presetsScreen.hidden = false;
    workshop.classList.add('presets-mode');
    presetStage.append(canvas);
    showPreset();
    window.scrollTo({ top: 0, behavior: 'instant' });
    resizeWorkshop();
  }, editRobot);
});
editRobot.addEventListener('click', () => {
  if (browsingPreset) return;
  void screenTransition.run(presetsScreen, designerScreen, () => {
    presetsScreen.hidden = true;
    designerScreen.hidden = false;
    workshop.classList.remove('presets-mode');
    editorStage.prepend(canvas);
    showCurrentBot();
    window.scrollTo({ top: 0, behavior: 'instant' });
    resizeWorkshop();
  }, nameInput);
});
async function slidePreset(direction: number) {
  if (browsingPreset || workshop.inert) return;
  browsingPreset = true;
  presetPrevious.disabled = presetNext.disabled = editRobot.disabled = true;
  const animate = async (frames: Keyframe[], duration: number) => {
    const animation = canvas.animate(frames, { duration, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' });
    carouselAnimations.add(animation);
    let timer = 0;
    await Promise.race([animation.finished.catch(() => {}), new Promise<void>(resolve => { timer = window.setTimeout(resolve, duration + 100); })]);
    window.clearTimeout(timer);
    animation.cancel(); carouselAnimations.delete(animation);
  };
  try {
    const motion = !reducedMotionPreference().matches;
    if (motion) await animate([{ opacity: 1, transform: 'translateX(0)' }, { opacity: 0, transform: `translateX(${-direction * 18}%)` }], 180);
    presetIndex = (presetIndex + direction + robotPresets.length) % robotPresets.length;
    showPreset(); resizeWorkshop();
    if (motion) await animate([{ opacity: 0, transform: `translateX(${direction * 18}%)` }, { opacity: 1, transform: 'translateX(0)' }], 340);
  } finally {
    browsingPreset = false;
    presetPrevious.disabled = presetNext.disabled = editRobot.disabled = false;
  }
}
presetPrevious.addEventListener('click', () => { void slidePreset(-1); });
presetNext.addEventListener('click', () => { void slidePreset(1); });
presetsScreen.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  void slidePreset(event.key === 'ArrowLeft' ? -1 : 1);
});
import.meta.hot?.dispose(() => carouselAnimations.forEach(animation => animation.cancel()));
function showCurrentBot() {
  appearance = history.current.appearance;
  applyAppearance(appearance);
  designer.setProfile(history.current.profile);
  applyIdentity(history.current.name, history.current.id);
  nameInput.value = history.current.name;
  nameInput.setCustomValidity('');
  nameError.textContent = '';
  const previousBot = document.querySelector<HTMLButtonElement>('#previous-bot')!;
  previousBot.disabled = !history.canGoBack;
  describeRobot();
}
document.querySelector('#randomise-design')!.addEventListener('click', () => {
  history.next();
  showCurrentBot();
});
document.querySelector('#previous-bot')!.addEventListener('click', () => {
  history.previous();
  showCurrentBot();
});
nameInput.addEventListener('input', () => nameInput.setCustomValidity(''));
nameInput.addEventListener('blur', () => {
  if (nameInput.value === history.current.name) return;
  try {
    const name = history.rename(nameInput.value);
    nameInput.value = name;
    applyIdentity(name, history.current.id);
    describeRobot();
    nameError.textContent = '';
    sounds.unlock();
    sounds.button('save-name');
  } catch (error) {
    nameInput.value = history.current.name;
    nameInput.setCustomValidity('');
    nameError.textContent = `${error instanceof Error ? error.message : 'Enter a name.'} Kept the previous name.`;
  }
});
document.querySelector('#rename-bot')!.addEventListener('submit', event => {
  event.preventDefault();
  nameInput.blur();
});
document.querySelector('#random-name')!.addEventListener('click', () => {
  const name = history.randomiseName();
  nameInput.value = name;
  nameInput.setCustomValidity('');
  applyIdentity(name, history.current.id);
  describeRobot();
  nameError.textContent = '';
});
showCurrentBot();

if (!Engine.IsSupported) {
  status.className = 'error-status';
  status.textContent = 'This browser cannot start the 3D preview. Please enable WebGL or try another browser.';
} else {
  try {
    const engine = new Engine(canvas, true);
    const { scene, setRotating, setProfile, setAppearance, resize, feelSettings: reactToSettings, setTheme } = createWorkshopScene(engine);
    updateWorkshopTheme = setTheme; setTheme(theme);
    applyProfile = setProfile;
    feelSettings = reactToSettings;
    applyAppearance = setAppearance;
    applyIdentity = (name, id) => {
      const robot = scene.getTransformNodeByName('artbot')!;
      robot.metadata = { ...robot.metadata, name, id, record: history.current.record };
    };
    setAppearance(appearance);
    setProfile(profile);
    applyIdentity(history.current.name, history.current.id);
    const motionPreference = reducedMotionPreference();
    let rotating = !motionPreference.matches;

    function updateRotation() {
      setRotating(rotating);
      toggle.disabled = motionPreference.matches;
      const label = motionPreference.matches ? 'Reduced motion enabled' : rotating ? 'Pause rotation' : 'Resume rotation';
      toggle.textContent = rotating ? 'Ⅱ' : '▶';
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    }

    updateRotation();
    toggle.addEventListener('click', () => {
      rotating = !rotating;
      updateRotation();
    });

    const onMotionChange = () => {
      rotating = !motionPreference.matches;
      updateRotation();
    };
    motionPreference.addEventListener('change', onMotionChange);

    const observer = new ResizeObserver(() => {
      if (!inCity && !inAttract && !inExhibition) { engine.resize(); resize(); }
    });
    observer.observe(canvas);
    resize();
    resizeWorkshop = () => { engine.resize(); resize(); };
    scene.onAfterRenderObservable.addOnce(() => {
      status.textContent = 'Preview ready.';
    });
    engine.runRenderLoop(() => { if (!inCity && !inAttract && !inExhibition && !document.hidden) scene.render(); });

    import.meta.hot?.dispose(() => {
      observer.disconnect();
      motionPreference.removeEventListener('change', onMotionChange);
      scene.dispose();
      engine.dispose();
    });
  } catch (error) {
    status.className = 'error-status';
    status.textContent = 'The 3D preview could not start. Please reload or try another browser.';
    console.error('Babylon.js initialization failed:', error);
  }
}
