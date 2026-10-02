import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { createRobot } from '../robot/createRobot';
import type { ArtBot } from '../robot/botHistory';
import type { ScreenSpeech } from '../audio/ScreenSpeech';

/** A separate copy of the robot: explaining never moves the robot on the map. */
export function mountRobotGuide(container: HTMLElement, speech?: ScreenSpeech) {
  container.innerHTML = `<div class="robot-guide-portrait"><canvas aria-hidden="true" tabindex="-1"></canvas><span class="robot-guide-badge">YOUR ROBOT</span></div><div class="robot-guide-dialogue"><strong class="robot-guide-name"></strong><p class="robot-guide-copy" role="status" aria-live="polite" aria-atomic="true"></p><button class="robot-guide-replay" type="button" aria-label="Read robot explanation again">▶ Read aloud</button></div>`;
  const canvas = container.querySelector('canvas')!;
  const copy = container.querySelector<HTMLElement>('.robot-guide-copy')!;
  const replay = container.querySelector<HTMLButtonElement>('button')!;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let engine: Engine | null = null, scene: Scene | null = null;
  let model: ReturnType<typeof createRobot> | null = null;
  let camera: UniversalCamera | null = null, bot: ArtBot | null = null;
  let frame = 0, lastFrame = 0, until = 0, ownsSpeech = false, disposed = false;
  function updateReplay() {
    replay.hidden = !speech?.supported;
    replay.disabled = !speech?.canSpeak;
    replay.textContent = ownsSpeech ? '■ Stop reading' : '▶ Read aloud';
    replay.setAttribute('aria-label', ownsSpeech ? 'Stop reading robot explanation' : 'Read robot explanation again');
    replay.title = speech?.canSpeak ? 'Read or stop this explanation' : 'Enable spoken guidance in Options and turn sound on';
  }
  const unsubscribe = speech?.subscribeSettings(updateReplay);
  function resize() {
    if (!engine || !camera || container.hidden) return;
    engine.resize();
    const height = Math.max(1.65 * (bot?.appearance.height ?? 1), 1.8 * (bot?.appearance.width ?? 1) / (canvas.clientWidth / Math.max(1, canvas.clientHeight)));
    camera.orthoTop = height / 2; camera.orthoBottom = -height / 2;
    camera.orthoRight = height * canvas.clientWidth / Math.max(1, canvas.clientHeight) / 2;
    camera.orthoLeft = -camera.orthoRight;
    scene?.render();
  }
  function settle() {
    cancelAnimationFrame(frame); frame = 0; until = 0;
    model?.setSpeaking(false); model?.animateTravel(0, .1, reducedMotion.matches);
    if (!container.hidden && !document.hidden) scene?.render();
  }
  function tick(now: number) {
    if (disposed || container.hidden || document.hidden || now >= until) { settle(); return; }
    if (now - lastFrame >= 33) {
      model?.animateTravel(0, Math.min(.1, (now - lastFrame) / 1000), reducedMotion.matches);
      scene?.render(); lastFrame = now;
    }
    frame = requestAnimationFrame(tick);
  }
  function animate(duration: number) {
    settle(); model?.setSpeaking(true);
    if (reducedMotion.matches) return;
    until = performance.now() + duration; lastFrame = performance.now();
    frame = requestAnimationFrame(tick);
  }
  function stop() {
    if (ownsSpeech) speech?.stop(); ownsSpeech = false; settle(); updateReplay();
  }
  function read() {
    stop();
    if (speech?.canSpeak) {
      ownsSpeech = speech.say(copy.textContent ?? '', () => animate(120_000), () => { ownsSpeech = false; settle(); updateReplay(); });
      updateReplay();
    } else animate(Math.min(12_000, Math.max(3_000, (copy.textContent?.length ?? 0) * 40)));
  }
  function show(next: ArtBot, message: string) {
    container.hidden = false;
    updateReplay();
    if (!engine) {
      try {
        engine = new Engine(canvas, true, { alpha: true, preserveDrawingBuffer: false, stencil: false });
        engine.setHardwareScalingLevel(Math.max(1, devicePixelRatio));
        scene = new Scene(engine); scene.clearColor = new Color4(0, 0, 0, 0);
        camera = new UniversalCamera('guide-camera', new Vector3(0, 3.4, -8), scene);
        camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
        new HemisphericLight('guide-light', new Vector3(-.5, 1, -1), scene).intensity = 1.3;
        model = createRobot(scene);
      } catch { engine?.dispose(); engine = null; canvas.hidden = true; }
    }
    if (bot !== next) {
      bot = next; model?.setAppearance(next.appearance); model?.setProfile(next.profile);
      if (model) model.characterAnimation.mood = 'happy';
      const y = 1.05 + 2.35 * next.appearance.height;
      if (camera) { camera.position.set(0, y, -8); camera.setTarget(new Vector3(0, y, 0)); }
      container.querySelector('.robot-guide-name')!.textContent = next.name;
    }
    resize();
    if (copy.textContent !== message) { copy.textContent = message; read(); }
  }
  function hide() { stop(); container.hidden = true; copy.textContent = ''; }
  const observer = new ResizeObserver(resize); observer.observe(canvas);
  const visibility = () => { if (document.hidden) stop(); };
  document.addEventListener('visibilitychange', visibility);
  reducedMotion.addEventListener('change', settle);
  replay.addEventListener('click', () => { if (ownsSpeech) stop(); else read(); });
  return { show, hide, stop, dispose() { disposed = true; stop(); unsubscribe?.(); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); reducedMotion.removeEventListener('change', settle); scene?.dispose(); engine?.dispose(); } };
}
