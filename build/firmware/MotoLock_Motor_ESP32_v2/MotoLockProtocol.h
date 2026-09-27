#pragma once

#include <Arduino.h>
#include <Preferences.h>
#include <esp_random.h>
#include <mbedtls/pk.h>
#include <mbedtls/md.h>
#include <mbedtls/sha256.h>

// V2 signed payload: version(1), device ID(6), visual ID(4), nonce(32),
// sequence(8), flags(1), MQ raw(2), baseline(2). Integers are big endian.
constexpr size_t ML_PAYLOAD_SIZE = 56;
constexpr size_t ML_SIGNATURE_MAX = 72;
constexpr size_t ML_FRAME_SIZE = ML_PAYLOAD_SIZE + 1 + ML_SIGNATURE_MAX;
// Fits both the signed frame and the full ASCII public-identity characteristic.
constexpr uint16_t ML_MTU = 247;
#define MOTOLOCK_CHALLENGE_UUID "7ce10003-6d79-4f8b-9a33-5f4739a90001"
#define MOTOLOCK_IDENTITY_UUID  "7ce10004-6d79-4f8b-9a33-5f4739a90001"

inline int mlRandom(void *, unsigned char *out, size_t len) {
  esp_fill_random(out, len);
  return 0;
}
inline String mlHex(const uint8_t *bytes, size_t len) {
  static const char alphabet[] = "0123456789abcdef";
  String out;
  out.reserve(len * 2);
  for (size_t i = 0; i < len; ++i) {
    out += alphabet[bytes[i] >> 4];
    out += alphabet[bytes[i] & 15];
  }
  return out;
}
inline bool mlUnhex(const String &text, uint8_t *out, size_t len) {
  if (text.length() != len * 2) return false;
  for (size_t i = 0; i < len; ++i) {
    unsigned value = 0;
    for (size_t j = 0; j < 2; ++j) {
      const char c = text[i * 2 + j];
      const int digit = c >= '0' && c <= '9' ? c - '0' :
                        c >= 'a' && c <= 'f' ? c - 'a' + 10 :
                        c >= 'A' && c <= 'F' ? c - 'A' + 10 : -1;
      if (digit < 0) return false;
      value = value * 16 + digit;
    }
    out[i] = value;
  }
  return true;
}
inline void mlPut(uint8_t *out, uint64_t value, size_t count) {
  for (size_t i = count; i > 0; --i) { out[i - 1] = value & 255; value >>= 8; }
}
inline uint64_t mlGet(const uint8_t *data, size_t count) {
  uint64_t value = 0;
  for (size_t i = 0; i < count; ++i) value = (value << 8) | data[i];
  return value;
}
inline String mlVisualId(uint32_t value) {
  char text[11];
  snprintf(text, sizeof(text), "MOTO-%05lX", static_cast<unsigned long>(value));
  return String(text);
}
inline bool mlVerify(mbedtls_pk_context *key, const uint8_t *frame) {
  const size_t signatureSize = frame[ML_PAYLOAD_SIZE];
  if (frame[0] != 2 || signatureSize < 8 || signatureSize > ML_SIGNATURE_MAX) return false;
  uint8_t hash[32];
  if (mbedtls_sha256(frame, ML_PAYLOAD_SIZE, hash, 0) != 0) return false;
  return mbedtls_pk_verify(key, MBEDTLS_MD_SHA256, hash, sizeof(hash),
                           frame + ML_PAYLOAD_SIZE + 1, signatureSize) == 0;
}
inline String mlHmac(const String &nonce, const String &secret) {
  uint8_t out[32];
  const auto *info = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
  if (!info || mbedtls_md_hmac(info,
      reinterpret_cast<const uint8_t *>(secret.c_str()), secret.length(),
      reinterpret_cast<const uint8_t *>(nonce.c_str()), nonce.length(), out) != 0) return "";
  return mlHex(out, sizeof(out));
}
inline bool mlEqual(const String &a, const String &b) {
  if (a.length() != b.length()) return false;
  uint8_t difference = 0;
  for (size_t i = 0; i < a.length(); ++i) difference |= a[i] ^ b[i];
  return difference == 0;
}
