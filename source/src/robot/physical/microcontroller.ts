import { microbitUart, nordicUart, validateBleSettings, type BleSettings } from './transport';

export const microcontrollers = [
  { id: 'microbit', label: 'BBC micro:bit (V1 / V2)', ble: microbitUart },
  { id: 'nano33ble', label: 'Arduino Nano 33 BLE / BLE Sense', ble: nordicUart },
  { id: 'nano33iot', label: 'Arduino Nano 33 IoT', ble: nordicUart },
  { id: 'mkrwifi1010', label: 'Arduino MKR WiFi 1010', ble: nordicUart },
  { id: 'nordic', label: 'Other MCU (Nordic UART)', ble: nordicUart },
  { id: 'custom', label: 'Custom BLE microcontroller', ble: nordicUart },
] as const;
export type MicrocontrollerId = typeof microcontrollers[number]['id'];
export interface MicrocontrollerSettings { board: MicrocontrollerId; ble: BleSettings; }
const storageKey = 'inclusive-city-microcontroller';
export const microcontrollerChanges = new EventTarget();
export function microcontrollerPreset(board: string): MicrocontrollerSettings {
  const profile = microcontrollers.find(item => item.id === board) ?? microcontrollers[0];
  return { board: profile.id, ble: { ...profile.ble } };
}
export function validateMicrocontrollerSettings(input: MicrocontrollerSettings): MicrocontrollerSettings {
  if (!microcontrollers.some(item => item.id === input.board)) throw new Error('Choose a microcontroller.');
  return { board: input.board, ble: validateBleSettings(input.ble) };
}
export function readMicrocontrollerSettings(storage?: Pick<Storage, 'getItem'>): MicrocontrollerSettings {
  try {
    const saved = JSON.parse(storage?.getItem(storageKey) ?? 'null');
    if (saved) return validateMicrocontrollerSettings(saved);
  } catch { /* Invalid or older settings use the micro:bit default. */ }
  return microcontrollerPreset('microbit');
}
function storage() { try { return globalThis.localStorage; } catch { return undefined; } }
let current = readMicrocontrollerSettings(storage());
export function getMicrocontrollerSettings() { return { board: current.board, ble: { ...current.ble } }; }
export function setMicrocontrollerSettings(input: MicrocontrollerSettings) {
  const next = validateMicrocontrollerSettings(input);
  if (JSON.stringify(next) === JSON.stringify(current)) return false;
  current = next;
  try { storage()?.setItem(storageKey, JSON.stringify(next)); } catch { /* Keep the session preference. */ }
  microcontrollerChanges.dispatchEvent(new Event('change'));
  return true;
}
