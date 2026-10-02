import { downloadMagentaModel, hasSavedMagentaModel } from '../audio/magentaModelCache';
import { magentaAccompaniment } from '../audio/MagentaAccompaniment';
import './musicSetup.css';

/** The start screen is mounted only after saved model files and inference are ready. */
export async function requireMusicModel(app: HTMLElement): Promise<void> {
  app.innerHTML = `<main class="music-setup" aria-labelledby="music-setup-title">
    <section class="music-setup-card"><span class="music-setup-brand">✳ INCLUSIVE CITY</span>
    <h1 id="music-setup-title">Give your artbot a musical imagination</h1>
    <p>Download the AI music model to enrich your robot’s music. It runs on your device and is saved here for future visits.</p>
    <progress id="music-model-progress" aria-label="Music model download progress" hidden></progress>
    <p id="music-model-status" role="status" aria-live="polite">Checking for your saved music model…</p>
    <button id="music-model-download" type="button" hidden>Download music model</button>
    </section></main>`;
  const button = app.querySelector<HTMLButtonElement>('#music-model-download')!;
  const status = app.querySelector<HTMLElement>('#music-model-status')!;
  const progress = app.querySelector<HTMLProgressElement>('#music-model-progress')!;
  const heading = app.querySelector<HTMLElement>('#music-setup-title')!;
  heading.tabIndex = -1; heading.focus();
  await new Promise<void>(resolve => {
    let busy = false;
    const start = async (download: boolean) => {
      if (busy) return;
      busy = true; button.disabled = true;
      try {
        if (download) {
          if (!('caches' in globalThis) || !isSecureContext) throw new Error('This browser cannot save the music model. Open the app over HTTPS in a browser with site storage enabled.');
          status.textContent = 'Downloading and saving your music model…'; progress.hidden = false;
          const persistence = navigator.storage?.persist?.().catch(() => false);
          await downloadMagentaModel(({ completed, total }) => {
            progress.max = total; progress.value = completed;
            status.textContent = `Saving your music model · ${completed} of ${total} files`;
          });
          await persistence;
        }
        progress.hidden = true; status.textContent = 'Starting your saved music model…';
        await magentaAccompaniment.initialize();
        resolve();
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : 'The music model could not be saved. Please retry.';
        button.textContent = 'Retry music setup'; button.hidden = false; button.disabled = false;
        progress.hidden = true; busy = false; button.focus();
      }
    };
    button.addEventListener('click', () => { void start(true); });
    void hasSavedMagentaModel().then(saved => {
      if (saved) void start(false);
      else { status.textContent = 'Download once to get started. Future visits use your saved model.'; button.hidden = false; }
    }).catch(() => { status.textContent = 'Download the music model to get started.'; button.hidden = false; });
  });
}
