/*
  MotoLock - Motorcycle receiver / motor controller
  Board: ESP32 Dev Module (38-pin ESP32-WROOM style)

  Receives helmet telemetry through BLE, controls a fail-safe relay, displays
  status, reads the GY-GPSV3-NEO / NEO-M8U GPS receiver, and sends alerts
  using a SIM7600G-H carrier/development board.

  V2 hardware notes:
  - All GPIO assignments are unchanged from the original MotoLock code.
  - The LM2596 module now has a built-in 7-segment voltage display. It is a
    power converter only, so it does not use or require an ESP32 GPIO.
  - No logic-level converter is used for the relay control line. GPIO 25 must
    connect only to a relay input or transistor/MOSFET driver that is verified
    to accept a 3.3 V ESP32 signal. Never drive a relay coil from GPIO 25.
  - Set the LM2596 output to 5.00 V and verify it with a multimeter before
    connecting the ESP32, OLED, relay module, GPS, or modem carrier.
  - SIM7600 support is temporarily disabled because the carrier/development
    board is not yet available. Change SIM7600_ENABLED to true later.
*/

#include <Arduino.h>
#include <Wire.h>
#include "BluetoothSerial.h"
#include <BLEDevice.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <TinyGPSPlus.h>
#include <atomic>
#include "MotoLockProtocol.h"

// --------------------------- PIN MAP ---------------------------------
constexpr uint8_t OLED_SDA_PIN = 21;
constexpr uint8_t OLED_SCL_PIN = 22;
constexpr uint8_t GPS_RX_PIN = 16;       // ESP32 RX <- NEO-M8U board TX
constexpr uint8_t GPS_TX_PIN = 17;       // ESP32 TX -> NEO-M8U board RX (optional)
constexpr uint8_t MODEM_RX_PIN = 26;     // ESP32 RX <- SIM7600 TX
constexpr uint8_t MODEM_TX_PIN = 27;     // ESP32 TX -> SIM7600 RX
constexpr uint8_t RELAY_PIN = 25;        // Direct to 3.3V-compatible relay IN/driver
constexpr uint8_t OVERRIDE_BUTTON_PIN = 32;
constexpr uint8_t GREEN_LED_PIN = 2;
constexpr uint8_t RED_LED_PIN = 4;

constexpr bool RELAY_ACTIVE_LOW = true;
constexpr bool LED_ACTIVE_HIGH = true;
constexpr bool SIM7600_ENABLED = false;  // Change to true when dev board arrives
constexpr uint8_t OLED_ADDRESS = 0x3C;
constexpr uint32_t HELMET_TIMEOUT_MS = 2000;
constexpr uint32_t APP_FRAME_TIMEOUT_MS = 1000;
constexpr uint32_t APP_HEARTBEAT_TIMEOUT_MS = 3500;
constexpr size_t APP_FRAME_MAX = 256;
constexpr uint8_t PAIRING_BUTTON_PIN = 0;  // Onboard BOOT; separate from override.
// Optional filter for installations with multiple helmets; this is not authentication.
const char EXPECTED_HELMET_ADDRESS[] = "";
constexpr uint32_t OVERRIDE_HOLD_MS = 5000;
constexpr uint32_t OVERRIDE_DURATION_MS = 120000;
constexpr uint32_t ALERT_COOLDOWN_MS = 10UL * 60UL * 1000UL;
constexpr uint16_t MQ3_ALCOHOL_DEADBAND_RAW = 35;
constexpr float ALCOHOL_LIMIT_PERCENT = 0.050f;
constexpr float ALCOHOL_DISPLAY_MAX_PERCENT = 0.500f;

// Replace with the caregiver/admin number, including country code.
const char ALERT_PHONE_NUMBER[] = "+639XXXXXXXXX";

#define MOTOLOCK_SERVICE_UUID   "7ce10001-6d79-4f8b-9a33-5f4739a90001"
#define MOTOLOCK_TELEMETRY_UUID "7ce10002-6d79-4f8b-9a33-5f4739a90001"

enum HelmetFlags : uint8_t {
  FLAG_WORN          = 1 << 0,
  FLAG_WARMED_UP     = 1 << 1,
  FLAG_ALCOHOL_CLEAR = 1 << 2,
  FLAG_SENSOR_OK     = 1 << 3,
  FLAG_STABILIZING   = 1 << 4
};

struct __attribute__((packed)) HelmetPacket {
  uint8_t version;
  uint8_t flags;
  uint16_t mqRaw;
  uint16_t cleanAirBaseline;
  uint16_t sequence;
};
static_assert(sizeof(HelmetPacket) == 8, "Unexpected sensor snapshot size");

Adafruit_SSD1306 display(128, 64, &Wire, -1);
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);
HardwareSerial modemSerial(2);
BluetoothSerial SerialBT;

BLEAdvertisedDevice *helmetDevice = nullptr;
BLEClient *bleClient = nullptr;
BLERemoteCharacteristic *helmetTelemetry = nullptr;
BLERemoteCharacteristic *helmetChallenge = nullptr;
mbedtls_pk_context helmetVerificationKey;
Preferences pairingStore;
String deviceSecret;
String appNonce;
bool nonceForUnlock = false;
uint32_t appNonceMs = 0;
bool sessionAuthenticated = false;
bool appAuthorized = false;
bool provisioningMode = false;
uint32_t provisioningStartedMs = 0;

std::atomic<bool> appConnected{false};
std::atomic<bool> appTransportConnected{false};
std::atomic<uint32_t> lastAppHeartbeatMs{0};
std::atomic<bool> appSessionChanged{false};
portMUX_TYPE packetMux = portMUX_INITIALIZER_UNLOCKED;
HelmetPacket pendingPacket{};
HelmetPacket latestPacket{};
bool bleLinkConnected = false;  // Shared fields below are protected by packetMux.
bool receivedPacket = false;
uint32_t receivedPacketMs = 0;
uint32_t connectedAtMs = 0;
bool havePacket = false;       // Main-loop snapshot.
bool engineOutputAllowed = false;
uint8_t rawFrame[ML_FRAME_SIZE]{};
bool rawFramePending = false;
uint8_t verifiedFrame[ML_FRAME_SIZE]{};
uint8_t requestedChallenge[32]{};
bool challengeRequested = false;
char candidateIdentity[256]{};
char pinnedIdentity[256]{};
char candidateAddress[18]{};
char pinnedAddress[18]{};
uint32_t verifiedGeneration = 0;
uint32_t appSentGeneration = 0;

bool helmetConnected = false;
bool overrideActive = false;
bool displayAvailable = false;
uint32_t lastPacketMs = 0;
uint32_t overrideEndsMs = 0;
uint32_t lastAlertMs = 0;
uint32_t lastAppStatusMs = 0;

void bluetoothAppCallback(esp_spp_cb_event_t event,
                          esp_spp_cb_param_t *param) {
  (void)param;

  if (event == ESP_SPP_SRV_OPEN_EVT) {
    appTransportConnected = true;
    appConnected = false;  // A live PING is required before displaying Connected.
    lastAppHeartbeatMs = millis();
    appSessionChanged = true;
  } else if (event == ESP_SPP_CLOSE_EVT) {
    appTransportConnected = false;
    appConnected = false;
    appSessionChanged = true;
  }
}

bool helmetPacketFresh() {
  return helmetConnected && havePacket &&
         millis() - lastPacketMs <= HELMET_TIMEOUT_MS;
}

float estimateAlcoholPercent(uint16_t mqRaw, uint16_t baseline) {
  if (baseline >= 4095) return 0.0f;

  float delta = static_cast<float>(mqRaw) - baseline -
                MQ3_ALCOHOL_DEADBAND_RAW;
  if (delta < 0.0f) delta = 0.0f;

  float usableRange = 4095.0f - baseline;
  if (usableRange < 1.0f) usableRange = 1.0f;

  float percent = (delta / usableRange) * ALCOHOL_DISPLAY_MAX_PERCENT;
  if (percent > ALCOHOL_DISPLAY_MAX_PERCENT) {
    percent = ALCOHOL_DISPLAY_MAX_PERCENT;
  }
  return percent;
}

void sendAppStatus() {
  if (!appConnected.load()) return;
  const bool packetFresh = helmetPacketFresh();
  const bool helmetWorn = latestPacket.flags & FLAG_WORN;
  const bool warmedUp = latestPacket.flags & FLAG_WARMED_UP;
  const bool sensorOk = latestPacket.flags & FLAG_SENSOR_OK;
  const bool alcoholClear = latestPacket.flags & FLAG_ALCOHOL_CLEAR;
  const bool stabilizing = latestPacket.flags & FLAG_STABILIZING;
  const float alcoholPercent = estimateAlcoholPercent(
      latestPacket.mqRaw, latestPacket.cleanAirBaseline);
  const bool engineAllowed = engineOutputAllowed;

  String status;
  status.reserve(420);
  status = "STATUS:{";
  status += "\"verificationProtocol\":2,";
  status += "\"signedTelemetrySupported\":true,";
  status += "\"verificationSession\":\"\",";
  status += "\"helmetDataFresh\":";
  status += packetFresh ? "true," : "false,";
  status += "\"helmetConnected\":";
  status += helmetConnected ? "true," : "false,";
  status += "\"helmetSequence\":" + String(latestPacket.sequence) + ",";
  status += "\"mq3Value\":" + String(latestPacket.mqRaw);
  status += ",\"brac\":" + String(alcoholPercent, 3);
  status += ",\"highestBrac\":" + String(alcoholPercent, 3);
  status += ",\"displayBrac\":" + String(alcoholPercent, 3);
  status += ",\"testStatus\":\"";
  status += !packetFresh ? "HELMET_NOT_FOUND" :
            (!sensorOk || !warmedUp ? "SENSOR_NOT_READY" :
             (!helmetWorn ? "HELMET_NOT_WORN" :
             (stabilizing ? "STABILIZING" :
              (!alcoholClear ? "RESULT_FAIL" : "RESULT_PASS"))));
  status += "\"";
  status += ",\"remainingSeconds\":0";
  status += ",\"mq3Baseline\":" + String(latestPacket.cleanAirBaseline);
  status += ",\"mq3CleanBaseline\":" + String(latestPacket.cleanAirBaseline);
  status += ",\"mq3BaselineReady\":";
  status += (packetFresh && sensorOk && warmedUp) ? "true" : "false";
  status += ",\"mq3Stabilizing\":";
  status += (stabilizing || !warmedUp) ? "true" : "false";
  status += ",\"breathTestWaiting\":false";
  status += ",\"breathBlowDetected\":false";
  status += ",\"alcoholDetected\":";
  status += (packetFresh && sensorOk && !alcoholClear && !stabilizing)
                ? "true" : "false";
  status += ",\"irDetected\":";
  status += (packetFresh && helmetWorn) ? "true" : "false";
  status += ",\"locked\":";
  status += engineAllowed ? "false" : "true";
  status += ",\"ignitionEnabled\":";
  status += engineAllowed ? "true" : "false";
  status += ",\"startAuthorized\":";
  status += engineAllowed ? "true" : "false";
  status += ",\"breathTestActive\":false}";
  SerialBT.println(status);
}

void handleAppCommand(const char *message) {
  const String command(message);
  if (strcmp(message, "STATUS") == 0) {
    sendAppStatus();
  } else if (strcmp(message, "PING") == 0) {
    lastAppHeartbeatMs = millis();
    appConnected = true;
    SerialBT.println("PONG");
  } else if (command.startsWith("PING:") && command.length() <= 32) {
    const String token = command.substring(5);
    if (!token.length()) return;
    for (size_t i = 0; i < token.length(); ++i) if (token[i] < '0' || token[i] > '9') return;
    lastAppHeartbeatMs = millis();
    appConnected = true;
    SerialBT.println("PONG:" + token);
  } else if (strcmp(message, "HELLO") == 0) {
    SerialBT.println("CONNECTED");
    sendAppStatus();
  } else if (command.startsWith("PROVISION:")) {
    uint8_t secretBytes[32];
    if (deviceSecret.length()) SerialBT.println("ERR_ALREADY_PROVISIONED");
    else if (!provisioningMode) SerialBT.println("ERR_PROVISIONING_NOT_ACTIVE");
    else if (!mlUnhex(command.substring(10), secretBytes, sizeof(secretBytes))) SerialBT.println("ERR_INVALID_SECRET");
    else if (!helmetPacketFresh()) SerialBT.println("ERR_HELMET_NOT_READY");
    else {
      char identity[256], address[18];
      portENTER_CRITICAL(&packetMux);
      memcpy(identity, candidateIdentity, sizeof(identity));
      memcpy(address, candidateAddress, sizeof(address));
      portEXIT_CRITICAL(&packetMux);
      const String record = command.substring(10) + "|" + identity + "|" + address;
      if (!identity[0] || pairingStore.putString("pairing", record) != record.length()) {
        SerialBT.println("ERR_STORAGE");
      } else {
        deviceSecret = command.substring(10);
        portENTER_CRITICAL(&packetMux);
        memcpy(pinnedIdentity, identity, sizeof(identity));
        memcpy(pinnedAddress, address, sizeof(address));
        portEXIT_CRITICAL(&packetMux);
        sessionAuthenticated = true;
        provisioningMode = false;
        SerialBT.println("OK_PROVISIONED");
      }
    }
    memset(secretBytes, 0, sizeof(secretBytes));
  } else if (command == "AUTH_REQ" || command == "SESSION_REQ") {
    if (!deviceSecret.length()) { SerialBT.println("ERR_NOT_PROVISIONED"); return; }
    uint8_t nonce[32];
    esp_fill_random(nonce, sizeof(nonce));
    appNonce = mlHex(nonce, sizeof(nonce));
    appNonceMs = millis();
    nonceForUnlock = command == "AUTH_REQ";
    SerialBT.println("NONCE:" + appNonce);
  } else if (command.startsWith("AUTH:") || command.startsWith("UNLOCK:")) {
    const bool unlock = command.startsWith("UNLOCK:");
    const String supplied = command.substring(unlock ? 7 : 5);
    const bool nonceValid = appNonce.length() && millis() - appNonceMs <= 5000 && unlock == nonceForUnlock;
    const String expected = nonceValid ? mlHmac(appNonce, deviceSecret) : "";
    appNonce = "";  // A nonce is single-use even on a failed attempt.
    if (!nonceValid || expected.length() != 64 || !mlEqual(expected, supplied)) {
      SerialBT.println("ERR_AUTH_FAILED");
      return;
    }
    sessionAuthenticated = true;
    if (!unlock) { SerialBT.println("OK_AUTHENTICATED"); return; }
    const uint8_t required = FLAG_WORN | FLAG_WARMED_UP | FLAG_SENSOR_OK | FLAG_ALCOHOL_CLEAR;
    if (!helmetPacketFresh() || (latestPacket.flags & required) != required ||
        (latestPacket.flags & FLAG_STABILIZING)) {
      SerialBT.println("ERR_HELMET_NOT_READY");
      return;
    }
    appAuthorized = true;
    setEngineAllowed(true);
    SerialBT.println("OK_UNLOCKED");
  } else if (command == "GET_HELMET_ID") {
    if (!sessionAuthenticated && !provisioningMode) { SerialBT.println("ERR_AUTH_REQUIRED"); return; }
    char identity[256];
    portENTER_CRITICAL(&packetMux);
    memcpy(identity, candidateIdentity, sizeof(identity));
    portEXIT_CRITICAL(&packetMux);
    if (!helmetPacketFresh() || !identity[0]) SerialBT.println("ERR_HELMET_NOT_READY");
    else SerialBT.println(String("HELMET_ID:") + identity);
  } else if (command.startsWith("CHALLENGE:")) {
    uint8_t nonce[32];
    if (!sessionAuthenticated) { SerialBT.println("ERR_AUTH_REQUIRED"); return; }
    if (!mlUnhex(command.substring(10), nonce, sizeof(nonce))) { SerialBT.println("ERR_INVALID_CHALLENGE"); return; }
    portENTER_CRITICAL(&packetMux);
    memcpy(requestedChallenge, nonce, sizeof(nonce));
    challengeRequested = true;
    portEXIT_CRITICAL(&packetMux);
  } else if (command == "LOCK") {
    appAuthorized = false;
    setEngineAllowed(overrideActive);
    SerialBT.println("OK_LOCKED");
  } else {
    SerialBT.println("ERR_UNSUPPORTED_COMMAND");
  }
}

void handleAppBluetooth() {
  static char frame[APP_FRAME_MAX + 1];
  static size_t used = 0;
  static bool discardFrame = false;
  static uint32_t lastByteMs = 0;
  if (appSessionChanged.exchange(false)) {
    used = 0;
    discardFrame = false;
    lastAppStatusMs = 0;
    sessionAuthenticated = false;
    appAuthorized = false;
    appNonce = "";
    appSentGeneration = 0;
  }
  if (appTransportConnected.load() && !SerialBT.hasClient()) appTransportConnected = false;
  if (!appTransportConnected.load()) {
    appConnected = false;
    sessionAuthenticated = false;
    appAuthorized = false;
    appNonce = "";
    setEngineAllowed(overrideActive);
    used = 0;
    discardFrame = false;
    while (SerialBT.available()) SerialBT.read();
    return;
  }
  if (millis() - lastAppHeartbeatMs.load() > APP_HEARTBEAT_TIMEOUT_MS) {
    appConnected = false;
    sessionAuthenticated = false;
    appAuthorized = false;
    appNonce = "";
    setEngineAllowed(overrideActive);
    // Continue servicing input: a new heartbeat can restore link indication,
    // but session authentication and unlock authorization must be repeated.
  }

  if (used && millis() - lastByteMs > APP_FRAME_TIMEOUT_MS) {
    used = 0;
    discardFrame = true;
    SerialBT.println("ERR_FRAME_TIMEOUT");
  }
  // Bound each pass so a busy phone cannot starve relay/GPS updates.
  for (size_t budget = 0; budget < 128 && SerialBT.available(); ++budget) {
    const char ch = static_cast<char>(SerialBT.read());
    lastByteMs = millis();
    if (ch == '\n') {
      const bool handled = !discardFrame && used;
      if (!discardFrame && used) {
        frame[used] = '\0';
        handleAppCommand(frame);
      }
      used = 0;
      discardFrame = false;
      if (handled) break;  // At most one command reply per relay-loop iteration.
    } else if (ch != '\r' && !discardFrame) {
      if (used == APP_FRAME_MAX || ch < 32 || ch > 126) {
        used = 0;
        discardFrame = true;
        SerialBT.println("ERR_INVALID_FRAME");
      } else {
        frame[used++] = ch;
      }
    }
  }

  if (appConnected.load() && millis() - lastAppStatusMs >= 1000) {
    lastAppStatusMs = millis();
    sendAppStatus();
  }
  uint8_t signedFrame[ML_FRAME_SIZE];
  portENTER_CRITICAL(&packetMux);
  const uint32_t generation = verifiedGeneration;
  memcpy(signedFrame, verifiedFrame, sizeof(signedFrame));
  portEXIT_CRITICAL(&packetMux);
  if (sessionAuthenticated && helmetPacketFresh() && generation != appSentGeneration) {
    appSentGeneration = generation;
    SerialBT.println("TELEMETRY:" + mlHex(signedFrame, ML_PAYLOAD_SIZE) + "," +
        mlHex(signedFrame + ML_PAYLOAD_SIZE + 1, signedFrame[ML_PAYLOAD_SIZE]));
  }
}

void setEngineAllowed(bool allowed) {
  engineOutputAllowed = allowed;
  const bool relayLevel = RELAY_ACTIVE_LOW ? !allowed : allowed;
  digitalWrite(RELAY_PIN, relayLevel);
  digitalWrite(GREEN_LED_PIN, LED_ACTIVE_HIGH ? allowed : !allowed);
  digitalWrite(RED_LED_PIN, LED_ACTIVE_HIGH ? !allowed : allowed);
}

void showStatus(const char *line1, const char *line2, const char *line3 = "") {
  if (!displayAvailable) return;
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("MotoLock");
  display.drawLine(0, 10, 127, 10, SSD1306_WHITE);
  display.setCursor(0, 16);
  display.println(line1);
  display.println(line2);
  display.println(line3);
  display.drawLine(0, 49, 127, 49, SSD1306_WHITE);
  display.setCursor(0, 54);
  display.print("APP: ");
  display.println(appConnected.load() ? "CONNECTED" : "NOT CONNECTED");
  display.display();
}

void feedGps() {
  while (gpsSerial.available()) gps.encode(gpsSerial.read());
}

String gpsLink() {
  feedGps();
  if (!gps.location.isValid() || gps.location.age() > 30000) {
    return "GPS location unavailable";
  }
  return "https://maps.google.com/?q=" + String(gps.location.lat(), 6) +
         "," + String(gps.location.lng(), 6);
}

bool waitForModem(const char *expected, uint32_t timeoutMs) {
  String response;
  const uint32_t start = millis();
  while (millis() - start < timeoutMs) {
    feedGps();
    while (modemSerial.available()) response += char(modemSerial.read());
    if (response.indexOf(expected) >= 0) return true;
    if (response.indexOf("ERROR") >= 0) return false;
    delay(10);
  }
  Serial.println("MODEM: " + response);
  return false;
}

bool modemCommand(const String &command, const char *expected = "OK",
                  uint32_t timeoutMs = 2000) {
  while (modemSerial.available()) modemSerial.read();
  modemSerial.println(command);
  return waitForModem(expected, timeoutMs);
}

bool sendSms(const String &message) {
  if (!SIM7600_ENABLED) {
    Serial.println("SMS disabled: SIM7600 dev/carrier board not installed.");
    return false;
  }
  if (strlen(ALERT_PHONE_NUMBER) < 10 || strchr(ALERT_PHONE_NUMBER, 'X')) {
    Serial.println("SMS skipped: set ALERT_PHONE_NUMBER first.");
    return false;
  }
  if (!modemCommand("AT") || !modemCommand("AT+CMGF=1")) return false;
  while (modemSerial.available()) modemSerial.read();
  modemSerial.print("AT+CMGS=\"");
  modemSerial.print(ALERT_PHONE_NUMBER);
  modemSerial.println("\"");
  if (!waitForModem(">", 5000)) return false;
  modemSerial.print(message);
  modemSerial.write(26);  // Ctrl+Z
  return waitForModem("+CMGS:", 20000);
}

void sendAlertWithCooldown(const String &reason) {
  if (lastAlertMs != 0 && millis() - lastAlertMs < ALERT_COOLDOWN_MS) return;
  lastAlertMs = millis();
  sendSms("MotoLock alert: " + reason + ". " + gpsLink());
}

static void telemetryNotifyCallback(BLERemoteCharacteristic *, uint8_t *data,
                                    size_t length, bool) {
  if (length != ML_FRAME_SIZE) return;
  portENTER_CRITICAL(&packetMux);
  memcpy(rawFrame, data, length);
  rawFramePending = true;
  portEXIT_CRITICAL(&packetMux);
}

bool validSensorPacket(const HelmetPacket &packet) {
  const uint8_t knownFlags = FLAG_WORN | FLAG_WARMED_UP | FLAG_ALCOHOL_CLEAR |
                             FLAG_SENSOR_OK | FLAG_STABILIZING;
  if (packet.version != 2 || (packet.flags & ~knownFlags) ||
      packet.mqRaw > 4095 || packet.cleanAirBaseline > 4095) return false;
  if ((packet.flags & FLAG_SENSOR_OK) &&
      (packet.mqRaw <= 5 || packet.mqRaw >= 4090 ||
       packet.cleanAirBaseline <= 5 || packet.cleanAirBaseline >= 4090)) return false;
  if ((packet.flags & FLAG_ALCOHOL_CLEAR) &&
      (!(packet.flags & FLAG_WARMED_UP) || !(packet.flags & FLAG_SENSOR_OK) ||
       (packet.flags & FLAG_STABILIZING))) return false;
  return true;
}

class ClientCallbacks final : public BLEClientCallbacks {
  void onConnect(BLEClient *) override {
    portENTER_CRITICAL(&packetMux);
    bleLinkConnected = true;
    receivedPacket = false;
    pendingPacket = {};
    rawFramePending = false;
    connectedAtMs = millis();
    portEXIT_CRITICAL(&packetMux);
  }
  void onDisconnect(BLEClient *) override {
    portENTER_CRITICAL(&packetMux);
    bleLinkConnected = false;
    receivedPacket = false;
    pendingPacket = {};
    rawFramePending = false;
    candidateIdentity[0] = 0;
    portEXIT_CRITICAL(&packetMux);
  }
};

class ScanCallbacks final : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) override {
    if (advertisedDevice.haveServiceUUID() &&
        advertisedDevice.isAdvertisingService(BLEUUID(MOTOLOCK_SERVICE_UUID))) {
      if (EXPECTED_HELMET_ADDRESS[0] &&
          !BLEAddress(EXPECTED_HELMET_ADDRESS).equals(advertisedDevice.getAddress())) return;
      char address[18];
      portENTER_CRITICAL(&packetMux);
      memcpy(address, pinnedAddress, sizeof(address));
      portEXIT_CRITICAL(&packetMux);
      if (address[0] && !BLEAddress(address).equals(advertisedDevice.getAddress())) return;
      // One callback producer; the worker consumes only after scan completion.
      if (!helmetDevice) helmetDevice = new BLEAdvertisedDevice(advertisedDevice);
    }
  }
};

bool connectToHelmet() {
  if (!helmetDevice) return false;
  if (!bleClient) {
    bleClient = BLEDevice::createClient();
    bleClient->setClientCallbacks(new ClientCallbacks());
  }
  if (!bleClient->connect(helmetDevice)) return false;
  if (!bleClient->setMTU(ML_MTU)) { bleClient->disconnect(); return false; }

  BLERemoteService *service =
      bleClient->getService(BLEUUID(MOTOLOCK_SERVICE_UUID));
  if (!service) {
    bleClient->disconnect();
    return false;
  }
  helmetTelemetry = service->getCharacteristic(BLEUUID(MOTOLOCK_TELEMETRY_UUID));
  helmetChallenge = service->getCharacteristic(BLEUUID(MOTOLOCK_CHALLENGE_UUID));
  auto *identityCharacteristic = service->getCharacteristic(BLEUUID(MOTOLOCK_IDENTITY_UUID));
  if (!helmetTelemetry || !helmetTelemetry->canNotify() || !helmetChallenge ||
      !helmetChallenge->canWrite() || !identityCharacteristic || !identityCharacteristic->canRead()) {
    bleClient->disconnect();
    return false;
  }
  const String identity = identityCharacteristic->readValue().c_str();
  const int comma1 = identity.indexOf(',');
  const int comma2 = identity.indexOf(',', comma1 + 1);
  uint8_t id[6], publicDer[128];
  const String publicHex = identity.substring(comma2 + 1);
  char pinned[256];
  portENTER_CRITICAL(&packetMux);
  memcpy(pinned, pinnedIdentity, sizeof(pinned));
  portEXIT_CRITICAL(&packetMux);
  if (identity.length() >= sizeof(candidateIdentity) || comma1 != 12 || comma2 != 23 ||
      !mlUnhex(identity.substring(0, comma1), id, sizeof(id)) ||
      publicHex.length() == 0 || publicHex.length() > sizeof(publicDer) * 2 || publicHex.length() % 2 ||
      !mlUnhex(publicHex, publicDer, publicHex.length() / 2) ||
      (pinned[0] && identity != pinned)) {
    bleClient->disconnect();
    return false;
  }
  mbedtls_pk_free(&helmetVerificationKey);
  mbedtls_pk_init(&helmetVerificationKey);
  if (mbedtls_pk_parse_public_key(&helmetVerificationKey, publicDer, publicHex.length() / 2) != 0) {
    bleClient->disconnect();
    return false;
  }
  const String address = helmetDevice->getAddress().toString().c_str();
  portENTER_CRITICAL(&packetMux);
  strlcpy(candidateIdentity, identity.c_str(), sizeof(candidateIdentity));
  strlcpy(candidateAddress, address.c_str(), sizeof(candidateAddress));
  connectedAtMs = millis();
  portEXIT_CRITICAL(&packetMux);
  helmetTelemetry->registerForNotify(telemetryNotifyCallback);
  return true;
}

void helmetBluetoothTask(void *) {
  mbedtls_pk_init(&helmetVerificationKey);
  uint8_t nonce[32]{};
  uint32_t challengeMs = 0;
  uint64_t lastSequence = 0;
  bool mustChallenge = true;
  BLEScan *scan = BLEDevice::getScan();
  scan->setAdvertisedDeviceCallbacks(new ScanCallbacks(), false);
  scan->setActiveScan(true);
  scan->setInterval(100);
  scan->setWindow(40);  // Leave airtime for the phone's Classic Bluetooth link.
  for (;;) {
    if (!bleClient || !bleClient->isConnected()) {
      helmetTelemetry = nullptr;
      scan->start(2, false);  // Blocking work stays off the relay/app loop.
      const bool connected = helmetDevice && connectToHelmet();
      mustChallenge = true;
      lastSequence = 0;
      delete helmetDevice;
      helmetDevice = nullptr;
      scan->clearResults();
      if (!connected) {
        if (bleClient && bleClient->isConnected()) bleClient->disconnect();
        vTaskDelay(pdMS_TO_TICKS(1000));
      }
    } else {
      uint8_t frame[ML_FRAME_SIZE];
      bool newChallenge;
      uint8_t nextNonce[32];
      bool hasFrame;
      char identity[256];
      portENTER_CRITICAL(&packetMux);
      newChallenge = challengeRequested;
      if (newChallenge) {
        memcpy(nextNonce, requestedChallenge, sizeof(nextNonce));
        challengeRequested = false;
      }
      hasFrame = rawFramePending;
      memcpy(frame, rawFrame, sizeof(frame));
      rawFramePending = false;
      memcpy(identity, candidateIdentity, sizeof(identity));
      portEXIT_CRITICAL(&packetMux);
      if (newChallenge || mustChallenge || millis() - challengeMs >= 5000) {
        if (!newChallenge) esp_fill_random(nextNonce, sizeof(nextNonce));
        if (mustChallenge || memcmp(nonce, nextNonce, sizeof(nonce)) != 0) lastSequence = 0;
        memcpy(nonce, nextNonce, sizeof(nonce));
        challengeMs = millis();
        mustChallenge = false;
        helmetChallenge->writeValue(nonce, sizeof(nonce), true);
      }
      if (hasFrame && memcmp(frame + 11, nonce, sizeof(nonce)) == 0 && mlVerify(&helmetVerificationKey, frame)) {
        HelmetPacket packet{};
        packet.version = frame[0];
        packet.flags = frame[51];
        packet.mqRaw = mlGet(frame + 52, 2);
        packet.cleanAirBaseline = mlGet(frame + 54, 2);
        const uint64_t sequence = mlGet(frame + 43, 8);
        packet.sequence = static_cast<uint16_t>(sequence);  // Diagnostic display only.
        const String signedIdentity = mlHex(frame + 1, 6) + "," + mlVisualId(mlGet(frame + 7, 4)) + ",";
        if (sequence > lastSequence && mlGet(frame + 7, 4) <= 0x3ffff &&
            String(identity).startsWith(signedIdentity) && validSensorPacket(packet)) {
          lastSequence = sequence;
          portENTER_CRITICAL(&packetMux);
          if (bleLinkConnected && (!pinnedIdentity[0] || strcmp(identity, pinnedIdentity) == 0)) {
            pendingPacket = packet;
            receivedPacketMs = millis();
            receivedPacket = true;
            memcpy(verifiedFrame, frame, sizeof(frame));
            ++verifiedGeneration;
          }
          portEXIT_CRITICAL(&packetMux);
        }
      }
      portENTER_CRITICAL(&packetMux);
      const uint32_t referenceMs = receivedPacket ? receivedPacketMs : connectedAtMs;
      portEXIT_CRITICAL(&packetMux);
      if (millis() - referenceMs > HELMET_TIMEOUT_MS) {
        Serial.println("Helmet telemetry timed out; reconnecting.");
        bleClient->disconnect();
      }
    }
    vTaskDelay(pdMS_TO_TICKS(50));
  }
}

void handlePairingButton() {
  static uint32_t pressedMs = 0;
  static bool held = false;
  const bool pressed = digitalRead(PAIRING_BUTTON_PIN) == LOW;
  if (!pressed) { pressedMs = 0; held = false; }
  else if (!pressedMs) pressedMs = millis();
  else if (!held && millis() - pressedMs >= 3000) {
    held = true;
    if (!deviceSecret.length()) {
      provisioningMode = true;
      provisioningStartedMs = millis();
      Serial.println("Pairing open for 60 seconds. Pair only your nearby helmet.");
    } else Serial.println("Already provisioned. Erase motor NVS deliberately to change ownership.");
  }
  if (provisioningMode && millis() - provisioningStartedMs >= 60000) provisioningMode = false;
}

void handleOverrideButton() {
  static uint32_t pressedAt = 0;
  static bool handled = false;
  const bool pressed = digitalRead(OVERRIDE_BUTTON_PIN) == LOW;

  if (pressed && pressedAt == 0) {
    pressedAt = millis();
    handled = false;
  }
  if (pressed && !handled && millis() - pressedAt >= OVERRIDE_HOLD_MS) {
    overrideActive = true;
    overrideEndsMs = millis() + OVERRIDE_DURATION_MS;
    handled = true;
    sendAlertWithCooldown("manual override activated");
  }
  if (!pressed) pressedAt = 0;
  if (overrideActive && static_cast<int32_t>(millis() - overrideEndsMs) >= 0) {
    overrideActive = false;
  }
}

void setup() {
  Serial.begin(115200);

  // Preload the locked level before changing GPIO 25 to OUTPUT. This avoids
  // a brief active-low relay pulse during boot. GPIO assignments stay unchanged.
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(OVERRIDE_BUTTON_PIN, INPUT_PULLUP);
  pinMode(PAIRING_BUTTON_PIN, INPUT_PULLUP);
  setEngineAllowed(false);
  if (!pairingStore.begin("motolock", false)) {
    Serial.println("Pairing storage failed.");
    while (true) delay(1000);
  }
  const String saved = pairingStore.getString("pairing", "");
  if (saved.length()) {
    const int first = saved.indexOf('|');
    const int second = saved.indexOf('|', first + 1);
    if (first != 64 || second <= first || saved.length() - second - 1 != 17 || second - first - 1 >= 256) {
      Serial.println("Pairing record invalid; engine locked.");
      while (true) delay(1000);
    }
    deviceSecret = saved.substring(0, first);
    strlcpy(pinnedIdentity, saved.substring(first + 1, second).c_str(), sizeof(pinnedIdentity));
    strlcpy(pinnedAddress, saved.substring(second + 1).c_str(), sizeof(pinnedAddress));
  }

  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  displayAvailable = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS);
  showStatus("Starting...", "Engine locked");

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  if (SIM7600_ENABLED) {
    modemSerial.begin(115200, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
  } else {
    Serial.println("SIM7600 disabled - running without SMS alerts.");
  }
  BLEDevice::init("MotoLock-Motor");
  BLEDevice::setMTU(ML_MTU);
  SerialBT.register_callback(bluetoothAppCallback);
  if (SerialBT.begin("MotoLock-Motor", false, false)) {
    Serial.println("Classic Bluetooth ready: MotoLock-Motor");
  } else {
    Serial.println("Classic Bluetooth failed to start.");
  }
  if (xTaskCreate(helmetBluetoothTask, "helmetBLE", 8192, nullptr, 1, nullptr) != pdPASS) {
    Serial.println("Unable to start helmet BLE task; engine stays locked.");
  }
}

void loop() {
  feedGps();
  handlePairingButton();
  handleOverrideButton();
  portENTER_CRITICAL(&packetMux);
  latestPacket = pendingPacket;
  helmetConnected = bleLinkConnected;
  havePacket = receivedPacket;
  lastPacketMs = receivedPacketMs;
  portEXIT_CRITICAL(&packetMux);

  const bool packetFresh = helmetPacketFresh();
  const bool packetVersionOk = latestPacket.version == 2;
  const bool helmetWorn = latestPacket.flags & FLAG_WORN;
  const bool warmedUp = latestPacket.flags & FLAG_WARMED_UP;
  const bool sensorOk = latestPacket.flags & FLAG_SENSOR_OK;
  const bool alcoholClear = latestPacket.flags & FLAG_ALCOHOL_CLEAR;
  const bool stabilizing = latestPacket.flags & FLAG_STABILIZING;
  const float alcoholPercent = estimateAlcoholPercent(
      latestPacket.mqRaw, latestPacket.cleanAirBaseline);
  const bool normalPermission = packetFresh && packetVersionOk && helmetWorn &&
                                warmedUp && sensorOk && alcoholClear;
  if (!normalPermission || !appConnected.load()) appAuthorized = false;
  const bool engineAllowed = (normalPermission && appAuthorized) || overrideActive;
  setEngineAllowed(engineAllowed);
  handleAppBluetooth();

  static uint32_t lastDisplayMs = 0;
  if (millis() - lastDisplayMs >= 500) {
    lastDisplayMs = millis();
    char alcoholLine[32];
    snprintf(alcoholLine, sizeof(alcoholLine), "Alcohol: %.3f%%",
             alcoholPercent);

    if (provisioningMode) {
      showStatus("PAIRING ACTIVE", "Select MotoLock-Motor", "Keep own helmet nearby");
    } else if (overrideActive) {
      showStatus("OVERRIDE ACTIVE", "Engine enabled", alcoholLine);
    } else if (!packetFresh) {
      showStatus("Helmet not found", "Engine locked", "Searching BLE...");
    } else if (!helmetWorn) {
      showStatus("Wear helmet", "Engine locked", alcoholLine);
    } else if (!sensorOk || !warmedUp) {
      showStatus("Sensor not ready", "Engine locked", alcoholLine);
    } else if (stabilizing) {
      showStatus("SENSOR STABILIZING", "Clear air - wait", alcoholLine);
    } else if (!alcoholClear) {
      showStatus("ALCOHOL >= 0.050%", "Engine locked", alcoholLine);
      sendAlertWithCooldown("alcohol threshold exceeded");
    } else if (!appAuthorized) {
      showStatus("Helmet verified", "Verify face in app", "Engine locked");
    } else {
      showStatus("Helmet verified", "Engine enabled", alcoholLine);
    }
  }

  delay(10);
}
