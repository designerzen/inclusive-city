# Arduino City Face

This sketch implements the same CITYFACE:2 application protocol as the project's micro:bit face firmware. It uses Nordic UART BLE: service 6e400001, write 6e400002, notify 6e400003 (all with suffix -b5a3-f393-e0a9-e50e24dcca9e). Both acknowledged and unacknowledged writes are accepted. Keep the browser packet size at 20 bytes.

## Install

1. Use an Arduino Nano 33 BLE / BLE Sense (including Rev2), Nano 33 IoT, or MKR WiFi 1010. These boards are supported by [ArduinoBLE](https://github.com/arduino-libraries/ArduinoBLE). A plain Uno or Nano without BLE is insufficient; HC-05 Bluetooth Classic modules cannot use Web Bluetooth.
2. In Arduino IDE, install the board's official board package and the ArduinoBLE library using Library Manager. For IoT/MKR boards, keep the NINA module firmware compatible with the installed ArduinoBLE version.
3. Save arduino-city-face.ino inside a folder named arduino-city-face. Select the board and USB port, then Upload.
4. Power the board. In the app's Settings → Microcontroller, select your Arduino board. Select “Inclusive City Arduino” in the Bluetooth chooser. If cancelled, use Pair Bluetooth robot face to try again.

## Output and scope

The built-in LED lights for an active robot and clears for idle, disconnection, or a five-second communication timeout. The USB serial monitor at 115200 baud receives FACE codes and assembled SAY messages. The sketch never waits for a USB serial connection. These Arduino boards do not have the micro:bit's 5 × 5 matrix or speaker: add a non-blocking display driver at showFace() and the END handler to render expressions and scrolling text on external hardware.

This is face firmware, not a motor controller. It does not implement the Physical robots START/PAUSE/RESUME motor commands. Add your robot's commands and sensor reports separately before using route tracking. STOP clears the face output; it is not a motor emergency stop.

The parser accepts fragmented newline-delimited frames, validates sequence/chunk IDs and bounds messages to 240 printable ASCII characters. Every face/text packet gets the same acknowledgement used by the micro:bit client. Unsupported firmware fails the browser's CITYFACE:2 check instead of appearing connected.

The sketch has protocol-level checks in the repository; compilation/upload and actual radio/display behavior must be verified on the target board before use.
