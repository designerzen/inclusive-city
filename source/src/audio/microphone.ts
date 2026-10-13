const preferenceKey = 'inclusive-city-microphone';
let selected: string | undefined;
const listeners = new Set<() => void>();
export function selectedMicrophone(): string {
  if (selected === undefined) {
    try { selected = globalThis.localStorage?.getItem(preferenceKey) ?? ''; } catch { selected = ''; }
  }
  return selected;
}
export function selectMicrophone(id: string) {
  if (id === selectedMicrophone()) return;
  selected = id;
  try { globalThis.localStorage?.setItem(preferenceKey, id); } catch { /* Keep this session's choice. */ }
  listeners.forEach(listener => listener());
}
export function onMicrophoneChange(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function microphoneConstraints(id = selectedMicrophone()): MediaStreamConstraints {
  return { audio: { ...(id ? { deviceId: { exact: id } } : {}), echoCancellation: true, noiseSuppression: true, autoGainControl: true } };
}
export async function openVoiceMicrophone(media: Pick<MediaDevices, 'getUserMedia'> = navigator.mediaDevices): Promise<MediaStream> {
  try { return await media.getUserMedia(microphoneConstraints()); }
  catch (error) {
    if (selectedMicrophone() && error instanceof Error && ['NotFoundError', 'OverconstrainedError'].includes(error.name))
      throw new Error('The selected microphone is unavailable. Choose another microphone or System default in Settings.');
    throw error;
  }
}
export type MicrophoneDevices = Pick<MediaDevices, 'getUserMedia' | 'enumerateDevices' | 'addEventListener' | 'removeEventListener'>;
/** Request access only for an explicit discovery click; release the temporary stream even if enumeration fails. */
export async function discoverMicrophones(media: Pick<MicrophoneDevices, 'getUserMedia' | 'enumerateDevices'>, requestAccess = false): Promise<MediaDeviceInfo[]> {
  let stream: MediaStream | undefined;
  try {
    if (requestAccess) stream = await media.getUserMedia({ audio: true });
    return (await media.enumerateDevices()).filter(device => device.kind === 'audioinput' && device.deviceId && device.deviceId !== 'default');
  } finally { stream?.getTracks().forEach(track => track.stop()); }
}
