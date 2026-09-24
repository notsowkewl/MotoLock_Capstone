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
constexpr uint32_t HELMET_TIMEOUT_MS = 5000;
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

Adafruit_SSD1306 display(128, 64, &Wire, -1);
TinyGPSPlus gps;
HardwareSerial gpsSerial(1);
HardwareSerial modemSerial(2);
BluetoothSerial SerialBT;

BLEAdvertisedDevice *helmetDevice = nullptr;
BLEClient *bleClient = nullptr;
BLERemoteCharacteristic *helmetTelemetry = nullptr;

volatile bool packetPending = false;
volatile bool appConnected = false;
portMUX_TYPE packetMux = portMUX_INITIALIZER_UNLOCKED;
HelmetPacket pendingPacket{};
HelmetPacket latestPacket{};

bool helmetConnected = false;
bool scanning = false;
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
    appConnected = true;
  } else if (event == ESP_SPP_CLOSE_EVT) {
    appConnected = false;
  }
}

bool helmetPacketFresh() {
  return helmetConnected && lastPacketMs != 0 &&
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
  const bool packetFresh = helmetPacketFresh();
  const bool helmetWorn = latestPacket.flags & FLAG_WORN;
  const bool warmedUp = latestPacket.flags & FLAG_WARMED_UP;
  const bool sensorOk = latestPacket.flags & FLAG_SENSOR_OK;
  const bool alcoholClear = latestPacket.flags & FLAG_ALCOHOL_CLEAR;
  const bool stabilizing = latestPacket.flags & FLAG_STABILIZING;
  const float alcoholPercent = estimateAlcoholPercent(
      latestPacket.mqRaw, latestPacket.cleanAirBaseline);
  const bool engineAllowed = overrideActive ||
      (packetFresh && latestPacket.version == 1 && helmetWorn &&
       warmedUp && sensorOk && alcoholClear);

  String status;
  status.reserve(420);
  status = "STATUS:{";
  status += "\"verificationProtocol\":2,";
  status += "\"verificationSession\":\"\",";
  status += "\"helmetDataFresh\":";
  status += packetFresh ? "true," : "false,";
  status += "\"mq3Value\":" + String(latestPacket.mqRaw);
  status += ",\"brac\":" + String(alcoholPercent, 3);
  status += ",\"highestBrac\":" + String(alcoholPercent, 3);
  status += ",\"displayBrac\":" + String(alcoholPercent, 3);
  status += ",\"testStatus\":\"";
  status += !packetFresh ? "HELMET_NOT_FOUND" :
            (!sensorOk || !warmedUp ? "SENSOR_NOT_READY" :
             (stabilizing ? "STABILIZING" :
              (!alcoholClear ? "RESULT_FAIL" : "RESULT_PASS")));
  status += "\"";
  status += ",\"remainingSeconds\":0";
  status += ",\"mq3Baseline\":" + String(latestPacket.cleanAirBaseline);
  status += ",\"mq3CleanBaseline\":" + String(latestPacket.cleanAirBaseline);
  status += ",\"mq3BaselineReady\":";
  status += (sensorOk && warmedUp) ? "true" : "false";
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
  status += ",\"ignitionEnabled\":true";
  status += ",\"startAuthorized\":";
  status += engineAllowed ? "true" : "false";
  status += ",\"breathTestActive\":false}";
  SerialBT.println(status);
}

void handleAppBluetooth() {
  // The callback is the main source of truth. This extra check also clears the
  // display if the Bluetooth stack has already dropped the SPP client.
  if (appConnected && !SerialBT.hasClient()) appConnected = false;

  if (SerialBT.available()) {
    String message = SerialBT.readStringUntil('\n');
    message.trim();
    Serial.println("APP BT: " + message);

    if (message == "STATUS") {
      sendAppStatus();
    } else {
      // The helmet and override safety rules remain the authority for the relay.
      SerialBT.println("CONNECTED");
      sendAppStatus();
    }
  }

  if (appConnected && millis() - lastAppStatusMs >= 1000) {
    lastAppStatusMs = millis();
    sendAppStatus();
  }
}

void setEngineAllowed(bool allowed) {
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
  display.println(appConnected ? "CONNECTED" : "NOT CONNECTED");
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
  if (length != sizeof(HelmetPacket)) return;
  portENTER_CRITICAL(&packetMux);
  memcpy(&pendingPacket, data, sizeof(HelmetPacket));
  packetPending = true;
  portEXIT_CRITICAL(&packetMux);
}

class ClientCallbacks final : public BLEClientCallbacks {
  void onConnect(BLEClient *) override { helmetConnected = true; }
  void onDisconnect(BLEClient *) override {
    helmetConnected = false;
    helmetTelemetry = nullptr;
  }
};

class ScanCallbacks final : public BLEAdvertisedDeviceCallbacks {
  void onResult(BLEAdvertisedDevice advertisedDevice) override {
    if (advertisedDevice.haveServiceUUID() &&
        advertisedDevice.isAdvertisingService(BLEUUID(MOTOLOCK_SERVICE_UUID))) {
      helmetDevice = new BLEAdvertisedDevice(advertisedDevice);
      BLEDevice::getScan()->stop();
      scanning = false;
    }
  }
};

void startHelmetScan() {
  if (scanning || helmetConnected || helmetDevice != nullptr) return;
  BLEScan *scan = BLEDevice::getScan();
  scan->setAdvertisedDeviceCallbacks(new ScanCallbacks(), true);
  scan->setActiveScan(true);
  scan->setInterval(100);
  scan->setWindow(80);
  scanning = true;
  scan->start(5, false);
  scanning = false;
}

bool connectToHelmet() {
  if (!helmetDevice) return false;
  if (!bleClient) {
    bleClient = BLEDevice::createClient();
    bleClient->setClientCallbacks(new ClientCallbacks());
  }
  if (!bleClient->connect(helmetDevice)) return false;

  BLERemoteService *service =
      bleClient->getService(BLEUUID(MOTOLOCK_SERVICE_UUID));
  if (!service) {
    bleClient->disconnect();
    return false;
  }
  helmetTelemetry = service->getCharacteristic(BLEUUID(MOTOLOCK_TELEMETRY_UUID));
  if (!helmetTelemetry || !helmetTelemetry->canNotify()) {
    bleClient->disconnect();
    return false;
  }
  helmetTelemetry->registerForNotify(telemetryNotifyCallback);
  helmetConnected = true;
  delete helmetDevice;
  helmetDevice = nullptr;
  return true;
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

  SerialBT.register_callback(bluetoothAppCallback);
  if (SerialBT.begin("MotoLock-Motor")) {
    Serial.println("Classic Bluetooth ready: MotoLock-Motor");
  } else {
    Serial.println("Classic Bluetooth failed to start.");
  }

  // Preload the locked level before changing GPIO 25 to OUTPUT. This avoids
  // a brief active-low relay pulse during boot. GPIO assignments stay unchanged.
  digitalWrite(RELAY_PIN, RELAY_ACTIVE_LOW ? HIGH : LOW);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN, OUTPUT);
  pinMode(OVERRIDE_BUTTON_PIN, INPUT_PULLUP);
  setEngineAllowed(false);

  Wire.begin(OLED_SDA_PIN, OLED_SCL_PIN);
  displayAvailable = display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDRESS);
  showStatus("Starting...", "Engine locked");

  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);
  if (SIM7600_ENABLED) {
    modemSerial.begin(115200, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
  } else {
    Serial.println("SIM7600 disabled - running without SMS alerts.");
  }
  BLEDevice::init("MOTOLOCK_MOTOR");
}

void loop() {
  feedGps();
  handleAppBluetooth();
  handleOverrideButton();

  if (packetPending) {
    portENTER_CRITICAL(&packetMux);
    latestPacket = pendingPacket;
    packetPending = false;
    portEXIT_CRITICAL(&packetMux);
    lastPacketMs = millis();
  }

  if (!helmetConnected) {
    if (helmetDevice) {
      if (!connectToHelmet()) {
        delete helmetDevice;
        helmetDevice = nullptr;
        delay(250);
      }
    } else {
      startHelmetScan();
    }
  }

  const bool packetFresh = helmetConnected && lastPacketMs != 0 &&
                           millis() - lastPacketMs <= HELMET_TIMEOUT_MS;
  const bool packetVersionOk = latestPacket.version == 1;
  const bool helmetWorn = latestPacket.flags & FLAG_WORN;
  const bool warmedUp = latestPacket.flags & FLAG_WARMED_UP;
  const bool sensorOk = latestPacket.flags & FLAG_SENSOR_OK;
  const bool alcoholClear = latestPacket.flags & FLAG_ALCOHOL_CLEAR;
  const bool stabilizing = latestPacket.flags & FLAG_STABILIZING;
  const float alcoholPercent = estimateAlcoholPercent(
      latestPacket.mqRaw, latestPacket.cleanAirBaseline);
  const bool normalPermission = packetFresh && packetVersionOk && helmetWorn &&
                                warmedUp && sensorOk && alcoholClear;
  const bool engineAllowed = normalPermission || overrideActive;
  setEngineAllowed(engineAllowed);

  static uint32_t lastDisplayMs = 0;
  if (millis() - lastDisplayMs >= 500) {
    lastDisplayMs = millis();
    char alcoholLine[32];
    snprintf(alcoholLine, sizeof(alcoholLine), "Alcohol: %.3f%%",
             alcoholPercent);

    if (overrideActive) {
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
    } else {
      showStatus("Helmet verified", "Engine enabled", alcoholLine);
    }
  }

  delay(10);
}
