import { CityVoiceReply } from '../audio/CityVoiceReply';
import type { VoiceFactory } from '../audio/CityVoiceReply';
import { CitySpokenCommand } from '../audio/CitySpokenCommand';
import type { CommandCallbacks, CommandController } from '../audio/CitySpokenCommand';
import { spokenTools, validateSpokenCall } from './citySpokenActions';
import type { SpokenChoice } from './citySpokenActions';
import type { CityReply } from './cityReply';
import { readVoiceCommandModel, saveVoiceCommandModel } from '../audio/voiceCommandSettings';
import type { VoiceCommandModel } from '../audio/voiceCommandSettings';

export function mountCityVoicePanel(container: HTMLElement, options: {
  context(): string; choices(): SpokenChoice[]; submit(text: string): string; capture(active: boolean): void;
  interpret(text: string): CityReply;
  dictationFactory?: VoiceFactory;
  commandFactory?: (callbacks: CommandCallbacks) => CommandController;
}) {
  container.innerHTML = `<h3>Tell the city what to change</h3>
    <p>Choose a change below, or say it out loud using Speak a city command.</p>
    <label for="city-command-model">Spoken command model</label>
    <select id="city-command-model"><option value="moonshine">Moonshine — transcription to action</option><option value="neudecide">NeuDecide — private model files required</option></select>
    <p>Both process speech on this device. Prompt dictation always uses Moonshine.</p>
    <div class="city-reply-buttons" data-reply-choices aria-label="Changes you can say or choose"></div>
    <div class="city-reply-buttons"><button type="button" data-reply-talk>Speak a city command</button><button type="button" data-reply-done disabled>Done</button><button type="button" data-reply-cancel disabled>Cancel</button></div>
    <p data-reply-status role="status" aria-live="polite">Speech stays on this device. First use downloads a model.</p>
    <p data-command-transcript aria-label="Spoken command transcript"></p>
    <div data-reply-proposal hidden><p data-reply-proposal-text></p><button type="button" data-reply-confirm>Apply this change</button><button type="button" data-reply-dismiss>Discard</button></div>
    <form><label for="city-reply-text">City prompt — focus here to dictate</label><textarea id="city-reply-text" rows="2" maxlength="500" placeholder="For example: add a cut curb"></textarea>
    <div class="city-reply-buttons"><button type="button" data-reply-record>Hold to record prompt</button><button type="submit">Send prompt</button></div>
    <p>Dictation fills this box. Send prompt applies it. Hold the record button with a pointer, Space or Enter, then release; or focus the box and choose Done.</p></form>
    <p data-reply-result role="status" aria-live="polite"></p>`;
  const get = <T extends HTMLElement>(selector: string) => container.querySelector<T>(selector)!;
  const talk = get<HTMLButtonElement>('[data-reply-talk]'), done = get<HTMLButtonElement>('[data-reply-done]');
  const cancel = get<HTMLButtonElement>('[data-reply-cancel]'), record = get<HTMLButtonElement>('[data-reply-record]');
  const textarea = get<HTMLTextAreaElement>('textarea'), result = get('[data-reply-result]'), status = get('[data-reply-status]');
  const proposal = get('[data-reply-proposal]');
  const modelSelect = get<HTMLSelectElement>('#city-command-model');
  let model: VoiceCommandModel = readVoiceCommandModel(); modelSelect.value = model;
  let disposed = false, dictationContext = '', commandContext = '', previous = '';
  let choices: SpokenChoice[] = [], commandChoices: SpokenChoice[] = [];
  let proposed: { text: string; actionKey: string; choiceName?: string } | undefined;
  let held = false, dictationBase = '', dictationGeneration = 0;
  function submit(text: string) {
    if (!disposed) { clearProposal(); result.textContent = options.submit(text); status.textContent = 'Microphone off. City reply processed.'; }
  }
  function clearProposal() { proposed = undefined; proposal.hidden = true; }
  function propose(text: string, choiceName?: string) {
    if (disposed || commandContext !== options.context()) {
      if (!disposed) result.textContent = 'The situation changed. Please reply to the current barrier.';
      return;
    }
    const reply = options.interpret(text);
    if (!reply.action) { submit(text); return; }
    proposed = { text, actionKey: JSON.stringify(reply.action), choiceName };
    proposal.hidden = false;
    get('[data-reply-proposal-text]').textContent = `Heard: “${text}”. Apply this change?`;
    get<HTMLButtonElement>('[data-reply-confirm]').focus(); status.textContent = 'Microphone off. Review the proposed change.';
  }
  function active() {
    if (disposed) return;
    const busy = dictation.busy || command.busy;
    talk.disabled = busy; done.disabled = !(dictation.listening || command.listening); cancel.disabled = !busy;
    record.disabled = command.busy; record.setAttribute('aria-pressed', String(held && dictation.busy));
    container.dataset.listening = String(dictation.listening || command.listening); options.capture(busy);
  }
  const dictation = new CityVoiceReply({
    status: text => { if (!disposed) status.textContent = text; },
    transcript: text => {
      if (!disposed && (held || textarea.ownerDocument.activeElement === textarea) && dictationContext === options.context())
        textarea.value = [dictationBase, text].filter(Boolean).join(' ');
    }, active,
    submit: text => {
      if (!disposed && dictationContext === options.context()) {
        textarea.value = [dictationBase, text].filter(Boolean).join(' ');
        if (textarea.value.length > 500) status.textContent = 'Your prompt is too long. Shorten it to one change under 500 characters before sending.';
      }
    },
  }, options.dictationFactory);
  const createCommand = options.commandFactory ?? (callbacks => new CitySpokenCommand(callbacks));
  const neuCommand = createCommand({
    status: text => { if (!disposed) status.textContent = text; }, active,
    result: calls => {
      if (!disposed) status.textContent = 'Microphone off. Your command was processed on this device.';
      if (disposed || commandContext !== options.context()) { if (!disposed) result.textContent = 'The situation changed. Please reply to the current barrier.'; return; }
      const choice = validateSpokenCall(calls, commandChoices);
      if (!choice) { result.textContent = 'No single available change was understood. Try one of the choices or type a prompt.'; return; }
      if (choice.name === 'noAction' || choice.name === 'explainCurrentBarrier') { submit(choice.phrase); return; }
      propose(choice.phrase, choice.name);
    },
  });
  const moonCommand = new CityVoiceReply({
    status: text => { if (!disposed) status.textContent = text; }, active,
    transcript: text => { if (!disposed) get('[data-command-transcript]').textContent = text; },
    submit: text => propose(text),
  }, options.dictationFactory);
  const command = {
    get busy() { return neuCommand.busy || moonCommand.busy; },
    get listening() { return neuCommand.listening || moonCommand.listening; },
    start() { return model === 'moonshine' ? moonCommand.start() : neuCommand.start(spokenTools(commandChoices)); },
    finish() { if (moonCommand.busy) void moonCommand.finish(); else neuCommand.finish(); },
    cancel() { moonCommand.cancel(); neuCommand.cancel(); },
  };
  function startDictation() {
    if (disposed || command.busy || dictation.busy) return;
    clearProposal(); dictationContext = options.context(); dictationBase = textarea.value.trim();
    ++dictationGeneration; void dictation.start();
  }
  function finishDictation() {
    if (dictation.listening) void dictation.finish();
    else if (dictation.busy) { dictation.cancel(); status.textContent = 'Released before the microphone was ready. Try again when ready.'; }
  }
  function stop() {
    ++dictationGeneration; held = false; dictation.cancel(); command.cancel(); clearProposal();
    if (!disposed) status.textContent = 'Microphone off. No spoken city change submitted.';
  }
  textarea.addEventListener('focus', startDictation);
  modelSelect.addEventListener('change', () => {
    stop(); model = modelSelect.value === 'neudecide' ? 'neudecide' : 'moonshine'; saveVoiceCommandModel(model);
    status.textContent = model === 'moonshine' ? 'Moonshine selected. Speak one city change, then choose Done.' : 'NeuDecide selected. Authorised private model files must be installed to use it.';
  });
  textarea.addEventListener('input', () => {
    if (dictation.busy) { const draft = textarea.value; dictation.cancel(); textarea.value = draft; status.textContent = 'Microphone off while you type.'; }
  });
  textarea.addEventListener('blur', () => {
    const generation = dictationGeneration;
    queueMicrotask(() => {
      if (disposed || held || generation !== dictationGeneration) return;
      if (textarea.ownerDocument.activeElement === done || textarea.ownerDocument.activeElement === cancel) return;
      finishDictation();
    });
  });
  talk.addEventListener('click', () => {
    dictation.cancel(); clearProposal(); commandContext = options.context(); commandChoices = options.choices();
    get('[data-command-transcript]').textContent = ''; void command.start();
  });
  done.addEventListener('click', () => { if (command.busy) command.finish(); else finishDictation(); });
  cancel.addEventListener('click', stop);
  const hold = () => { if (!command.busy && !held) { held = true; startDictation(); active(); } };
  const release = () => { if (held) { finishDictation(); held = false; active(); } };
  record.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault(); record.setPointerCapture(event.pointerId); hold();
  });
  record.addEventListener('pointerup', release);
  record.addEventListener('pointercancel', stop);
  record.addEventListener('lostpointercapture', release);
  record.addEventListener('keydown', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); if (!event.repeat) hold(); } });
  record.addEventListener('keyup', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); release(); } });
  record.addEventListener('blur', () => { if (held) stop(); });
  container.addEventListener('keydown', event => { if (event.key === 'Escape') { stop(); talk.focus(); } });
  get<HTMLButtonElement>('[data-reply-confirm]').addEventListener('click', () => {
    if (proposed && commandContext === options.context()
      && (!proposed.choiceName || options.choices().some(choice => choice.name === proposed!.choiceName))
      && JSON.stringify(options.interpret(proposed.text).action) === proposed.actionKey) submit(proposed.text);
    else { clearProposal(); result.textContent = 'The situation changed. Choose a current change.'; }
  });
  get<HTMLButtonElement>('[data-reply-dismiss]').addEventListener('click', clearProposal);
  get<HTMLFormElement>('form').addEventListener('submit', event => { event.preventDefault(); const text = textarea.value; stop(); submit(text); });
  return {
    update() {
      const next = options.context(); if (next === previous && choices.length) return;
      if (dictation.busy || command.busy || proposed) stop();
      previous = next; choices = options.choices();
      get('[data-reply-choices]').replaceChildren(...choices.map(choice => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = choice.phrase;
        button.addEventListener('click', () => { stop(); submit(choice.phrase); }); return button;
      }));
    }, stop, dispose() { stop(); disposed = true; },
  };
}
