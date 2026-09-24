/*
  MotoLock helmet transmitter for ESP32 Dev Module (ESP32-WROOM).
  Existing sensor wiring: MQ-3 AO -> GPIO 34; IR DO -> GPIO 3.
  No helmet status LED is installed.

  NOTE: GPIO 3 is serial RX, so the attached IR sensor can affect upload or
  Serial Monitor input. GPIO signals must never exceed 3.3 V. Do not connect
  the MQ-3 heater to an ESP32 GPIO.
*/

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

constexpr uint8_t MQ3_ANALOG_PIN = 34;
constexpr uint8_t IR_DIGITAL_PIN = 3;
// This IR module reports HIGH when its detection output is active.
// If testing later proves the opposite, change this back to true.
constexpr bool IR_ACTIVE_LOW = false;

constexpr uint32_t MQ3_WARMUP_MS = 60000;   // Demo setting; sensor may need longer
constexpr uint32_t BASELINE_SAMPLE_MS = 15000;
constexpr uint8_t ALCOHOL_CONFIRM_SAMPLES = 2;
constexpr uint8_t RECOVERY_CONFIRM_SAMPLES = 5;
constexpr uint16_t MQ3_ALCOHOL_DEADBAND_RAW = 35;
constexpr uint16_t MQ3_RECOVERY_DELTA_RAW = 110;
constexpr float ALCOHOL_LIMIT_PERCENT = 0.050f;
constexpr float ALCOHOL_DISPLAY_MAX_PERCENT = 0.500f;
constexpr uint32_t SEND_INTERVAL_MS = 1000;

// Must match the motor controller sketch exactly.
#define MOTOLOCK_SERVICE_UUID        "7ce10001-6d79-4f8b-9a33-5f4739a90001"
#define MOTOLOCK_TELEMETRY_UUID      "7ce10002-6d79-4f8b-9a33-5f4739a90001"

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

BLECharacteristic *telemetryCharacteristic = nullptr;
bool receiverConnected = false;
uint16_t cleanAirBaseline = 0;
uint16_t sequenceNumber = 0;
uint8_t highReadingCount = 0;
uint8_t recoveryCount = 0;
bool alcoholLatched = false;

class ServerCallbacks final : public BLEServerCallbacks {
  void onConnect(BLEServer *) override { receiverConnected = true; }

  void onDisconnect(BLEServer *server) override {
    receiverConnected = false;
    delay(100);
    server->getAdvertising()->start();
  }
};

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
  }
  return count ? static_cast<uint16_t>(total / count) : 0;
}

float estimateAlcoholPercent(uint16_t mqRaw) {
  if (cleanAirBaseline >= 4095) return 0.0f;

  float delta = static_cast<float>(mqRaw) - cleanAirBaseline -
                MQ3_ALCOHOL_DEADBAND_RAW;
  if (delta < 0.0f) delta = 0.0f;

  float usableRange = 4095.0f - cleanAirBaseline;
  if (usableRange < 1.0f) usableRange = 1.0f;

  float percent = (delta / usableRange) * ALCOHOL_DISPLAY_MAX_PERCENT;
  if (percent > ALCOHOL_DISPLAY_MAX_PERCENT) {
    percent = ALCOHOL_DISPLAY_MAX_PERCENT;
  }
  return percent;
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
  analogReadResolution(12);
  analogSetPinAttenuation(MQ3_ANALOG_PIN, ADC_11db);

  Serial.println("MQ-3 warming up...");
  const uint32_t warmupStart = millis();
  while (millis() - warmupStart < MQ3_WARMUP_MS) {
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
  const bool irRaw = digitalRead(IR_DIGITAL_PIN);
  const bool worn = IR_ACTIVE_LOW ? !irRaw : irRaw;
  const bool sensorOk = mqRaw > 5 && mqRaw < 4090 && cleanAirBaseline > 5;
  const float alcoholPercent = sensorOk ? estimateAlcoholPercent(mqRaw) : 0.0f;
  const bool readingAlcohol = sensorOk &&
                              alcoholPercent >= ALCOHOL_LIMIT_PERCENT;

  if (readingAlcohol && worn) {
    if (highReadingCount < 255) ++highReadingCount;
    recoveryCount = 0;
    if (highReadingCount >= ALCOHOL_CONFIRM_SAMPLES) alcoholLatched = true;
  } else {
    highReadingCount = 0;
  }

  // Once alcohol is detected, require several consecutive clean-air readings
  // before clearing the lock. This prevents an immediate false PASS while the
  // MQ-3 is still recovering from alcohol vapor.
  if (alcoholLatched && sensorOk && !readingAlcohol) {
    const bool recovered = mqRaw <=
        static_cast<uint32_t>(cleanAirBaseline) + MQ3_RECOVERY_DELTA_RAW;
    if (recovered) {
      if (recoveryCount < 255) ++recoveryCount;
      if (recoveryCount >= RECOVERY_CONFIRM_SAMPLES) {
        alcoholLatched = false;
        recoveryCount = 0;
      }
    } else {
      recoveryCount = 0;
    }
  }

  const bool stabilizing = alcoholLatched && !readingAlcohol;
  const bool alcoholClear = sensorOk && !alcoholLatched;

  HelmetPacket packet{};
  packet.version = 1;
  packet.flags = FLAG_WARMED_UP;
  if (worn) packet.flags |= FLAG_WORN;
  if (alcoholClear) packet.flags |= FLAG_ALCOHOL_CLEAR;
  if (sensorOk) packet.flags |= FLAG_SENSOR_OK;
  if (stabilizing) packet.flags |= FLAG_STABILIZING;
  packet.mqRaw = mqRaw;
  packet.cleanAirBaseline = cleanAirBaseline;
  packet.sequence = sequenceNumber++;

  telemetryCharacteristic->setValue(
      reinterpret_cast<uint8_t *>(&packet), sizeof(packet));
  if (receiverConnected) telemetryCharacteristic->notify();

  Serial.printf("BLE=%d IRraw=%d worn=%d clear=%d stabilizing=%d "
                "Alcohol=%.3f%% MQ=%u baseline=%u seq=%u\n",
                receiverConnected, irRaw, worn, alcoholClear, stabilizing,
                alcoholPercent, mqRaw, cleanAirBaseline, packet.sequence);
}
