import { downloadMagentaModel, hasSavedMagentaModel } from '../audio/magentaModelCache';
import { downloadMoonshineModel, hasSavedMoonshineModel } from '../audio/moonshineModelCache';
import { magentaAccompaniment } from '../audio/MagentaAccompaniment';
import './musicSetup.css';

/** Check both caches before rendering: repeat visits never show the setup screen. */
export async function requireModels(app: HTMLElement): Promise<void> {
  let [musicSaved, speechSaved] = await Promise.all([
    hasSavedMagentaModel(), hasSavedMoonshineModel(),
  ]);
  if (musicSaved && speechSaved) {
    try { await magentaAccompaniment.initialize(); return; }
    catch { /* Show a retry screen if the saved music model cannot start. */ }
  }
  app.innerHTML = `<main class="music-setup" aria-labelledby="music-setup-title">
    <section class="music-setup-card"><span class="music-setup-brand">✳ INCLUSIVE CITY</span>
    <h1 id="music-setup-title">Getting your city ready</h1>
    <p>We’re downloading two AI models before the app starts: Magenta gives your artbot a musical imagination, and Moonshine turns your spoken replies into text.</p>
    <p>Both run on your device. The models are saved in this browser, so future visits skip this screen unless the saved files are cleared. Your microphone stays off until you choose to speak.</p>
    <progress id="music-model-progress" max="100" value="0" aria-label="Music and speech model setup progress" aria-describedby="music-model-status"></progress>
    <p id="music-model-status" role="status" aria-live="polite">Preparing model downloads…</p>
    <button id="music-model-download" type="button" hidden>Retry model setup</button>
    </section></main>`;
  const button = app.querySelector<HTMLButtonElement>('#music-model-download')!;
  const status = app.querySelector<HTMLElement>('#music-model-status')!;
  const progress = app.querySelector<HTMLProgressElement>('#music-model-progress')!;
  const heading = app.querySelector<HTMLElement>('#music-setup-title')!;
  heading.tabIndex = -1; heading.focus();
  await new Promise<void>(resolve => {
    let busy = false;
    const start = async () => {
      if (busy) return;
      busy = true; button.disabled = true; progress.value = 0;
      const update = (value: number, text: string) => {
        progress.value = Math.max(progress.value, value);
        // Announce stages rather than every incoming chunk to screen readers.
        if (status.textContent !== text) status.textContent = text;
      };
      try {
        if (!('caches' in globalThis) || !isSecureContext) throw new Error('This browser cannot save the models. Open the app over HTTPS with site storage enabled.');
        void navigator.storage?.persist?.().catch(() => false);
        if (!musicSaved) {
          update(0, 'Step 1 of 2: downloading and saving Magenta for music…');
          await downloadMagentaModel(({ completed, total }) => update(45 * completed / total, 'Step 1 of 2: downloading and saving Magenta for music…'));
          musicSaved = true;
        }
        update(45, 'Step 2 of 2: downloading and saving Moonshine for spoken replies…');
        if (!speechSaved) {
          await downloadMoonshineModel(fraction => update(45 + 50 * fraction, 'Step 2 of 2: downloading and saving Moonshine for spoken replies…'));
          speechSaved = true;
        }
        update(95, 'Both models are saved. Starting your city…');
        await magentaAccompaniment.initialize();
        update(100, 'Ready! Opening Inclusive City…');
        resolve();
      } catch (error) {
        status.textContent = `${error instanceof Error ? error.message : 'Model setup could not finish.'} Successfully saved files are kept; retry to continue.`;
        button.hidden = false; button.disabled = false; busy = false; button.focus();
      }
    };
    button.addEventListener('click', () => { void start(); });
    void start();
  });
}
