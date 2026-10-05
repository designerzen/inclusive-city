import { reducedMotionPreference } from '../app/accessibilityPreferences';
import type { ArtBot } from '../robot/botHistory';
import type { ScreenSpeech } from '../audio/ScreenSpeech';

/** Guidance can borrow the visible robot; it never owns a renderer or a clone. */
export interface RobotGuidePortrait {
  setBot(bot: ArtBot): void;
  setSpeaking(value: boolean): void;
  animateTravel(distance: number, seconds: number, reducedMotion: boolean): void;
  render(): void;
  resize(): void;
}
export function mountRobotGuide(container: HTMLElement, speech?: ScreenSpeech, portrait?: RobotGuidePortrait) {
  container.innerHTML = `<div class="robot-guide-portrait"><span class="robot-guide-badge">YOUR ROBOT</span></div><div class="robot-guide-dialogue"><strong class="robot-guide-name"></strong><p class="robot-guide-copy" role="status" aria-live="polite" aria-atomic="true"></p><button class="robot-guide-replay" type="button" aria-label="Read robot explanation again">▶ Read aloud</button></div>`;
  const copy = container.querySelector<HTMLElement>('.robot-guide-copy')!;
  const replay = container.querySelector<HTMLButtonElement>('button')!;
  const reducedMotion = reducedMotionPreference();
  let bot: ArtBot | null = null;
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
    if (container.hidden) return;
    portrait?.resize();
  }
  function settle() {
    cancelAnimationFrame(frame); frame = 0; until = 0;
    portrait?.setSpeaking(false); portrait?.animateTravel(0, .1, reducedMotion.matches);
    if (!container.hidden && !document.hidden) portrait?.render();
  }
  function tick(now: number) {
    if (disposed || container.hidden || document.hidden || now >= until) { settle(); return; }
    if (now - lastFrame >= 33) {
      portrait?.animateTravel(0, Math.min(.1, (now - lastFrame) / 1000), reducedMotion.matches);
      portrait?.render(); lastFrame = now;
    }
    frame = requestAnimationFrame(tick);
  }
  function animate(duration: number) {
    settle(); portrait?.setSpeaking(true);
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
    if (bot !== next) {
      bot = next; portrait?.setBot(next);
      container.querySelector('.robot-guide-name')!.textContent = next.name;
    }
    resize();
    if (copy.textContent !== message) { copy.textContent = message; read(); }
  }
  function hide() { stop(); container.hidden = true; copy.textContent = ''; }
  const observer = new ResizeObserver(resize); observer.observe(container);
  const visibility = () => { if (document.hidden) stop(); };
  document.addEventListener('visibilitychange', visibility);
  reducedMotion.addEventListener('change', settle);
  replay.addEventListener('click', () => { if (ownsSpeech) stop(); else read(); });
  return { show, hide, stop, dispose() { disposed = true; stop(); unsubscribe?.(); observer.disconnect(); document.removeEventListener('visibilitychange', visibility); reducedMotion.removeEventListener('change', settle); } };
}
