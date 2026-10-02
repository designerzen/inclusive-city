// Web MIDI specifies clear(), but the bundled DOM types omit it.
// https://www.w3.org/TR/webmidi/#dom-midioutput-clear
interface MIDIOutput {
  clear(): void;
}
