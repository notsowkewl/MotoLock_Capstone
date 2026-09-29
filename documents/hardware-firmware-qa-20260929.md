# Firmware and hardware QA evidence — 2026-09-29

## Later source changes — not yet built or flashed

The motor sketch was subsequently updated to require a fresh paired helmet, worn status, warmed and valid alcohol sensor, and a clear alcohol reading when activating manual override. While active, the override tolerates helmet signal loss and resets only after one continuous hour without RPM pulses, or immediately on a confirmed alcohol-positive reading. This requires the new conditioned tach input on GPIO 34 and constant fused battery power to keep the controller running while the engine is off. The build/upload and serial results below predate this source update and do not verify it. No tests were run for this change.

## Environment observed

- Arduino IDE 2.3.10 is installed. The MotoLock motor sketch was opened in Arduino IDE.
- Existing IDE context from the project setup identifies **ESP32 Dev Module** and **COM3**.
- COM3 enumerates as a USB serial port with Silicon Labs CP210x USB-to-UART ID `VID_10C4&PID_EA60`.
- Arduino CLI used for command-line compilation/upload: 1.5.2-rc.1.
- ESP32 Arduino core: 3.3.0.
- Compile target: `esp32:esp32:esp32:PartitionScheme=huge_app`.
- Arduino IDE was opened with `build/firmware/MotoLock_Motor_ESP32_v2/MotoLock_Motor_ESP32_v2.ino`.

## Build results

| Sketch | Result | Flash | RAM |
| --- | --- | ---: | ---: |
| `build/firmware/MotoLock_Helmet_ESP32_NoLED/MotoLock_Helmet_ESP32_NoLED.ino` | PASS — compiled | 1,202,735 bytes (38% of 3,145,728) | 39,496 bytes (12% of 327,680) |
| `build/firmware/MotoLock_Motor_ESP32_v2/MotoLock_Motor_ESP32_v2.ino` | PASS — compiled | 1,238,287 bytes (39% of 3,145,728) | 43,576 bytes (13% of 327,680) |

## Upload result

**FAIL — motor firmware upload did not complete.** The uploader connected to COM3 but the chip did not enter download mode:

```text
Failed to connect to ESP32: Wrong boot mode detected (0x13)! The chip needs to be in download mode.
Failed uploading: uploading error: exit status 2
```

No new firmware was written. A retry requires putting the ESP32 into its bootloader/download mode with the board's BOOT/reset controls, then uploading again.

## Serial observation

Read COM3 at 115200 baud. The connected motor board booted the firmware already present on it and reported:

```text
rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)
SIM7600 disabled - running without SMS alerts.
Classic Bluetooth ready: MotoLock-Motor
```

This verifies that serial output was readable and Classic Bluetooth startup was reported. It does not verify pairing, authentication, alcohol detection, relay/lock actuation, manual override, or application/backend communication.

## Physical test status

**BLOCKED / unverified.** Since the new motor firmware could not be uploaded and physical controls/outputs require hands-on interaction, no lock/unlock, 3-click override, alcohol-positive/negative, power-cycle, pairing, or failure-handling case is marked as passed. No helmet ESP32 was identified on a separate port, so the helmet binary was compile-checked only.

To resume the physical test, place the motor ESP32 in download mode using its BOOT/reset controls and retry the upload. After upload, execute the motorcycle/lock cases and capture serial output for each case. Confirm the helmet board's port separately before uploading the helmet sketch.

## Attempt log

- The machine has Arduino IDE 2.3.10, and the IDE was launched with the motor sketch. The configured target is ESP32 Dev Module on COM3, matching the local Arduino IDE context.
- Windows identifies COM3's adapter as Silicon Labs CP210x (`VID_10C4&PID_EA60`). Arduino CLI board discovery reports a USB serial port but does not identify a board model.
- A firmware upload was attempted on COM3 and failed with boot mode `0x13`; upload was not retried because the ESP32 needed the BOOT/download-mode control to be operated during connection.
- The serial monitor at 115200 baud captured boot output and `Classic Bluetooth ready: MotoLock-Motor`. No physical button presses, sensor stimuli, lock movement, or app pairing test were performed.
