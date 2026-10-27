import { CityVoiceReply } from '../audio/CityVoiceReply';
import type { VoiceFactory } from '../audio/CityVoiceReply';
import { CitySpokenCommand } from '../audio/CitySpokenCommand';
import type { CommandCallbacks, CommandController } from '../audio/CitySpokenCommand';
import { spokenTools, validateSpokenCall } from './citySpokenActions';
import type { SpokenChoice } from './citySpokenActions';
import type { CityReply } from './cityReply';
import { readVoiceCommandModel, onVoiceCommandModelChange } from '../audio/voiceCommandSettings';
import { onMicrophoneChange } from '../audio/microphone';

export function mountCityVoicePanel(container: HTMLElement, options: {
  context(): string; choices(): SpokenChoice[]; submit(text: string): string; capture(active: boolean): void;
  interpret(text: string): CityReply; dictationFactory?: VoiceFactory;
  commandFactory?: (callbacks: CommandCallbacks) => CommandController;
}) {
  container.innerHTML = `<div class="city-reply-heading">
    <p data-reply-sentence role="status" aria-live="polite">Tell me what you would like to change.</p>
    </div>
    <form class="city-prompt-row"><label class="sr-only" for="city-reply-text">City prompt</label>
      <textarea id="city-reply-text" rows="2" maxlength="500" placeholder="Type a change…"></textarea><button class="secondary" type="submit" data-reply-send>Send</button>
    <button class="secondary" id="city-record-voice" type="button" data-reply-talk aria-label="Hold to talk" title="Hold to talk; release to finish" aria-pressed="false">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" fill="none" stroke="currentColor" stroke-width="2"/></svg>
      <span>Hold to talk</span>
    </button></form>
    <p data-reply-status role="status" aria-live="polite">Hold the mic to speak. Focus the prompt to dictate into it.</p>
    <p data-command-transcript aria-label="Spoken command transcript"></p>
    <div data-reply-proposal hidden><p data-reply-proposal-text></p><div class="city-reply-buttons"><button class="secondary" type="button" data-reply-confirm>Apply</button><button class="secondary" type="button" data-reply-dismiss>Discard</button></div></div>
    <div class="city-reply-buttons" data-reply-choices aria-label="Suggested changes"></div>
    <p data-reply-result role="status" aria-live="polite"></p>`;
  const get = <T extends HTMLElement>(selector: string) => container.querySelector<T>(selector)!;
  const mic = get<HTMLButtonElement>('[data-reply-talk]'), textarea = get<HTMLTextAreaElement>('textarea');
  const result = get('[data-reply-result]'), status = get('[data-reply-status]'), proposal = get('[data-reply-proposal]');
  let disposed = false, held = false, promptIntent = false, context = '', previous = '', mode: 'prompt' | 'command' | 'neu' = 'command';
  let base = '', choices: SpokenChoice[] = [], turnChoices: SpokenChoice[] = [];
  let proposed: { text: string; actionKey: string; choiceName?: string } | undefined;
  function clearProposal() { proposed = undefined; proposal.hidden = true; }
  function submit(text: string) { clearProposal(); result.textContent = options.submit(text); status.textContent = 'Microphone off.'; }
  function propose(text: string, choiceName?: string) {
    if (disposed || context !== options.context()) { if (!disposed) result.textContent = 'The situation changed. Try the current barrier.'; return; }
    const reply = options.interpret(text);
    if (!reply.action) { submit(text); return; }
    proposed = { text, actionKey: JSON.stringify(reply.action), choiceName }; proposal.hidden = false;
    get('[data-reply-proposal-text]').textContent = `Heard: “${text}”. Apply this change?`;
    status.textContent = 'Microphone off. Review the change.';
  }
  function active() {
    if (disposed) return;
    const busy = speech.busy || neu.busy, listening = speech.listening || neu.listening;
    mic.disabled = busy && !held; mic.setAttribute('aria-pressed', String(held));
    mic.setAttribute('aria-label', held ? 'Listening — release to finish' : 'Hold to talk');
    container.dataset.listening = String(listening); options.capture(busy);
  }
  const speech = new CityVoiceReply({
    status: text => { if (!disposed) status.textContent = text.startsWith('Listening') ? 'Listening… release the mic to finish.' : text; }, active,
    transcript: text => {
      if (disposed || context !== options.context()) return;
      if (mode === 'prompt') { if (text) textarea.value = [base, text].filter(Boolean).join(' '); }
      else get('[data-command-transcript]').textContent = text;
    },
    submit: text => {
      if (disposed || context !== options.context()) return;
      if (mode === 'prompt') {
        textarea.value = [base, text].filter(Boolean).join(' ');
        status.textContent = textarea.value.length > 500 ? 'Shorten your prompt to under 500 characters before sending.' : 'Microphone off. Send when ready.';
      } else propose(text);
    },
  }, options.dictationFactory);
  const neu = (options.commandFactory ?? (callbacks => new CitySpokenCommand(callbacks)))({
    status: text => { if (!disposed) status.textContent = text.startsWith('Listening') ? 'Listening… release the mic to finish.' : text; }, active,
    result: calls => {
      if (disposed || context !== options.context()) return;
      const choice = validateSpokenCall(calls, turnChoices);
      if (choice) propose(choice.phrase, choice.name);
      else result.textContent = 'Try one suggested change or type a prompt.';
    },
  });
  function stop() {
    held = false; speech.cancel(); neu.cancel(); clearProposal();
    if (!disposed) status.textContent = 'Microphone off.';
  }
  function hold() {
    if (disposed || held || speech.busy || neu.busy) return;
    clearProposal(); held = true; context = options.context(); turnChoices = options.choices();
    const focused = textarea.ownerDocument.activeElement;
    mode = focused === textarea || promptIntent && focused === mic ? 'prompt' : readVoiceCommandModel() === 'neudecide' ? 'neu' : 'command';
    base = textarea.value.trim(); get('[data-command-transcript]').textContent = '';
    if (mode === 'neu') void neu.start(spokenTools(turnChoices)); else void speech.start();
    active();
  }
  function release() {
    if (!held) return;
    held = false;
    if (mode === 'neu' && neu.listening) neu.finish();
    else if (mode !== 'neu' && speech.listening) void speech.finish();
    else { stop(); status.textContent = 'Released before the microphone was ready. Hold again to speak.'; }
    active();
  }
  mic.addEventListener('pointerdown', event => { if (event.button !== 0) return; event.preventDefault(); mic.setPointerCapture(event.pointerId); hold(); });
  mic.addEventListener('pointerup', release); mic.addEventListener('lostpointercapture', release);
  mic.addEventListener('pointercancel', stop);
  mic.addEventListener('keydown', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); if (!event.repeat) hold(); } });
  mic.addEventListener('keyup', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); release(); } });
  mic.addEventListener('blur', () => { if (held) stop(); });
  textarea.addEventListener('focus', () => { promptIntent = true; });
  textarea.addEventListener('blur', () => { queueMicrotask(() => { if (!held && textarea.ownerDocument.activeElement !== mic) promptIntent = false; }); });
  textarea.addEventListener('input', () => { if (speech.busy && mode === 'prompt') stop(); });
  textarea.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault(); get<HTMLFormElement>('form').requestSubmit();
    }
  });
  container.addEventListener('keydown', event => { if (event.key === 'Escape') stop(); });
  get<HTMLFormElement>('form').addEventListener('submit', event => { event.preventDefault(); const text = textarea.value; stop(); submit(text); });
  get<HTMLButtonElement>('[data-reply-confirm]').addEventListener('click', () => {
    if (proposed && context === options.context() && (!proposed.choiceName || options.choices().some(c => c.name === proposed!.choiceName))
      && JSON.stringify(options.interpret(proposed.text).action) === proposed.actionKey) submit(proposed.text);
    else { clearProposal(); result.textContent = 'The situation changed. Choose a current change.'; }
  });
  get<HTMLButtonElement>('[data-reply-dismiss]').addEventListener('click', clearProposal);
  const unsubscribeMic = onMicrophoneChange(stop), unsubscribeModel = onVoiceCommandModelChange(stop);
  return {
    sentence(text: string) { const sentence = get('[data-reply-sentence]'); if (sentence.textContent !== text) sentence.textContent = text; },
    update() {
      const next = options.context(); if (next === previous && choices.length) return;
      if (speech.busy || neu.busy || proposed) stop(); previous = next; choices = options.choices();
      get('[data-reply-choices]').replaceChildren(...choices.map(choice => {
        const button = document.createElement('button'); button.classList.add('secondary'); button.type = 'button'; button.textContent = choice.phrase;
        button.title = choice.variations?.join(' · ') ?? choice.phrase;
        if (choice.variations?.length) {
          const alternate = document.createElement('span'); alternate.className = 'city-command-variations';
          alternate.textContent = `Also say: ${choice.variations[0]}`; button.append(alternate);
        }
        button.addEventListener('click', () => { stop(); submit(choice.phrase); }); return button;
      }));
    }, stop, dispose() { stop(); unsubscribeMic(); unsubscribeModel(); disposed = true; },
  };
}
