import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buttonIcon } from '../src/ui/buttonIcons';
import { mapIcon } from '../src/ui/mapIcons';

test('icons follow changing playback, audio, camera and repair actions', () => {
  for (const [label, expected] of [
    ['Start robot', 'play'], ['Pause robot', 'pause'], ['Resume robot', 'play'],
    ['Replay from start', 'reset'], ['Stop track', 'stop'],
    ['Mute sound', 'mute'], ['Unmute sound', 'volume'],
    ['3D view', 'angled'], ['Map view', 'overhead'], ['Fit map', 'fit'],
    ['Give more crossing time', 'edit'], ['Lower curb', 'edit'], ['City changed ✓', 'check'],
    ['Zoom in', 'plus'], ['Zoom out', 'minus'], ['Move left', 'left'],
    ['Undo city change', 'undo'], ['Download painting', 'download'], ['See your artwork', 'art'],
  ]) assert.equal(buttonIcon(label!), expected, label);
});

test('module icons describe the module and remain decorative', () => {
  for (const [id, expected] of [['vision', 'eye'], ['hearing', 'volume'], ['movement', 'follow'], ['memory', 'route'], ['balance', 'angled']]) {
    const icon = buttonIcon('Enabled', `function-${id}`);
    assert.equal(icon, expected);
    assert.match(mapIcon(icon), /aria-hidden="true"/);
    assert.match(mapIcon(icon), /focusable="false"/);
  }
});
