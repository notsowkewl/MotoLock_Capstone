# Bluetooth and signed helmet verification

Use the two **root** sketches, `MotoLock_Helmet_ESP32_NoLED.ino` and
`MotoLock_Motor_ESP32_v2.ino`, plus `MotoLockProtocol.h`. The sketches under
`motolock-backend/` are older, different firmware and do not implement this flow.

## Build and upload

Verified build target: Arduino ESP32 **3.3.0**, **ESP32 Dev Module** (ESP32-WROOM),
**Huge APP (3MB No OTA/1MB SPIFFS)** partition. Libraries: Adafruit SSD1306 2.5.17,
Adafruit GFX 1.12.6, Adafruit BusIO 1.17.4, TinyGPSPlus 1.0.3.

Put each `.ino` in its own same-named Arduino sketch folder and copy
`MotoLockProtocol.h` into **both** folders. Do not compile both `.ino` files in
one folder. Upload the helmet sketch to the helmet and the motor sketch to the
motor. Both firmwares and the updated Android app must be used together; V1
unsigned helmet packets are rejected.

To stage both folders and compile with an installed Arduino CLI/toolchain:

```powershell
.\tools\build-firmware.ps1
```

The prepared sketch folders and binaries are written under `build/firmware/`.

The motor uses Classic Bluetooth SPP for the Android phone; the helmet uses
BLE for the motor. Select **MotoLock-Motor** in the app. The helmet is not a
Classic Bluetooth device and is not paired directly through this screen.

## First pairing

1. Power up your helmet and motor with only your own helmet nearby. The helmet
   starts BLE immediately; MQ-3 warm-up and baseline collection still take
   approximately 75 seconds in clean air. Warm-up telemetry cannot unlock.
2. After the motor boots, hold its onboard **BOOT / GPIO 0** button for three
   seconds, then release. The OLED shows `PAIRING ACTIVE` for 60 seconds.
   This is separate from the existing GPIO 32 manual override button.
3. Open **Pair MotoLock Hardware** in the updated app and select **MotoLock-Motor**.
   The app provisions a random phone secret. The motor stores the selected
   helmet's address, device ID, visual ID, and public key in one NVS record.
   The app saves the secret using its existing Android Keystore encryption and
   saves the same helmet identity. Initial enrollment trusts the helmet selected
   during this physical pairing window; it is not a manufacturer attestation.
4. Check the `MOTO-xxxxx` ID against the helmet's Serial Monitor `HELMET_ID:` line
   at 115200 baud. That line contains public information, not its private key.
   Keep the helmet's NVS across firmware uploads so its signing identity persists.
5. The camera requires the matching encoded visual marker, not an ordinary logo.
   Generate a marker using the **actual** paired ID:

   ```powershell
   node tools/helmet-marker.cjs MOTO-0007B helmet-marker.svg
   ```

   Replace the example ID. Print at 100% scale (outer ring diameter 50 mm), and
   place it on the helmet forehead area. Detection depends on lighting, distance,
   orientation, and the existing camera detector; verify it on the actual helmet.

Saved phone credentials are reused on reconnect. A different helmet key is
rejected. Changing ownership or replacing a helmet requires deliberate clearing
of the motor's pairing NVS and the app's corresponding pairing data; rebooting
alone does not erase credentials. No automatic factory reset is added.

## Runtime behavior

The helmet persists a P-256 key and signs SHA-256/ECDSA telemetry. The motor
verifies signatures, pinned identity, sensor ranges, the current 32-byte nonce,
and increasing 64-bit sequence numbers. BLE MTU is negotiated to 247 for the
129-byte signed frame and public-identity characteristic. A two-second telemetry timeout locks the normal relay
path and triggers reconnection. Scanning and connection work run in a separate
FreeRTOS task, so the main relay/app loop keeps running.

Android uses one socket reader for telemetry and command replies. It validates
the same signature and nonce, matches the paired visual ID, and runs the existing
face/helmet checks. Only a successful camera verification sends an HMAC-authorized
unlock request. The motor also requires current worn/warmed/sensor-OK/alcohol-clear
flags. A reconnect or failed sensor condition revokes the previous normal unlock.
The existing physical override remains a separate, explicit bypass.

The app sends a numbered `PING:<token>` every second; the motor replies with
`PONG:<token>`. Both ends expire the connection indication after 3.5 seconds
without a valid heartbeat (the OLED refresh adds up to 0.5 seconds). Android also
listens for Bluetooth-off and device-disconnected broadcasts. The dashboard's
Connected label observes the live service, not the saved database enrollment.
Lost liveness revokes normal motor authorization and clears the app's unlocked
state. Reconnect and authenticate again to unlock. Install the updated app and
motor firmware together for heartbeat support; the helmet firmware is unchanged
by this disconnect fix.

The MQ-3 percentage is still a prototype estimate; the Bluetooth changes do not
calibrate it. IR polarity remains `IR_ACTIVE_LOW = false`; confirm raw HIGH/LOW
on the actual module. GPIO 3 is also UART RX, as noted in the helmet sketch.
SMS remains disabled. Enabling its existing blocking modem code needs a separate
review of timing before relying on the relay timeout.

## Wire protocol

All phone commands are newline-terminated, at most 256 characters. CRLF is
accepted. Overlong/invalid frames and partial frames older than one second are
discarded until the next newline. Commands:

| Command | Result |
|---|---|
| `PING`, `HELLO`, `STATUS` | `PONG`, connection information, or `STATUS:{...}` |
| `PING:<numeric token>` | `PONG:<same token>`; periodic app liveness check |
| `PROVISION:<64 hex characters>` | `OK_PROVISIONED` only during first physical enrollment |
| `SESSION_REQ` then `AUTH:<HMAC>` | Authenticate a reconnect; `OK_AUTHENTICATED` |
| `GET_HELMET_ID` | `HELMET_ID:<12 hex device ID>,MOTO-xxxxx,<SPKI public key hex>` |
| `CHALLENGE:<64 hex characters>` | Relay the authenticated phone's nonce to the helmet |
| `AUTH_REQ` then `UNLOCK:<HMAC>` | Single-use nonce authorization; `OK_UNLOCKED` only if helmet conditions pass |
| `LOCK` | Revoke normal app authorization; does not cancel physical override |

HMAC-SHA256 uses the ASCII provisioned secret as its key and the ASCII returned
`NONCE:` value as its message. Nonces expire after five seconds and are consumed
even on invalid replies. Session authentication and unlock nonces have separate
purposes. Unknown commands return `ERR_UNSUPPORTED_COMMAND`.

Signed telemetry is `TELEMETRY:<56-byte payload hex>,<DER ECDSA signature hex>`.
The BLE frame is payload + one signature-length byte + a 72-byte signature area
(zero-padded). Payload offsets, all integers big-endian:

| Offset | Size | Field |
|---|---|---|
| 0 | 1 | Protocol version 2 |
| 1 | 6 | Device ID |
| 7 | 4 | 18-bit visual ID |
| 11 | 32 | Challenge nonce |
| 43 | 8 | Increasing sequence |
| 51 | 1 | Worn, warmed-up, alcohol-clear, sensor-OK, stabilizing flags |
| 52 | 2 | MQ-3 raw value |
| 54 | 2 | Clean-air baseline |

## Bench checks still required

- Connect the phone while the helmet is off; `PING`/status should remain responsive.
- Power on the helmet: it should connect during warm-up but remain locked.
- Wear/remove the helmet and verify `IRraw`, debounced `worn`, and app status.
- Provision once, reboot both ESP32s and reopen the app; credentials should persist.
- Complete face, marker, and sensor verification; require `OK_UNLOCKED` before
  showing success. There is no simulated pass button.
- Power off the helmet or interrupt telemetry: normal authorization must clear
  within the two-second timeout; reconnect must require fresh verification.
- Disconnect/reconnect the phone, send split and multiple newline commands,
  and verify no stale reply is mistaken for a new result.
- Try the wrong marker/helmet, an altered signature, repeated sequence, and an
  old nonce; none should authorize a normal unlock.

Compiled sketches and JVM tests do not replace these radio/sensor/relay checks.

API references: [Espressif BluetoothSerial documentation](https://docs.espressif.com/projects/arduino-esp32/en/latest/api/bluetooth.html)
and [ESP32 3.3.0 BLE client implementation](https://github.com/espressif/arduino-esp32/blob/3.3.0/libraries/BLE/src/BLEClient.cpp).
