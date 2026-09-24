# Native rider verification — status and commissioning

## What was repaired

- `helmet.tflite` really takes float32 `[1,3,640,640]`. The old code sent interleaved HWC pixels; the replacement sends separate RGB planes and uses aspect-preserving letterboxing.
- `mobilefacenet.tflite` produces `[1,192]`, not 128. Enrollment now captures eight real, normalized embeddings after a blink and a randomized head turn. The old constant `FloatArray(128) { 0.1f }` enrollment is rejected.
- Camera conversion respects YUV plane row/pixel strides. Detection and embeddings use the same upright image.
- Verification starts only after models and the saved profile are ready. Model failures and missing data block authorization.
- A visible helmet must overlap the current rider's head. Several successful samples are required.
- No-helmet face verification continues into the helmet-wearing transition, alcohol test, and pre-start authorization. Identity changes, multiple/missing faces, stale camera/sensor data, or pausing the app reset verification.
- The app no longer fabricates a positive IR reading or exposes the old direct camera-to-UNLOCK path.
- Receiver protocol 2 uses a session identifier and a 2.5-second camera permission lease. The receiver must also have a fresh IR reading and a completed passing alcohol test. An expired/disconnected camera cannot grant normal start permission. This does not turn off an already running motorcycle.

## Required before unlocking can work

1. Obtain the class map and export details for the **actual checkpoint** used to produce `helmet.tflite` (the existing export scripts refer to `AdvHelmet.pt`). The file has two output classes and no embedded class labels. Do not infer labels from its filename. Verify whether boxes are in input pixels or normalized coordinates, and whether the classes mean motorcycle helmets, hard hats, or something else.
2. Record the verified class mapping and coordinate units in `app/src/main/assets/helmet-model.json`. `labelsVerified` deliberately remains false until that evidence exists; unlocking is blocked with a clear error. No original model weights were changed.
3. Compile and bench-test the updated `MotoLock_Capstone/motolock-backend/esp32_oled.txt` as the receiver sketch, then flash it to the receiver. The Android app requires protocol 2; older firmware is rejected. Firmware has not been compiled/flashed or tested on hardware in this session.
4. Re-register the rider's face. Existing dummy 128-value profiles cannot be repaired into real biometric data. Registration updates the current authenticated user's `users.face_descriptor` only when the user completes enrollment. That shared field now contains 192 MobileFaceNet values; do not use it as a face-api.js 128-value profile. No database records were changed during development.
5. Validate with your actual phone, rider, helmet and IR placement on a stationary bench before enabling a motorcycle starter. Record false accepts and false rejects, including other riders, hats, headbands, a helmet held beside the head, another person's helmet, and different light/visor conditions. The 0.60 helmet score, 0.15 class margin, 0.85 face distance, and spatial/timing limits are initial engineering values, **not measured accuracy guarantees**.

## Limits of the current hardware and models

The IR sensor reports a binary triggered/not-triggered state. Neither that reading nor the phone camera provides an IR detection range or proves the detected helmet houses that sensor. Requiring an observed off-to-on sensor transition close to the visual wearing transition reduces simple bypasses but cannot prove physical identity. A visible marker permanently attached to the sensor helmet, tamper-resistant sensor mounting, and authenticated paired telemetry are needed for stronger binding.

The existing ESP-NOW transmitter is unencrypted and the receiver does not authenticate a helmet identity. Session IDs in protocol 2 isolate app attempts; they are not cryptographic authentication. A coordinated second helmet/sensor or forged telemetry remains outside the guarantee of this fix. The existing physical emergency manual override remains in the firmware and bypasses the normal verification path.

Blink/head-turn challenges discourage a static photo; they are not a certified photo/video/mask presentation-attack detector. Training/evaluation data is needed to establish helmet-vs-cap accuracy. The supplied model cannot be assumed to recognize every helmet type or distinguish a certified helmet from a visually similar prop.

Continuous camera checking here covers **pre-start**, including the alcohol test and waiting for the start button. It does not require a rider to look at a phone during riding, and camera failure does not shut down a running engine.

## Model identity and verification

- Helmet SHA-256: `BF98D99578825D61C00039966E82E7392D131D742C1C1A9D2EC101DDE2481ECA`
- Face SHA-256: `BE4BC7CFC53F7BC336D0F28B1AB92535F618C913A422B683210750F6B5354854`
- Android debug assembly and `VerificationPolicyTest` pass (12 tests). These include the actual RGB packing used for inference, invalid profile rejection, stale/replayed test rejection, wearing transition timing, camera/sensor expiry, and protecting an already running engine from camera reset commands.
- Existing unrelated unit tests that sign in to the live database were not run.
- Camera/model inference on a phone and helmet hardware behavior have not been tested. No accuracy percentage is claimed.

Technical references: [LiteRT Interpreter](https://developers.google.com/edge/api/tflite/java/org/tensorflow/lite/Interpreter), [ML Kit face detection](https://developers.google.com/ml-kit/vision/face-detection/android), [Ultralytics raw detection outputs](https://docs.ultralytics.com/guides/end2end-detection).
