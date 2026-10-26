// Inclusive City: CITYFACE:2 over Nordic UART. See README.md beside this sketch.
#include <ArduinoBLE.h>

BLEService uart("6e400001-b5a3-f393-e0a9-e50e24dcca9e");
BLECharacteristic rx("6e400002-b5a3-f393-e0a9-e50e24dcca9e", BLEWrite | BLEWriteWithoutResponse, 20);
BLECharacteristic tx("6e400003-b5a3-f393-e0a9-e50e24dcca9e", BLERead | BLENotify, 20);
String frame, text, receiving;
unsigned int nextChunk = 0;
unsigned long lastFrame = 0;
bool dropping = false;
char face = 'I';

bool hex(const String &value) {
  if (!value.length()) return false;
  for (unsigned int i = 0; i < value.length(); i++)
    if (!((value[i] >= '0' && value[i] <= '9') || (value[i] >= 'A' && value[i] <= 'F'))) return false;
  return true;
}
void reply(const String &value) { String line = value + "\n"; tx.writeValue((const uint8_t *)line.c_str(), line.length()); }
void clearSpeech() { receiving = ""; text = ""; nextChunk = 0; }
void showFace(char code) {
  face = code;
  digitalWrite(LED_BUILTIN, code == 'I' ? LOW : HIGH);
  if (Serial) { Serial.print("FACE:"); Serial.println(code); }
  // Add a non-blocking external display driver here for a full LED face.
}
void handle(const String &line) {
  if (line == "HELLO") { reply("CITYFACE:2"); }
  else if (line.length() == 6 && line.startsWith("FACE:") && String("RMBPWHITFE").indexOf(line[5]) >= 0) {
    if (line[5] == 'I') clearSpeech();
    showFace(line[5]); reply("ACK:" + line.substring(5));
  } else if (line == "STOP") { clearSpeech(); showFace('I'); reply("STOP"); }
  else if (line.length() == 8 && line.startsWith("SAY:") && hex(line.substring(4))) {
    clearSpeech(); receiving = line.substring(4); reply(line);
  } else if (line.length() >= 13 && line.length() <= 19 && line.startsWith("TXT:") && receiving.length()
      && line.substring(4, 8) == receiving && line[8] == ':' && line[11] == ':' && hex(line.substring(9, 11))
      && strtoul(line.substring(9, 11).c_str(), nullptr, 16) == nextChunk && text.length() + line.length() - 12 <= 240) {
    for (unsigned int i = 12; i < line.length(); i++) if (line[i] < 32 || line[i] > 126) { reply("ERR:FRAME"); return; }
    text += line.substring(12); nextChunk++; reply(line.substring(0, 11));
  } else if (line.length() == 8 && line.startsWith("END:") && receiving.length() && line.substring(4) == receiving && text.length()) {
    if (Serial) { Serial.print("SAY:"); Serial.println(text); }
    // Queue text for an external display here; keep BLE.poll() running.
    clearSpeech(); reply(line);
  } else { reply("ERR:FRAME"); return; }
  lastFrame = millis();
}
void resetConnection() { frame = ""; dropping = false; clearSpeech(); showFace('I'); lastFrame = millis(); }
void setup() {
  pinMode(LED_BUILTIN, OUTPUT); Serial.begin(115200);
  frame.reserve(64); text.reserve(240); receiving.reserve(4);
  if (!BLE.begin()) { if (Serial) Serial.println("BLE failed to start"); return; }
  BLE.setLocalName("Inclusive City Arduino"); BLE.setAdvertisedService(uart);
  uart.addCharacteristic(rx); uart.addCharacteristic(tx); BLE.addService(uart);
  resetConnection(); BLE.advertise();
}
void loop() {
  BLEDevice central = BLE.central();
  if (!central) { BLE.poll(); return; }
  resetConnection();
  while (central.connected()) {
    BLE.poll();
    if (rx.written()) {
      uint8_t bytes[20]; int length = rx.readValue(bytes, sizeof(bytes));
      for (int i = 0; i < length; i++) {
        if (bytes[i] == '\n') {
          if (!dropping && frame.length()) handle(frame);
          else if (dropping) reply("ERR:FRAME");
          frame = ""; dropping = false;
        } else if (bytes[i] != '\r') {
          if (bytes[i] < 32 || bytes[i] > 126 || frame.length() >= 63) { frame = ""; dropping = true; }
          else if (!dropping) frame += (char)bytes[i];
        }
      }
    }
    if (face != 'I' && millis() - lastFrame > 5000) { clearSpeech(); showFace('I'); }
  }
  resetConnection(); BLE.advertise();
}
