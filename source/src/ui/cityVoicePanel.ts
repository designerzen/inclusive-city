import { CityVoiceReply } from '../audio/CityVoiceReply';

export function mountCityVoicePanel(container: HTMLElement, options: {
  context(): string; submit(text: string): string; capture(active: boolean): void;
}) {
  container.innerHTML = `<h3>Reply to your robot</h3>
    <p>Say what you would like to change, or ask why the robot is stuck.</p>
    <div class="city-reply-buttons"><button type="button" data-reply-talk>Talk to your robot</button><button type="button" data-reply-done disabled>Done</button><button type="button" data-reply-cancel disabled>Cancel</button></div>
    <p data-reply-status role="status" aria-live="polite">Voice runs on your device. First use downloads a model.</p>
    <p data-reply-transcript aria-label="Live transcript"></p>
    <form><label for="city-reply-text">Type your reply</label><textarea id="city-reply-text" rows="2" maxlength="500" placeholder="For example: add a ramp"></textarea><button type="submit">Send reply</button></form>
    <p data-reply-result role="status" aria-live="polite"></p>`;
  const talk = container.querySelector<HTMLButtonElement>('[data-reply-talk]')!;
  const done = container.querySelector<HTMLButtonElement>('[data-reply-done]')!;
  const cancel = container.querySelector<HTMLButtonElement>('[data-reply-cancel]')!;
  const textarea = container.querySelector<HTMLTextAreaElement>('textarea')!;
  const result = container.querySelector<HTMLElement>('[data-reply-result]')!;
  const status = container.querySelector<HTMLElement>('[data-reply-status]')!;
  let voiceContext = '', disposed = false;
  function submit(text: string) {
    if (disposed) return;
    result.textContent = options.submit(text);
  }
  const voice = new CityVoiceReply({
    status: text => { if (!disposed) status.textContent = text; },
    transcript: text => { if (!disposed) container.querySelector('[data-reply-transcript]')!.textContent = text; },
    active: active => {
      if (disposed) return;
      talk.disabled = active; done.disabled = !voice.listening; cancel.disabled = !active;
      container.dataset.listening = String(voice.listening); options.capture(active);
    },
    submit: text => {
      if (voiceContext !== options.context()) { result.textContent = 'The robot’s situation changed. Please reply to the current barrier.'; return; }
      textarea.value = text; submit(text);
    },
  });
  talk.addEventListener('click', () => { voiceContext = options.context(); void voice.start(); });
  done.addEventListener('click', () => { void voice.finish(); });
  function stop() { if (voice.busy) { voice.cancel(); status.textContent = 'Microphone off. No voice reply submitted.'; } }
  cancel.addEventListener('click', stop);
  container.addEventListener('keydown', event => { if (event.key === 'Escape' && voice.busy) { stop(); talk.focus(); } });
  container.querySelector('form')!.addEventListener('submit', event => { event.preventDefault(); if (voice.busy) stop(); submit(textarea.value); });
  let previous = options.context();
  return {
    update() { const next = options.context(); if (next !== previous) { if (voice.busy) stop(); previous = next; } },
    stop,
    dispose() { stop(); disposed = true; },
  };
}
