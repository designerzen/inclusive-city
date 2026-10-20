import '../../src/styles.css';
import '../../src/lightTheme.css';
import '../../src/cityHud.css';
import '../../src/uiDesign.css';
import '../../src/accessibility.css';
import '../../src/cityCompactHud.css';
import '../../src/cityVoice.css';
import '../../src/environmentChoices.css';
import { Engine } from '@babylonjs/core/Engines/engine';
import { mountCityScreen } from '../../src/ui/cityScreen';
import { CitySounds } from '../../src/audio/CitySounds';
import { BotHistory } from '../../src/robot/botHistory';
import { reducedMotionPreference } from '../../src/app/accessibilityPreferences';
import { mountButtonIcons } from '../../src/ui/buttonIcons';

// Exercise the actual city HUD and Web Audio with procedural fallback, without model downloads.
const canvas = document.createElement('canvas');
const engine = new Engine(canvas, true);
const sounds = new CitySounds();
const options = new URLSearchParams(location.search);
if (options.has('reduced-motion')) reducedMotionPreference().setReduced(true);
if (options.has('muted')) sounds.setMuted(true);
const screen = mountCityScreen(document.querySelector('#city-screen')!, sounds, engine, canvas, () => {});
screen.enter(new BotHistory(['Curie', 'Einstein']).current);
mountButtonIcons(document.body);
const meeting = document.createElement('button');
meeting.textContent = 'Test robot meeting';
meeting.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:40';
meeting.addEventListener('click', () => {
  const journey = engine.scenes[0]!.metadata.journey;
  const position = journey.position;
  journey.nearbyRobots = () => [{ id: 'city-bot-1', name: 'City robot 1', buttonReach: 1.5, position }];
  if (journey.ready) journey.start();
  if (journey.paused) journey.setPaused(false);
  journey.update(.001);
  meeting.hidden = true;
});
document.body.append(meeting);
const discovery = document.createElement('button');
discovery.textContent = 'Test gallery discovery';
discovery.style.cssText = 'position:fixed;left:16px;bottom:70px;z-index:40';
discovery.addEventListener('click', () => {
  const journey = engine.scenes[0]!.metadata.journey;
  const building = journey.world.buildings.find((b: { creativeRole?: string }) => b.creativeRole === 'gallery');
  journey.machine.emit('building_encounter', { id: building.name, kind: 'gallery' });
});
document.body.append(discovery);
window.addEventListener('pagehide', () => { screen.dispose(); sounds.dispose(); engine.dispose(); });
