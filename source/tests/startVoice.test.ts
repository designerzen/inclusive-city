import assert from 'node:assert/strict';
import { test } from 'node:test';
import { StartVoice, startVoices } from '../src/audio/StartVoice';

test('start recordings avoid consecutive repeats, including after a page reload, and settle on end or error', async () => {
  const originals = Object.getOwnPropertyDescriptors(globalThis);
  const saved = new Map<string, string>();
  const played: FakeAudio[] = [];
  class FakeAudio {
    volume = 1;
    paused = false;
    onended: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(readonly src: string) { played.push(this); }
    play() { return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  try {
    Object.defineProperties(globalThis, {
      Audio: { configurable: true, value: FakeAudio },
      window: { configurable: true, value: { setTimeout, clearTimeout } },
      localStorage: { configurable: true, value: { getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => saved.set(key, value) } },
    });
    let previous = '';
    for (let i = 0; i < 30; i++) {
      const voice = new StartVoice();
      const completed = voice.play('/city/', .4);
      const audio = played.at(-1)!;
      assert.notEqual(audio.src, previous);
      assert.ok(startVoices.some(name => audio.src === `/city/assets/audio/intro/${name}.mp3`));
      assert.equal(audio.volume, .4);
      if (i % 2) audio.onerror!(); else audio.onended!();
      await completed;
      assert.equal(audio.paused, true);
      previous = audio.src;
    }
    const voice = new StartVoice();
    const completed = voice.play('/', .5);
    voice.setVolume(.2);
    assert.equal(played.at(-1)!.volume, .2);
    voice.setVolume(0);
    await completed;
    assert.equal(played.at(-1)!.paused, true);
    voice.stop();
  } finally {
    for (const key of ['Audio', 'window', 'localStorage']) {
      if (originals[key]) Object.defineProperty(globalThis, key, originals[key]!);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
