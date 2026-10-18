import '../../src/styles.css';
import '../../src/lightTheme.css';
import '../../src/cityHud.css';
import '../../src/uiDesign.css';
import '../../src/accessibility.css';
import '../../src/cityCompactHud.css';
import '../../src/cityVoice.css';
import { Engine } from '@babylonjs/core/Engines/engine';
import { mountCityScreen } from '../../src/ui/cityScreen';
import { CitySounds } from '../../src/audio/CitySounds';
import { BotHistory } from '../../src/robot/botHistory';

// Exercise the actual city HUD and Web Audio with procedural fallback, without model downloads.
const canvas = document.createElement('canvas');
const engine = new Engine(canvas, true);
const sounds = new CitySounds();
const screen = mountCityScreen(document.querySelector('#city-screen')!, sounds, engine, canvas, () => {});
screen.enter(new BotHistory(['Curie', 'Einstein']).current);
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
window.addEventListener('pagehide', () => { screen.dispose(); sounds.dispose(); engine.dispose(); });
