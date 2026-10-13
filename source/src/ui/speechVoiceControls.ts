import type { ScreenSpeech } from '../audio/ScreenSpeech';
import { isSpeechVoice, speechVoices, voiceLabel } from '../audio/speechVoices';

export function mountSpeechVoiceControls(container: HTMLElement, speech: ScreenSpeech) {
  container.classList.add('speech-voice-controls');
  const options = ['b', 'a'].map(prefix => `<optgroup label="${prefix === 'b' ? 'British English' : 'American English'}">${speechVoices.filter(([id]) => id.startsWith(prefix)).map(([id]) => `<option value="${id}">${voiceLabel(id)}</option>`).join('')}</optgroup>`).join('');
  const roles = [['presets', 'Meet the robots'], ['editor', 'Robot workshop'], ['art', 'Art gallery']] as const;
  container.innerHTML = `<p class="accessibility-hint">City guide: Emma — our warm, friendly British adventure voice.</p>
    ${roles.map(([role, label]) => `<label for="speech-voice-${role}">${label}</label><select id="speech-voice-${role}">${options}</select>`).join('')}
    <label for="speech-voice-preview">Listen to a voice</label><select id="speech-voice-preview">${options}</select>
    <p class="accessibility-hint">Voices share one model. A small voice file downloads the first time you use each voice.</p>`;
  for (const [role] of roles) {
    const select = container.querySelector<HTMLSelectElement>(`#speech-voice-${role}`)!;
    select.value = speech.voiceForRole(role);
    select.addEventListener('change', () => { if (isSpeechVoice(select.value)) speech.setRoleVoice(role, select.value); });
  }
  const preview = container.querySelector<HTMLSelectElement>('#speech-voice-preview')!;
  preview.value = speech.voiceForRole('city');
  return () => {
    if (isSpeechVoice(preview.value)) speech.say('Hello, adventure buddy! Ready to explore? Let’s build a city where everyone can join in. Here we go!', undefined, undefined, { previewVoice: preview.value });
  };
}
