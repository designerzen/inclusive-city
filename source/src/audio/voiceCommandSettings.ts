export type VoiceCommandModel = 'moonshine' | 'neudecide';
const key = 'inclusive-city-voice-command-model';
let sessionModel: VoiceCommandModel | undefined;
const listeners = new Set<() => void>();
export function onVoiceCommandModelChange(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function readVoiceCommandModel(storage?: Pick<Storage, 'getItem'>): VoiceCommandModel {
  if (!storage && sessionModel) return sessionModel;
  try { return (storage ?? globalThis.localStorage)?.getItem(key) === 'neudecide' ? 'neudecide' : 'moonshine'; } catch { return 'moonshine'; }
}
export function saveVoiceCommandModel(model: VoiceCommandModel, storage?: Pick<Storage, 'setItem'>) {
  if (!storage) sessionModel = model;
  try { (storage ?? globalThis.localStorage)?.setItem(key, model); } catch { /* Keep the selection for this session. */ }
  listeners.forEach(listener => listener());
}
