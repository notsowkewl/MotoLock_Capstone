#include <Arduino.h>
#include <BluetoothSerial.h>
#include <Preferences.h>
#include "mbedtls/md.h"

constexpr uint8_t PAIRING_BUTTON_PIN = 0; // Standard BOOT button on ESP32

BluetoothSerial SerialBT;
Preferences preferences;

String currentNonce = "";
String deviceSecret = "";
bool isProvisioningMode = false;
unsigned long provisioningStartTime = 0;

void setup() {
  Serial.begin(115200);
  pinMode(PAIRING_BUTTON_PIN, INPUT_PULLUP);
  
  preferences.begin("motolock", false);
  
  // Factory reset check: hold button during boot for 5 seconds
  if (digitalRead(PAIRING_BUTTON_PIN) == LOW) {
    unsigned long pressTime = millis();
    while(digitalRead(PAIRING_BUTTON_PIN) == LOW) {
      if (millis() - pressTime > 5000) {
        preferences.clear();
        Serial.println("FACTORY RESET COMPLETE. NVS CLEARED.");
        delay(1000);
        break;
      }
    }
  }
  
  deviceSecret = preferences.getString("secret", "");
  
  SerialBT.begin("MotoLock_ESP32");
  Serial.println("Bluetooth Started!");
}

String generateNonce() {
  uint8_t rand_bytes[16];
  esp_fill_random(rand_bytes, 16);
  String nonce = "";
  for(int i=0; i<16; i++) {
    if(rand_bytes[i] < 16) nonce += "0";
    nonce += String(rand_bytes[i], HEX);
  }
  return nonce;
}

String computeHMAC(String payload, String secret) {
  byte hmacResult[32];
  mbedtls_md_context_t ctx;
  mbedtls_md_type_t md_type = MBEDTLS_MD_SHA256;
  
  mbedtls_md_init(&ctx);
  mbedtls_md_setup(&ctx, mbedtls_md_info_from_type(md_type), 1);
  mbedtls_md_hmac_starts(&ctx, (const unsigned char *) secret.c_str(), secret.length());
  mbedtls_md_hmac_update(&ctx, (const unsigned char *) payload.c_str(), payload.length());
  mbedtls_md_hmac_finish(&ctx, hmacResult);
  mbedtls_md_free(&ctx);
  
  String hexStr = "";
  for(int i=0; i<32; i++) {
    if(hmacResult[i] < 16) hexStr += "0";
    hexStr += String(hmacResult[i], HEX);
  }
  return hexStr;
}

bool constantTimeCompare(String a, String b) {
  if (a.length() != b.length()) return false;
  int result = 0;
  for (int i = 0; i < a.length(); i++) {
    result |= (a[i] ^ b[i]);
  }
  return result == 0;
}

void loop() {
  // Check for physical button press to enter provisioning mode (3 seconds)
  if (digitalRead(PAIRING_BUTTON_PIN) == LOW) {
    unsigned long pressTime = millis();
    bool longPress = false;
    while(digitalRead(PAIRING_BUTTON_PIN) == LOW) {
      if (millis() - pressTime > 3000) {
        longPress = true;
        break;
      }
    }
    if (longPress && deviceSecret == "") {
      isProvisioningMode = true;
      provisioningStartTime = millis();
      Serial.println("PROVISIONING MODE ACTIVE (60s)");
    }
  }

  // Timeout provisioning mode
  if (isProvisioningMode && (millis() - provisioningStartTime > 60000)) {
    isProvisioningMode = false;
    Serial.println("PROVISIONING MODE TIMEOUT");
  }

  if (SerialBT.available()) {
    String req = SerialBT.readStringUntil('\n');
    req.trim();
    
    if (req.startsWith("PROVISION:")) {
      if (deviceSecret != "" && !isProvisioningMode) {
        SerialBT.println("ERR_ALREADY_PROVISIONED");
      } else if (!isProvisioningMode) {
        SerialBT.println("ERR_PROVISIONING_NOT_ACTIVE");
      } else {
        deviceSecret = req.substring(10);
        preferences.putString("secret", deviceSecret);
        isProvisioningMode = false; // exit mode immediately
        SerialBT.println("OK_PROVISIONED");
        Serial.println("Secret provisioned successfully.");
      }
    }
    else if (req == "AUTH_REQ") {
      if (deviceSecret == "") {
         SerialBT.println("ERR_NOT_PROVISIONED");
         return;
      }
      currentNonce = generateNonce();
      SerialBT.println("NONCE:" + currentNonce);
    } 
    else if (req.startsWith("UNLOCK:")) {
      String receivedMac = req.substring(7);
      if (currentNonce == "") {
        SerialBT.println("ERR_NO_NONCE");
        return;
      }
      
      String expectedMac = computeHMAC(currentNonce, deviceSecret);
      currentNonce = ""; // Invalidate nonce immediately
      
      if (constantTimeCompare(expectedMac, receivedMac)) {
        SerialBT.println("OK_UNLOCKED");
        Serial.println("Unlock Authenticated!");
        // Motor relay trigger here
      } else {
        SerialBT.println("ERR_AUTH_FAILED");
      }
    }
  }
}
