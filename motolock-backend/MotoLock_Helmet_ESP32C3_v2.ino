/*
  MotoLock - Helmet transmitter
  Board: ESP32-C3 Super Mini

  Sends helmet-worn and MQ-3 readings to the motorcycle receiver over BLE.
  IMPORTANT: MQ-3 readings are prototype screening values, not legal BrAC.

  V2 hardware note:
  - Pin assignments are unchanged from the original MotoLock code.
  - The helmet remains battery-powered through its TP4056/LiPo power system.
  - The motorcycle LM2596 buck converter is not connected to this helmet unit.
*/

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

// --------------------------- PIN MAP ---------------------------------
constexpr uint8_t MQ3_ANALOG_PIN = 0;  // MQ-3 AO through safe 0-3.3 V divider
constexpr uint8_t IR_DIGITAL_PIN = 3;  // IR module DO; must be safe at 3.3 V
constexpr uint8_t STATUS_LED_PIN = 8;  // Common onboard LED on C3 Super Mini

// Set these to match the modules after bench testing.
constexpr bool IR_ACTIVE_LOW = true;
constexpr bool LED_ACTIVE_LOW = true;

// MQ-3 prototype calibration. The helmet calculates a clean-air baseline at boot.
constexpr uint32_t MQ3_WARMUP_MS = 60000;       // Demo only; see README for burn-in
constexpr uint32_t BASELINE_SAMPLE_MS = 15000;
constexpr uint16_t ALCOHOL_DELTA_RAW = 450;     // Tune using controlled test data
constexpr uint8_t ALCOHOL_CONFIRM_SAMPLES = 2;
constexpr uint32_t SEND_INTERVAL_MS = 1000;

// Both sketches must use the same UUIDs.
#define MOTOLOCK_SERVICE_UUID        "7ce10001-6d79-4f8b-9a33-5f4739a90001"
#define MOTOLOCK_TELEMETRY_UUID      "7ce10002-6d79-4f8b-9a33-5f4739a90001"

enum HelmetFlags : uint8_t {
  FLAG_WORN          = 1 << 0,
  FLAG_WARMED_UP     = 1 << 1,
  FLAG_ALCOHOL_CLEAR = 1 << 2,
  FLAG_SENSOR_OK     = 1 << 3
};

// Fixed binary packet shared with the receiver sketch.
struct __attribute__((packed)) HelmetPacket {
  uint8_t version;
  uint8_t flags;
  uint16_t mqRaw;
  uint16_t cleanAirBaseline;
  uint16_t sequence;
};

BLECharacteristic *telemetryCharacteristic = nullptr;
bool receiverConnected = false;
uint16_t cleanAirBaseline = 0;
uint16_t sequenceNumber = 0;
uint8_t highReadingCount = 0;

class ServerCallbacks final : public BLEServerCallbacks {
  void onConnect(BLEServer *) override { receiverConnected = true; }

  void onDisconnect(BLEServer *server) override {
    receiverConnected = false;
    delay(100);
    server->getAdvertising()->start();
  }
};

void setStatusLed(bool on) {
  digitalWrite(STATUS_LED_PIN, LED_ACTIVE_LOW ? !on : on);
}

bool helmetIsWorn() {
  const bool raw = digitalRead(IR_DIGITAL_PIN);
  return IR_ACTIVE_LOW ? !raw : raw;
}

uint16_t averageMq3(uint8_t samples = 16) {
  uint32_t total = 0;
  for (uint8_t i = 0; i < samples; ++i) {
    total += analogRead(MQ3_ANALOG_PIN);
    delay(8);
  }
  return static_cast<uint16_t>(total / samples);
}

uint16_t establishCleanAirBaseline() {
  Serial.println("Keep alcohol away from the sensor: establishing baseline...");
  const uint32_t start = millis();
  uint32_t total = 0;
  uint16_t count = 0;

  while (millis() - start < BASELINE_SAMPLE_MS) {
    total += averageMq3(8);
    ++count;
    setStatusLed((millis() / 250) % 2);
  }
  setStatusLed(false);
  return count ? static_cast<uint16_t>(total / count) : 0;
}

void setupBle() {
  BLEDevice::init("MOTOLOCK_HELMET");
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  BLEService *service = server->createService(MOTOLOCK_SERVICE_UUID);
  telemetryCharacteristic = service->createCharacteristic(
      MOTOLOCK_TELEMETRY_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  telemetryCharacteristic->addDescriptor(new BLE2902());
  service->start();

  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(MOTOLOCK_SERVICE_UUID);
  advertising->setScanResponse(true);
  advertising->setMinPreferred(0x06);
  advertising->setMaxPreferred(0x12);
  advertising->start();
}

void setup() {
  Serial.begin(115200);
  pinMode(IR_DIGITAL_PIN, INPUT_PULLUP);
  pinMode(STATUS_LED_PIN, OUTPUT);
  setStatusLed(false);
  analogReadResolution(12);
  analogSetPinAttenuation(MQ3_ANALOG_PIN, ADC_11db);

  // The MQ-3 heater must be powered from a suitable regulated rail, not a GPIO.
  Serial.println("MQ-3 warming up...");
  const uint32_t warmupStart = millis();
  while (millis() - warmupStart < MQ3_WARMUP_MS) {
    setStatusLed((millis() / 500) % 2);
    delay(20);
  }
  cleanAirBaseline = establishCleanAirBaseline();
  setupBle();
  Serial.printf("Ready. Baseline=%u\n", cleanAirBaseline);
}

void loop() {
  static uint32_t lastSend = 0;
  if (millis() - lastSend < SEND_INTERVAL_MS) {
    delay(10);
    return;
  }
  lastSend = millis();

  const uint16_t mqRaw = averageMq3();
  const bool worn = helmetIsWorn();
  const bool sensorOk = mqRaw > 5 && mqRaw < 4090 && cleanAirBaseline > 5;
  const bool readingHigh = sensorOk &&
      mqRaw > static_cast<uint32_t>(cleanAirBaseline) + ALCOHOL_DELTA_RAW;

  if (readingHigh && worn) {
    if (highReadingCount < 255) ++highReadingCount;
  } else {
    highReadingCount = 0;
  }
  const bool alcoholClear = sensorOk && highReadingCount < ALCOHOL_CONFIRM_SAMPLES;

  HelmetPacket packet{};
  packet.version = 1;
  packet.flags = FLAG_WARMED_UP;
  if (worn) packet.flags |= FLAG_WORN;
  if (alcoholClear) packet.flags |= FLAG_ALCOHOL_CLEAR;
  if (sensorOk) packet.flags |= FLAG_SENSOR_OK;
  packet.mqRaw = mqRaw;
  packet.cleanAirBaseline = cleanAirBaseline;
  packet.sequence = sequenceNumber++;

  telemetryCharacteristic->setValue(
      reinterpret_cast<uint8_t *>(&packet), sizeof(packet));
  if (receiverConnected) telemetryCharacteristic->notify();

  setStatusLed(receiverConnected);
  Serial.printf("BLE=%d worn=%d clear=%d MQ=%u baseline=%u seq=%u\n",
                receiverConnected, worn, alcoholClear, mqRaw,
                cleanAirBaseline, packet.sequence);
}
