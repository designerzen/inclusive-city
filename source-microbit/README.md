# Inclusive City — micro:bit robot face

This is the hardware source folder, separate from the browser application in
`source/`. It produces a flashable MakeCode HEX for the micro:bit's built-in
5 × 5 LED matrix. One Universal HEX contains builds for **micro:bit V1 and V2**.
No motor board or extra display is needed; this firmware displays the simulated
robot's expressions while the browser runs the city.

## Flash and use

1. On the attract splash screen choose **Download micro:bit firmware (.hex)**,
   or open **City controls → micro:bit robot face** for the same download.
   Deployment builds it automatically. Before
   deployment, use a local build below or the **microbit-face-firmware** artifact
   from the **Build microbit face firmware** GitHub Actions workflow.
2. Connect the board by USB. Copy `city-face.hex` to the **MICROBIT** drive and
   wait for flashing to finish. Power it from USB or a battery pack.
3. On every boot it starts Bluetooth UART advertising and shows a Bluetooth
   symbol. Select **Pair micro:bit face** on the attract splash screen or in the
   city's top bar and choose **BBC micro:bit**. The city button hides while
   connected and returns on disconnect. The connection survives the designer.
   Use HTTPS or localhost with a Web Bluetooth capable browser (Chrome/Edge on
   supported desktop platforms, or Chrome on Android). Bluetooth must be enabled.
4. Start your city robot. Emoji-style faces show its actual mood: curious,
   happy, sad, tired, frustrated or celebrating, plus ready, paused, waiting and
   idle expressions. When an obstacle is reached, its face moves its mouth for
   720 ms, scrolls the same alert as the on-screen robot, then restores its latest
   mood. Introductions, start/resume speech, replies, discoveries, robot meetings,
   crossing waits, pauses and arrival messages also reach the display. Text
   continues to work when browser narration is muted or unavailable.
   Returning to the designer or hiding the page cancels speech and sends idle
   while the page can still run.
5. After a disconnect or power cycle, select **Pair micro:bit face** again.

## Musical notes

On V2, the built-in speaker plays brief musical cues for mood changes and a
three-note robot chirp with each new message. Barriers use falling notes;
arrival uses a rising four-note phrase. Notes run independently of Bluetooth
and the LED display, at a modest volume, and heartbeats do not repeat them.
New cues replace older ones. Leaving the city, cancelled speech, disconnects
and the heartbeat watchdog stop pending notes.

Press **button B** to mute or unmute the board's notes. Muting keeps all faces,
mouth animations and text working; the setting lasts until a power cycle.
Browser mute and board mute are independent. Actual spoken words continue
through the browser narration.

The portable MakeCode music APIs automatically use the V2 speaker. V1 keeps its
LED/Bluetooth behaviour and can play these same notes through an external
speaker on P0/GND. No V2-only speaker-enable API is used. Both native targets
compile; physical sound, Bluetooth and V1 memory still need hardware verification.

The board cannot open a browser permission prompt: Web Bluetooth requires a
user click. “Pair” here means choosing and granting this site access to the
board. The firmware uses MakeCode's **No Pairing Required** BLE setting so it
advertises on boot without an A+B/reset sequence or OS PIN setup. Nearby clients
can also connect; it supports one connection at a time. Close Robot Comms or
other Bluetooth clients before connecting. Do not use the physical robot fleet
connection for this face-only firmware.

## Build locally

From the repository root, with Node and pnpm installed:

```sh
pnpm firmware:build
```

This runs pinned `makecode@1.3.6`, selecting the micro:bit editor via `mkc.json`.
It downloads the released editor toolchain and uses its native compilation
service, so the first build needs internet. The editor version can change
upstream. The compiler output is `source-microbit/built/binary.hex`. The build
command also packages it as `source/public/firmware/microbit-face/city-face.hex`
with a SHA-256 checksum, making the local site's download link ready to use.

`.github/workflows/microbit-face-firmware.yml` also builds on relevant PRs and
manual runs, uploading HEX and SHA-256 checksum. Pages waits for this build and
includes its artifact at `firmware/microbit-face/city-face.hex`.

## Protocol v2

Uses the shared micro:bit UART transport: service
`6e400001-b5a3-f393-e0a9-e50e24dcca9e`, write characteristic ending `0003`,
notifications ending `0002`. Frames are ASCII, LF terminated, at most 20 bytes
including LF. Reflash earlier face firmware: the browser requires v2.

| Browser sends | Board replies | Purpose |
| --- | --- | --- |
| `HELLO\n` | `CITYFACE:2\n` | Check compatible firmware before displaying faces |
| `FACE:R\n` | `ACK:R\n` | Ready |
| `FACE:M\n` | `ACK:M\n` | Moving |
| `FACE:B\n` | `ACK:B\n` | Blocked / sad |
| `FACE:P\n` | `ACK:P\n` | Paused |
| `FACE:W\n` | `ACK:W\n` | Waiting |
| `FACE:H\n` | `ACK:H\n` | Happy |
| `FACE:I\n` | `ACK:I\n` | Idle outside the city |
| `FACE:T\n` | `ACK:T\n` | Tired |
| `FACE:F\n` | `ACK:F\n` | Frustrated |
| `FACE:E\n` | `ACK:E\n` | Celebrating / arrival |
| `SAY:NNNN\n` | Same frame | Cancel old speech and begin a message |
| `TXT:NNNN:CC:text\n` | `TXT:NNNN:CC\n` | Append 1–7 printable ASCII characters |
| `END:NNNN\n` | Same frame | Commit complete text for mouth animation + scroll |
| `STOP\n` | Same frame | Cancel text staging, mouth animation and scrolling |
| Invalid frame | `ERR:FRAME\n` | No change to display |

`NNNN` is a four-digit uppercase hexadecimal message ID; `CC` is its zero-based,
two-digit hexadecimal chunk index. Wrong IDs, skipped chunks, empty commits and
buffers exceeding 240 characters are rejected. Each packet is acknowledged
before the browser sends the next, keeping within the small micro:bit UART buffer.
The built-in font uses ASCII: accents are transliterated, curly quotes converted,
unsupported symbols removed, and text beyond 240 characters ends in an ellipsis.
Emoji faces are drawn as LED patterns rather than sent as Unicode characters.

The browser checks the robot four times a second, sends changes and a one-second
heartbeat, and keeps only the latest desired mood/message while awaiting an ACK.
Repeated state updates do not replay speech. New messages and changes of encounter
cancel obsolete text before the next message is sent. Mood changes during speech
update the face used for mouth animation and after scrolling. The display fiber
yields independently of the UART/watchdog fiber, so scrolling can be stopped
immediately. ACK timeout closes the connection and reports the error. The board
returns to its Bluetooth symbol on disconnect or five seconds without a valid
frame, including suspended tabs. This protocol controls LEDs only; spoken audio
continues through the browser's existing narration.

## Verification

`pnpm test` includes tests executing this firmware source with mocked board
APIs, plus browser session/protocol tests. `pnpm check` checks the app.
The actual MakeCode build checks embedded API compatibility.

Hardware acceptance: flash a V2, verify the startup symbol on USB and battery,
pair and run through every expression, reach an obstacle and confirm the moving
mouth followed by its exact alert, change the city during a long scroll, check
that a new alert interrupts the old message, mute browser narration and confirm
LED messages still appear, pause/resume, reach the studio, leave the city,
hide the tab for more than five seconds, unplug/reboot,
and pair again. Also cancel the chooser and try the Robot Comms firmware to
verify useful errors. Physical BLE range, OS permissions and LED rendering need
this board check; automated mocks cannot establish hardware operation. Repeat
the visual/Bluetooth check on V1, check musical cues on V2, use button B during
a tune and during a message, and confirm that muting preserves the text display.

References: [MakeCode Bluetooth UART](https://makecode.microbit.org/reference/bluetooth/start-uart-service),
[MakeCode UART receive](https://makecode.microbit.org/reference/bluetooth/on-uart-data-received),
[Web Bluetooth user gesture and secure context](https://developer.chrome.com/docs/capabilities/bluetooth).
