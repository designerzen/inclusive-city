import assert from 'node:assert/strict';
import { test } from 'node:test';
import { discoverMicrophones, microphoneConstraints, openVoiceMicrophone, onMicrophoneChange, selectedMicrophone, selectMicrophone } from '../src/audio/microphone';

test('default input follows the system while an explicit input uses an exact device constraint', async () => {
  const previous = selectedMicrophone();
  try {
    selectMicrophone(''); assert.equal((microphoneConstraints().audio as MediaTrackConstraints).deviceId, undefined);
    selectMicrophone('usb-mic');
    let received: MediaStreamConstraints | undefined;
    const stream = {} as MediaStream;
    assert.equal(await openVoiceMicrophone({ async getUserMedia(constraints) { received = constraints; return stream; } }), stream);
    assert.deepEqual((received!.audio as MediaTrackConstraints).deviceId, { exact: 'usb-mic' });
    const unavailable = new Error('Missing'); unavailable.name = 'OverconstrainedError';
    await assert.rejects(openVoiceMicrophone({ async getUserMedia() { throw unavailable; } }), /Settings/);
  } finally { selectMicrophone(previous); }
});
test('microphone changes notify active voice owners once and unsubscribe on disposal', () => {
  const previous = selectedMicrophone(); let notifications = 0;
  const unsubscribe = onMicrophoneChange(() => { notifications++; });
  try {
    selectMicrophone('test-input'); selectMicrophone('test-input'); assert.equal(notifications, 1);
    unsubscribe(); selectMicrophone('other-input'); assert.equal(notifications, 1);
  } finally { unsubscribe(); selectMicrophone(previous); }
});
test('discovery does not open the microphone automatically and releases permission streams even on failure', async () => {
  let starts = 0, stops = 0;
  const media = {
    async getUserMedia() { starts++; return { getTracks: () => [{ stop() { stops++; } }] } as unknown as MediaStream; },
    async enumerateDevices() { return [
      { kind: 'audioinput', deviceId: 'default' }, { kind: 'audioinput', deviceId: 'usb' }, { kind: 'audiooutput', deviceId: 'speaker' },
    ] as MediaDeviceInfo[]; },
  };
  assert.deepEqual((await discoverMicrophones(media)).map(d => d.deviceId), ['usb']); assert.equal(starts, 0);
  await discoverMicrophones(media, true); assert.equal(starts, 1); assert.equal(stops, 1);
  await assert.rejects(discoverMicrophones({ ...media, async enumerateDevices() { throw new Error('Enumeration failed'); } }, true));
  assert.equal(stops, 2);
});
