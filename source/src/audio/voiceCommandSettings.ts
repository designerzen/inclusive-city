export type VoiceCommandModel = 'moonshine' | 'neudecide';
const key = 'inclusive-city-voice-command-model';
export function readVoiceCommandModel(storage?: Pick<Storage, 'getItem'>): VoiceCommandModel {
  try { return (storage ?? globalThis.localStorage)?.getItem(key) === 'neudecide' ? 'neudecide' : 'moonshine'; } catch { return 'moonshine'; }
}
export function saveVoiceCommandModel(model: VoiceCommandModel, storage?: Pick<Storage, 'setItem'>) {
  try { (storage ?? globalThis.localStorage)?.setItem(key, model); } catch { /* Keep the selection for this session. */ }
}
