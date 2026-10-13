export const speechVoices = [
  ['af_heart', 'Heart'], ['af_alloy', 'Alloy'], ['af_aoede', 'Aoede'], ['af_bella', 'Bella'],
  ['af_jessica', 'Jessica'], ['af_kore', 'Kore'], ['af_nicole', 'Nicole'], ['af_nova', 'Nova'],
  ['af_river', 'River'], ['af_sarah', 'Sarah'], ['af_sky', 'Sky'],
  ['am_adam', 'Adam'], ['am_echo', 'Echo'], ['am_eric', 'Eric'], ['am_fenrir', 'Fenrir'],
  ['am_liam', 'Liam'], ['am_michael', 'Michael'], ['am_onyx', 'Onyx'], ['am_puck', 'Puck'], ['am_santa', 'Santa'],
  ['bf_alice', 'Alice'], ['bf_emma', 'Emma'], ['bf_isabella', 'Isabella'], ['bf_lily', 'Lily'],
  ['bm_daniel', 'Daniel'], ['bm_fable', 'Fable'], ['bm_george', 'George'], ['bm_lewis', 'Lewis'],
] as const;
export type SpeechVoice = typeof speechVoices[number][0];
export type SpeechRole = 'presets' | 'editor' | 'city' | 'art';
export const cityVoice: SpeechVoice = 'bf_emma';
export const defaultRoleVoices: Record<SpeechRole, SpeechVoice> = {
  presets: 'bf_alice', editor: 'bm_fable', city: cityVoice, art: 'bf_isabella',
};
export function isSpeechVoice(value: string): value is SpeechVoice {
  return speechVoices.some(([id]) => id === value);
}
export function voiceLabel(voice: SpeechVoice) {
  return `${speechVoices.find(([id]) => id === voice)![1]} (${voice.startsWith('b') ? 'British' : 'American'} English)`;
}
export function savedRoleVoices(): Record<SpeechRole, SpeechVoice> {
  const voices = { ...defaultRoleVoices };
  try {
    const saved = JSON.parse(localStorage.getItem('inclusive-city-role-voices') ?? '{}');
    for (const role of ['presets', 'editor', 'art'] as const) {
      if (typeof saved?.[role] === 'string' && isSpeechVoice(saved[role])) voices[role] = saved[role];
    }
  } catch { /* Defaults work without storage. */ }
  return voices;
}
