# Robot Comms — micro:bit V2 firmware

GitHub Actions compiles this MakeCode TypeScript project into `robot-comms.hex`.
End users download and flash that file; no editor or compiler setup is needed.
The firmware only exercises Bluetooth, buttons and LEDs. Labels such as Forward
and Stop do not drive motors or implement the city's physical robot protocol.

## Flash and connect

1. Open **Firmware & setup** on the deployed Robot Comms page and select
   **Download Robot Comms firmware (.hex)**. Alternatively, open a successful
   [Build Robot Comms firmware run](https://github.com/designerzen/inclusive-city/actions/workflows/robot-comms-firmware.yml),
   download its **robot-comms-firmware** artifact and unzip it. GitHub may require
   sign-in for Actions artifacts; the deployed site's download needs no sign-in.
2. Connect your micro:bit V2 by USB and copy `robot-comms.hex` to the **MICROBIT**
   drive. Wait for flashing to finish and the LED message pattern to appear.
   Keep the board powered by USB or battery. Messages travel over Bluetooth.
3. Open the deployed Robot Comms page, or serve this repository with
   `pnpm --filter inclusive-city start`, then open
   http://localhost:5173/robot-comms.html in a Web Bluetooth capable Chrome/Edge
   browser. For another computer/phone, use HTTPS: an HTTP LAN IP is not a secure
   context. Firefox and Safari do not generally expose this API; the page detects
   missing support. Hardware/OS Bluetooth support is also required.
4. Click **Connect micro:bit** and choose your **BBC micro:bit**. Close other apps
   using its BLE connection. The page subscribes before sending any commands.

This is an open test service: nearby devices can connect without pairing.

## Automated builds (maintainers)

`.github/workflows/robot-comms-firmware.yml` uses Node 24 and MakeCode CLI
`makecode@1.3.6`, with the micro:bit editor explicitly selected by `mkc.json`.
It runs on relevant pull requests and manually through **Run workflow**. The
Pages workflow also calls it on every `main` push and manual deployment, then
downloads the same run's artifact into `source/public/firmware/robot-comms/`
before building the site. A firmware failure blocks deployment, so a site cannot
silently ship a missing or stale HEX. Artifacts include a SHA-256 checksum and
are retained for 90 days; the deployed download persists until the next deploy.

For a local developer build, run `pnpm dlx makecode@1.3.6 build` in this firmware
directory, then copy `built/binary.hex` to `robot-comms.hex` for a local preview.
The compiler downloads the released MakeCode toolchain and may use its cloud
native compiler; network access is required. The CLI version is pinned; the
stable editor toolchain can update upstream. `main.ts` and `pxt.json` remain
editable source; users do not need to edit them. Bluetooth is enabled and radio
excluded by `pxt.json`, which also sets No Pairing Required.

## Board controls

- **A** cycles the selected code through 0–F (initially 0).
- **B** sends the selected code as `SIG:X`.
- **A+B** toggles a random signal every eight seconds while connected. The page
  has equivalent Start/Stop occasional signals buttons. Demo is off at startup,
  connection and disconnect; it never starts without an explicit action.
- Receiving `CMD:X` selects and displays X, then returns `ACK:X`. Pressing B then
  sends that selected code back to the page. There is no automatic echo loop.
- Top and middle LED rows mark a message. Bottom row's first four LEDs represent
  8, 4, 2, 1 from left to right (off=0, on=1); the fifth stays off. For example F
  lights all four bits; 0 leaves all four off. Disconnection shows an X.

## Robot Comms v1 wire protocol

Uppercase ASCII, one LF-terminated frame per message, under 20 bytes per frame.
This avoids filling MakeCode's small UART buffer. A dedicated sender serialises
outgoing firmware frames. The page handles split and coalesced notifications,
limits lines to 64 bytes and retains only the latest 200 log entries.

| Frame | Direction | Meaning |
| --- | --- | --- |
| `CMD:X\n` | Page → board | Display/select code X |
| `ACK:X\n` | Board → page | Firmware received/displayed CMD:X |
| `SIG:X\n` | Board → page | Button B or occasional signal |
| `AUTO:1\n` / `AUTO:0\n` | Both | Request/report demo enabled/disabled |
| `ERR:FRAME\n` | Board → page | Invalid incoming frame |

X is exactly one hexadecimal digit 0–9 or A–F. The page also recognises incoming
`CMD:X` frames as commands from custom board firmware. Both sides can send and
receive; on the supplied firmware physical button commands use `SIG:X`.
The page allows one unacknowledged CMD at a time, waits five seconds, and reports
unconfirmed delivery without automatic retry. ACK is protocol receipt, not proof
of physical robot motion. This test protocol has no sequence IDs, so delayed ACKs
for a repeated code cannot be distinguished; reconnect after a stalled session
before relying on a repeated command confirmation.

| Code | Message | Code | Message |
| --- | --- | --- | --- |
| 0 | Ready | 8 | Right |
| 1 | Start | 9 | Arrived |
| 2 | Stop | A | Obstacle |
| 3 | Pause | B | Clear |
| 4 | Resume | C | Help |
| 5 | Forward | D | Busy |
| 6 | Reverse | E | Happy |
| 7 | Left | F | Goodbye |

UART service: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`. Standard micro:bit
write characteristic ends `0003`, receive/indication characteristic `0002`.
The app's shared BLE transport detects runtimes with the opposite assignments.
Discovery uses the BBC micro:bit name prefix rather than assuming UART is in
the advertisement. Connections are explicit; there is no automatic reconnection.

## Hardware acceptance check

After flashing, send all 16 commands: each should display its binary code and
produce the matching ACK. Press A then B through all 16 selections: each should
appear in Latest signal and the traffic log. Enable occasional signals on each
side, check a message after eight seconds, then stop and check silence. Unplug
the board, check disconnected controls, repower and reconnect; demo should remain
off. Try cancelling the chooser and connecting with incorrect firmware to check
the page's errors. Real BLE/LED operation requires this check on hardware.

References: [MakeCode UART](https://makecode.microbit.org/reference/bluetooth/start-uart-service),
[UART receive](https://makecode.microbit.org/reference/bluetooth/on-uart-data-received),
[CODAL UART implementation](https://github.com/lancaster-university/codal-microbit-v2/blob/master/source/bluetooth/MicroBitUARTService.cpp),
[Web Bluetooth secure-context requirements](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API).
