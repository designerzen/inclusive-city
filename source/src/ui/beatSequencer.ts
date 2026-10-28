import type { CitySounds, MusicPlayback } from '../audio/CitySounds';
import { jamEffect, jamPads } from '../audio/exhibitionJam';
import { beatStep, upcomingBeatSteps } from '../audio/beatSequencer';

export function mountBeatSequencer(host: HTMLElement, sounds: CitySounds, start: () => void) {
  host.innerHTML = `
    <div class="beat-heading"><div><strong>Make a beat</strong><span>Tap the lights. Build your loop.</span></div>
      <div class="beat-actions"><button type="button" class="secondary" data-groove>Try a groove</button><button type="button" class="tertiary" data-clear>Clear</button></div></div>
    <div class="beat-scroll" tabindex="0" role="region" aria-label="Beat sequencer. Scroll for more steps on small screens.">
      <div class="beat-grid"></div>
    </div>
    <p class="beat-hint" role="status">Lights on = sound. Your beat repeats with the song.</p>`;
  const grid = host.querySelector<HTMLElement>('.beat-grid')!;
  const hint = host.querySelector<HTMLElement>('.beat-hint')!;
  let bpm = 120, steps = 8, duration = 0, pattern: boolean[][] = [];
  let buttons: HTMLButtonElement[] = [], columns: HTMLElement[] = [];
  let playbackClock: (() => number) | undefined;
  let lastScheduled = -1, timer = 0, frame = 0, current = -1;
  const pending = new Map<number, MusicPlayback>();
  function syncButtons() {
    buttons.forEach((button, index) => button.setAttribute('aria-pressed', String(pattern[Math.floor(index / steps)]![index % steps])));
  }
  function cancelFuture() {
    const now = sounds.musicTime(bpm);
    for (const [step, handle] of pending) {
      if (step * 30 / bpm >= now) { handle.stop(); pending.delete(step); }
    }
    lastScheduled = Math.floor(beatStep(now, bpm));
  }
  function pump() {
    if (!playbackClock || document.hidden) return;
    const now = sounds.musicTime(bpm);
    for (const [step] of pending) if (step * 30 / bpm < now - 1) pending.delete(step);
    for (const step of upcomingBeatSteps(now, bpm, lastScheduled, duration)) {
      lastScheduled = step;
      const entries = jamPads.flatMap((pad, row) => pattern[row]![step % steps]
        ? [{ at: step * 30 / bpm, label: 'percussion:jam-sequencer', score: jamEffect(pad.midi, 85, true).toScore() }] : []);
      if (entries.length) {
        const handle = sounds.performLive(entries);
        if (handle) pending.set(step, handle);
      }
    }
  }
  function animate() {
    if (!playbackClock) return;
    const at = beatStep(playbackClock(), bpm), next = Math.floor(at) % steps;
    if (next !== current) {
      current = next;
      columns.forEach((column, index) => column.classList.toggle('is-current', index % steps === current));
    }
    grid.style.setProperty('--beat-position', String((at % steps) / steps));
    frame = requestAnimationFrame(animate);
  }
  function changed() {
    syncButtons();
    if (playbackClock) { cancelFuture(); pump(); }
    else if (pattern.some(row => row.some(Boolean))) start();
  }
  host.querySelector('[data-groove]')!.addEventListener('click', () => {
    pattern = jamPads.map((_, row) => Array.from({ length: steps }, (_, step) =>
      row === 0 ? step % 4 === 0 : row === 1 ? step % 4 === 2 : row === 2 ? step % 2 === 0 : step === steps - 1));
    hint.textContent = 'A groove to get you started. Tap any light to make it yours.';
    changed();
  });
  host.querySelector('[data-clear]')!.addEventListener('click', () => {
    pattern.forEach(row => row.fill(false)); changed();
    hint.textContent = 'A fresh loop. Tap a light to add a sound.';
  });
  function stop() {
    playbackClock = undefined; clearInterval(timer); cancelAnimationFrame(frame);
    pending.forEach(handle => handle.stop()); pending.clear(); lastScheduled = -1; current = -1;
    columns.forEach(column => column.classList.remove('is-current'));
    host.classList.remove('is-running');
  }
  return {
    configure(tempo: number, beats: number, seconds: number) {
      stop(); bpm = tempo; steps = beats * 2; duration = seconds;
      pattern = jamPads.map(() => Array<boolean>(steps).fill(false));
      grid.style.setProperty('--beat-steps', String(steps));
      grid.innerHTML = `<div class="beat-ruler"><span class="beat-row-label">BEAT</span><div class="beat-track"><i class="beat-playhead" aria-hidden="true"></i>${Array.from({ length: steps }, (_, step) => `<span class="beat-tick">${step % 2 ? '&' : step / 2 + 1}</span>`).join('')}</div></div>`
        + jamPads.map((pad, row) => `<div class="beat-row" style="--beat-color: ${['#ffb781', '#d6adff', '#86efce', '#8bcaff'][row]}"><span class="beat-row-label">${pad.name}</span>${Array.from({ length: steps }, (_, step) => `<button type="button" class="beat-pad" data-row="${row}" data-step="${step}" aria-label="${pad.name}, beat ${Math.floor(step / 2) + 1}${step % 2 ? ' and' : ''}" aria-pressed="false"><span class="beat-pad-face" aria-hidden="true"><span>${step % 2 ? '·' : step / 2 + 1}</span></span></button>`).join('')}</div>`).join('');
      buttons = [...grid.querySelectorAll<HTMLButtonElement>('.beat-pad')];
      columns = [...grid.querySelectorAll<HTMLElement>('.beat-tick'), ...buttons];
      buttons.forEach(button => {
        button.disabled = !sounds.supported;
        button.addEventListener('click', () => {
          const row = Number(button.dataset.row), step = Number(button.dataset.step);
          pattern[row]![step] = !pattern[row]![step]; changed();
          hint.textContent = `${jamPads[row]!.name}, beat ${Math.floor(step / 2) + 1}${step % 2 ? ' and' : ''}: ${pattern[row]![step] ? 'on' : 'off'}.`;
        });
      });
      host.querySelectorAll<HTMLButtonElement>('.beat-actions button').forEach(button => { button.disabled = !sounds.supported; });
      hint.textContent = 'Lights on = sound. Your beat repeats with the song.';
    },
    start(clock: () => number) {
      stop(); playbackClock = clock; host.classList.add('is-running'); pump(); animate();
      timer = window.setInterval(pump, 25);
    },
    setDuration(seconds: number) { duration = seconds; },
    stop,
  };
}
