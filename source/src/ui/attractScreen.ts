import { reducedMotionPreference } from '../app/accessibilityPreferences';
import { Engine } from '@babylonjs/core/Engines/engine';
import { createAttractScene } from '../app/createAttractScene';
import { createAttractScore, attractLoopSeconds } from '../audio/attractMusic';
import type { CitySounds } from '../audio/CitySounds';

export function mountAttractScreen(container: HTMLElement, sounds: CitySounds, enter: () => void) {
  container.innerHTML = `
    <div class="attract-cloud attract-cloud-pink" aria-hidden="true"></div>
    <div class="attract-cloud attract-cloud-mint" aria-hidden="true"></div>
    <div class="attract-grid" aria-hidden="true"></div>
    <header class="attract-brand"><span class="attract-brand-mark" aria-hidden="true">✳</span> INCLUSIVE CITY</header>
    <div class="attract-layout">
      <div class="attract-copy">
        <h1 id="attract-title">ART<span class="attract-title-star" aria-hidden="true">✳</span><br><span class="attract-title-bot">BOT.</span></h1>
        <p class="attract-tagline">Learn what life is like for a robot living in a city not designed for robots!</p>
        <button id="attract-enter" class="attract-enter primary-action" type="button">Create your robot <span aria-hidden="true">→</span></button>
      </div>
      <div class="attract-stage">
        <div class="attract-orbit attract-orbit-one" aria-hidden="true"></div>
        <div class="attract-orbit attract-orbit-two" aria-hidden="true"></div>
        <div class="attract-disc" aria-hidden="true"></div>
        <div class="attract-sparks" aria-hidden="true">${Array.from({ length: 16 }, (_, i) => `<i style="--i:${i};--x:${(i * 37 + 13) % 100}%;--y:${(i * 23 + 7) % 86}%"></i>`).join('')}</div>
        <span class="attract-sticker attract-sticker-music" aria-hidden="true">♫</span>
        <canvas id="attract-canvas" role="img" aria-label="A funky mint artbot dances, bobs its head and waves its arms on a glowing dance floor."></canvas>
        <div class="attract-fallback" aria-hidden="true"><span>▰</span><span>● ●</span><span>▰</span><span>◉ ◉</span></div>
      </div>
    </div>
    <footer class="attract-footer">
      <div class="attract-partner">
        <a class="attract-rix" href="https://www.rixinclusiveresearch.org/" target="_blank" rel="noopener noreferrer" aria-label="Visit Rix Inclusive Research (opens in a new tab)">
          <img src="${import.meta.env.BASE_URL}assets/logos/rix.svg" alt="Rix Inclusive Research" width="1410" height="420" />
        </a>
        <a class="attract-qr" href="https://www.rixinclusiveresearch.org/" target="_blank" rel="noopener noreferrer" aria-label="Visit Rix Inclusive Research (opens in a new tab)">
          <img src="${import.meta.env.BASE_URL}assets/logos/rix-qr.svg" alt="QR code for the Rix Inclusive Research website" width="120" height="120" />
        </a>
      </div>
      <div class="attract-controls">
        <button id="attract-music" type="button" aria-pressed="false"><span class="attract-equalizer" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span class="attract-music-label">Play soundtrack</span></button>
        <button id="attract-motion" type="button" aria-pressed="false">Pause animation</button>
      </div>
    </footer>`;
  const motion = reducedMotionPreference();
  const pause = container.querySelector<HTMLButtonElement>('#attract-motion')!;
  const music = container.querySelector<HTMLButtonElement>('#attract-music')!;
  const musicLabel = music.querySelector('.attract-music-label')!;
  const canvas = container.querySelector<HTMLCanvasElement>('#attract-canvas')!;
  const options = document.querySelector<HTMLElement>('#attract-options');
  options?.append(container.querySelector<HTMLElement>('.attract-controls')!);
  let paused = motion.matches;
  let leaveScene = () => {};
  let stopMusic: (() => void) | null = null;
  let left = false;
  function updateMotion() {
    container.classList.toggle('is-paused', paused);
    pause.setAttribute('aria-pressed', String(paused));
    pause.disabled = motion.matches;
    pause.textContent = motion.matches ? 'Reduced motion enabled' : paused ? 'Resume animation' : 'Pause animation';
  }
  updateMotion();
  const onMotion = () => { paused = motion.matches; updateMotion(); };
  motion.addEventListener('change', onMotion);
  pause.addEventListener('click', () => { paused = !paused; updateMotion(); });
  music.disabled = !sounds.supported;
  if (!sounds.supported) musicLabel.textContent = 'Sound unavailable';
  music.addEventListener('click', () => {
    sounds.unlock();
    if (stopMusic) { stopMusic(); stopMusic = null; }
    else stopMusic = sounds.loop(createAttractScore(), attractLoopSeconds);
    music.setAttribute('aria-pressed', String(!!stopMusic));
    musicLabel.textContent = stopMusic ? 'Stop soundtrack' : 'Play soundtrack';
    container.classList.toggle('has-music', !!stopMusic);
  });
  container.querySelector('#attract-enter')!.addEventListener('click', enter);
  if (Engine.IsSupported) {
    try {
      leaveScene = createAttractScene(canvas, () => paused);
      container.classList.add('has-robot');
    } catch (error) { console.error('Attract preview unavailable:', error); }
  }
  return {
    leave() {
      if (left) return;
      left = true;
      if (options) options.hidden = true;
      stopMusic?.(); stopMusic = null;
      leaveScene();
      motion.removeEventListener('change', onMotion);
    },
  };
}
