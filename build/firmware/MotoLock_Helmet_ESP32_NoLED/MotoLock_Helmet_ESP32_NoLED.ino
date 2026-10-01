/*
  MotoLock helmet transmitter for ESP32 Dev Module (ESP32-WROOM).
  Sensor wiring: MQ-3 AO -> GPIO 34; IR OUT -> GPIO 4.
  No helmet status LED is installed.
  GPIO signals must never exceed 3.3 V. Do not connect the MQ-3 heater to an
  ESP32 GPIO.
*/

#include <Arduino.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <atomic>
#include "MotoLockProtocol.h"

constexpr uint8_t MQ3_ANALOG_PIN = 34;
constexpr uint8_t IR_DIGITAL_PIN = 4;
// The IR module's digital output is active LOW (common open-collector DO).
// Pull it HIGH while idle, then interpret a LOW reading as helmet detection.
constexpr bool IR_ACTIVE_LOW = true;

constexpr uint32_t MQ3_WARMUP_MS = 60000;   // Demo setting; sensor may need longer
constexpr uint32_t BASELINE_SAMPLE_MS = 15000;
constexpr uint8_t ALCOHOL_CONFIRM_SAMPLES = 2;
constexpr uint8_t RECOVERY_CONFIRM_SAMPLES = 5;
constexpr uint16_t MQ3_ALCOHOL_DEADBAND_RAW = 800;
constexpr uint16_t MQ3_RECOVERY_DELTA_RAW = 810;
constexpr float ALCOHOL_LIMIT_PERCENT = 0.050f;
constexpr float ALCOHOL_DISPLAY_MAX_PERCENT = 0.500f;
constexpr uint32_t SEND_INTERVAL_MS = 250;
constexpr uint32_t SENSOR_DECISION_INTERVAL_MS = 1000;
constexpr uint32_t IR_DEBOUNCE_MS = 100;

// Must match the motor controller sketch exactly.
#define MOTOLOCK_SERVICE_UUID        "7ce10001-6d79-4f8b-9a33-5f4739a90001"
#define MOTOLOCK_TELEMETRY_UUID      "7ce10002-6d79-4f8b-9a33-5f4739a90001"
#define MOTOLOCK_AUTH_UUID           "7ce10004-6d79-4f8b-9a33-5f4739a90001"

enum HelmetFlags : uint8_t {
  FLAG_WORN          = 1 << 0,
  FLAG_WARMED_UP     = 1 << 1,
  FLAG_ALCOHOL_CLEAR = 1 << 2,
  FLAG_SENSOR_OK     = 1 << 3,
  FLAG_STABILIZING   = 1 << 4,
  FLAG_APP_AUTHORIZED= 1 << 5
};

struct __attribute__((packed)) HelmetPacket {
  uint8_t version;
  uint8_t flags;
  uint16_t mqRaw;
  uint16_t cleanAirBaseline;
  uint16_t sequence;
};
static_assert(sizeof(HelmetPacket) == 8, "Unexpected sensor snapshot size");

BLECharacteristic *telemetryCharacteristic = nullptr;
std::atomic<bool> receiverConnected{false};
std::atomic<bool> restartAdvertising{false};
bool baselineReady = false;
uint32_t sensorStartedMs = 0;
uint16_t latestMqRaw = 0;
bool worn = false;
uint16_t cleanAirBaseline = 0;
uint64_t sequenceNumber = 0;
uint8_t highReadingCount = 0;
uint8_t recoveryCount = 0;
bool alcoholLatched = false;
mbedtls_pk_context helmetSigningKey;
String helmetIdentity;
uint8_t helmetDeviceId[6];
uint32_t helmetVisualId = 0;
portMUX_TYPE challengeMux = portMUX_INITIALIZER_UNLOCKED;
uint8_t challengeNonce[32]{};
bool challengeReady = false;
uint32_t challengeReceivedMs = 0;

bool setupIdentity() {
  mbedtls_pk_init(&helmetSigningKey);
  Preferences identityStore;
  if (!identityStore.begin("ml-helmet", false)) return false;
  uint8_t keyDer[256];
  const size_t savedSize = identityStore.getBytesLength("private");
  bool ok = false;
  if (savedSize > 0 && savedSize <= sizeof(keyDer)) {
    identityStore.getBytes("private", keyDer, savedSize);
    ok = mbedtls_pk_parse_key(&helmetSigningKey, keyDer, savedSize, nullptr, 0, mlRandom, nullptr) == 0;
  } else if (savedSize == 0) {
    ok = mbedtls_pk_setup(&helmetSigningKey, mbedtls_pk_info_from_type(MBEDTLS_PK_ECKEY)) == 0 &&
         mbedtls_ecp_gen_key(MBEDTLS_ECP_DP_SECP256R1, mbedtls_pk_ec(helmetSigningKey), mlRandom, nullptr) == 0;
    const int size = ok ? mbedtls_pk_write_key_der(&helmetSigningKey, keyDer, sizeof(keyDer)) : -1;
    ok = size > 0 && identityStore.putBytes("private", keyDer + sizeof(keyDer) - size, size) == static_cast<size_t>(size);
  }
  memset(keyDer, 0, sizeof(keyDer));
  identityStore.end();
  if (!ok) return false;  // Never silently replace an unreadable paired identity.
  mlPut(helmetDeviceId, ESP.getEfuseMac(), sizeof(helmetDeviceId));
  helmetVisualId = static_cast<uint32_t>(ESP.getEfuseMac()) & 0x3ffff;
  uint8_t publicDer[128];
  const int publicSize = mbedtls_pk_write_pubkey_der(&helmetSigningKey, publicDer, sizeof(publicDer));
  if (publicSize <= 0) return false;
  helmetIdentity = mlHex(helmetDeviceId, sizeof(helmetDeviceId)) + "," +
      mlVisualId(helmetVisualId) + "," + mlHex(publicDer + sizeof(publicDer) - publicSize, publicSize);
  Serial.println("HELMET_ID:" + helmetIdentity);
  return true;
}

std::atomic<bool> isAppAuthorized{false};
uint32_t helmetRemovedMs = 0;

class AuthCallbacks final : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    const auto value = characteristic->getValue();
    if (value.length() > 0 && value[0] == 1) {
      isAppAuthorized = true;
      Serial.println("App Authorization Received from Motor!");
    } else if (value.length() > 0 && value[0] == 0) {
      isAppAuthorized = false;
    }
  }
};

class ChallengeCallbacks final : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *characteristic) override {
    const auto value = characteristic->getValue();
    if (value.length() != sizeof(challengeNonce)) return;
    portENTER_CRITICAL(&challengeMux);
    memcpy(challengeNonce, value.c_str(), sizeof(challengeNonce));
    challengeReceivedMs = millis();
    challengeReady = true;
    portEXIT_CRITICAL(&challengeMux);
  }
};

class ServerCallbacks final : public BLEServerCallbacks {
  void onConnect(BLEServer *) override { receiverConnected = true; }

  void onDisconnect(BLEServer *) override {
    receiverConnected = false;
    restartAdvertising = true;
    portENTER_CRITICAL(&challengeMux);
    challengeReady = false;
    portEXIT_CRITICAL(&challengeMux);
  }
};

void updateSensors() {
  const uint32_t now = millis();
  static bool candidateWorn = false;
  static uint32_t candidateSinceMs = 0;
  const bool raw = digitalRead(IR_DIGITAL_PIN);
  const bool detected = IR_ACTIVE_LOW ? !raw : raw;
  if (detected != candidateWorn) {
    candidateWorn = detected;
    candidateSinceMs = now;
  }
  if (now - candidateSinceMs >= IR_DEBOUNCE_MS) worn = candidateWorn;

  static uint32_t lastSampleMs = 0;
  static uint32_t sampleTotal = 0;
  static uint8_t sampleCount = 0;
  static uint32_t baselineTotal = 0;
  static uint32_t baselineCount = 0;
  static uint32_t baselineWindowStartedMs = 0;
  if (now - lastSampleMs < 8) return;
  lastSampleMs = now;
  const uint16_t sample = analogRead(MQ3_ANALOG_PIN);
  sampleTotal += sample;
  if (++sampleCount == 16) {
    latestMqRaw = sampleTotal / sampleCount;
    sampleTotal = 0;
    sampleCount = 0;
  }
  const uint32_t elapsed = now - sensorStartedMs;
  if (!baselineReady && elapsed >= MQ3_WARMUP_MS) {
    if (baselineWindowStartedMs == 0) baselineWindowStartedMs = now;
    if (now - baselineWindowStartedMs < BASELINE_SAMPLE_MS) {
      baselineTotal += sample;
      ++baselineCount;
    } else if (baselineCount != 0) {
      const uint16_t candidateBaseline = baselineTotal / baselineCount;
      if (candidateBaseline > 5 && candidateBaseline < 4090) {
        cleanAirBaseline = candidateBaseline;
        baselineReady = true;
        Serial.printf("Baseline ready: %u\n", cleanAirBaseline);
      } else {
        baselineTotal = 0;
        baselineCount = 0;
        baselineWindowStartedMs = now;
        Serial.printf("Invalid MQ-3 baseline (%u); checking sensor and retrying.\n", candidateBaseline);
      }
    }
  }
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
  BLEDevice::setMTU(ML_MTU);
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(new ServerCallbacks());

  BLEService *service = server->createService(MOTOLOCK_SERVICE_UUID);
  telemetryCharacteristic = service->createCharacteristic(
      MOTOLOCK_TELEMETRY_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  telemetryCharacteristic->addDescriptor(new BLE2902());
  BLECharacteristic *identity = service->createCharacteristic(
      MOTOLOCK_IDENTITY_UUID, BLECharacteristic::PROPERTY_READ);
  identity->setValue(helmetIdentity.c_str());
    BLECharacteristic *challenge = service->createCharacteristic(
      MOTOLOCK_CHALLENGE_UUID, BLECharacteristic::PROPERTY_WRITE);
  challenge->setCallbacks(new ChallengeCallbacks());

  BLECharacteristic *auth = service->createCharacteristic(
      MOTOLOCK_AUTH_UUID, BLECharacteristic::PROPERTY_WRITE);
  auth->setCallbacks(new AuthCallbacks());
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
  // An unplugged signal should read as not worn for either configured polarity.
  pinMode(IR_DIGITAL_PIN, IR_ACTIVE_LOW ? INPUT_PULLUP : INPUT_PULLDOWN);
  analogReadResolution(12);
  analogSetPinAttenuation(MQ3_ANALOG_PIN, ADC_11db);

  sensorStartedMs = millis();
  if (!setupIdentity()) {
    Serial.println("Helmet identity storage failed. Telemetry disabled.");
    while (true) delay(1000);
  }
  setupBle();
  Serial.println("BLE ready. MQ-3 warming up; keep sensor in clean air for 75 seconds.");
}

void loop() {
  if (restartAdvertising.exchange(false) && !receiverConnected.load()) {
    BLEDevice::startAdvertising();
  }
  updateSensors();
  static uint32_t lastSend = 0;
  if (millis() - lastSend < SEND_INTERVAL_MS) {
    delay(2);
    return;
  }
  lastSend = millis();

  const uint16_t mqRaw = latestMqRaw;
  const bool irRaw = digitalRead(IR_DIGITAL_PIN);
  const bool sensorOk = baselineReady && mqRaw > 5 && mqRaw < 4090 &&
                        cleanAirBaseline > 5 && cleanAirBaseline < 4090;
  const float alcoholPercent = sensorOk ? estimateAlcoholPercent(mqRaw) : 0.0f;
  const bool readingAlcohol = sensorOk &&
                              alcoholPercent >= ALCOHOL_LIMIT_PERCENT;

  static uint32_t lastDecisionMs = 0;
  if (millis() - lastDecisionMs >= SENSOR_DECISION_INTERVAL_MS) {
    lastDecisionMs = millis();
    if (readingAlcohol) {
      if (highReadingCount < 255) ++highReadingCount;
      recoveryCount = 0;
      if (highReadingCount >= ALCOHOL_CONFIRM_SAMPLES) alcoholLatched = true;
    } else {
      highReadingCount = 0;
    }
    if (!sensorOk || readingAlcohol) recoveryCount = 0;

    // Keep the one-second decision cadence independent of BLE notification rate.
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
  }

  const bool stabilizing = alcoholLatched && !readingAlcohol;
  const bool alcoholClear = sensorOk && !readingAlcohol && !alcoholLatched;

    if (isAppAuthorized.load()) {
    if (worn || receiverConnected.load()) {
      helmetRemovedMs = millis();
    } else if (millis() - helmetRemovedMs > 300000) {
      isAppAuthorized = false;
      Serial.println("Authorization expired (helmet off > 5 mins)");
    }
  } else {
    helmetRemovedMs = millis();
  }

  HelmetPacket packet{};
  packet.version = 2;
  packet.flags = baselineReady ? FLAG_WARMED_UP : 0;
  if (worn) packet.flags |= FLAG_WORN;
  if (alcoholClear) packet.flags |= FLAG_ALCOHOL_CLEAR;
  if (sensorOk) packet.flags |= FLAG_SENSOR_OK;
  if (stabilizing) packet.flags |= FLAG_STABILIZING;
  if (isAppAuthorized.load()) packet.flags |= FLAG_APP_AUTHORIZED;
  packet.mqRaw = mqRaw;
  packet.cleanAirBaseline = cleanAirBaseline;
  packet.sequence = static_cast<uint16_t>(sequenceNumber);

  uint8_t frame[ML_FRAME_SIZE]{};
  portENTER_CRITICAL(&challengeMux);
  const bool canSign = challengeReady && millis() - challengeReceivedMs < 6000;
  memcpy(frame + 11, challengeNonce, sizeof(challengeNonce));
  portEXIT_CRITICAL(&challengeMux);
  if (canSign && receiverConnected.load()) {
    frame[0] = 2;
    memcpy(frame + 1, helmetDeviceId, sizeof(helmetDeviceId));
    mlPut(frame + 7, helmetVisualId, 4);
    mlPut(frame + 43, ++sequenceNumber, 8);
    frame[51] = packet.flags;
    mlPut(frame + 52, mqRaw, 2);
    mlPut(frame + 54, cleanAirBaseline, 2);
    uint8_t hash[32];
    size_t signatureSize = 0;
    if (mbedtls_sha256(frame, ML_PAYLOAD_SIZE, hash, 0) == 0 &&
        mbedtls_pk_sign(&helmetSigningKey, MBEDTLS_MD_SHA256, hash, sizeof(hash),
          frame + ML_PAYLOAD_SIZE + 1, ML_SIGNATURE_MAX, &signatureSize, mlRandom, nullptr) == 0) {
      frame[ML_PAYLOAD_SIZE] = signatureSize;
      telemetryCharacteristic->setValue(frame, sizeof(frame));
      telemetryCharacteristic->notify();
    }
  }

  Serial.printf("BLE=%d IRraw=%d worn=%d clear=%d stabilizing=%d "
                "Alcohol=%.3f%% MQ=%u baseline=%u seq=%llu ID=%s\n",
                receiverConnected.load(), irRaw, worn, alcoholClear, stabilizing,
                alcoholPercent, mqRaw, cleanAirBaseline,
                static_cast<unsigned long long>(sequenceNumber), mlVisualId(helmetVisualId).c_str());
}
