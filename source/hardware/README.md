# MCU firmware sources

All firmware sources live under `source/hardware/{mcu type}/{project}`:

- [microbit/city-face](microbit/city-face/README.md): micro:bit V1/V2 city-face firmware (MakeCode).
- [microbit/robot-comms](microbit/robot-comms/README.md): micro:bit V2 Bluetooth communications test (MakeCode).
- [arduino/arduino-city-face](arduino/arduino-city-face/README.md): ArduinoBLE city-face sketch.

The browser application's transport adapters stay in `source/src/robot/physical/`.
Generated HEX downloads are packaged in `source/public/firmware/`. Vite serves the
Arduino sketch and setup guides from these source folders during development and
copies those downloads to `source/dist/firmware/` for production. Download URLs
remain under `/firmware/`.

Run `pnpm firmware:build` from the repository root to compile and package the
micro:bit city face. See each project's README for its build and flashing steps.
