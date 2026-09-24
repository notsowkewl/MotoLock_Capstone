# Camera-only face and helmet testing

Hardware integration is deferred. The camera test does not connect to Bluetooth, check IR, run an alcohol test, unlock a motorcycle, or send start commands. The firmware changes from the earlier iteration were undone. The original optional device-pairing code remains separate.

## Current flow

1. Open the original **Unlock Motorcycle** button from the dashboard. During camera-only development it opens the face/helmet check; hardware pairing is not required and no unlock command is sent.
2. Read the signed-in rider's saved `users.face_descriptor` from Supabase. Check again on resume and every five seconds. An unavailable, stale, missing, malformed, or placeholder profile cannot produce a match.
3. Exactly one visible face is required. An unrecognized rider receives **Face ID not recognized**. Multiple faces clear the result immediately.
4. A recognized rider without a helmet is prompted **Face recognized. Put your helmet on.** The same camera continues running.
5. If the rider already has a helmet on when the camera opens, compare their face directly against the saved profile and check the helmet; there is no mandatory removal/IR step.
6. Several consecutive face-and-helmet matches display a camera test result. Continue checking; removing the helmet, changing riders, adding another face, pausing the camera, or losing the database profile clears success.

## Face registration and actual database state

The read-only database check on 2026-09-23 found five visible user profiles: four without a descriptor and one with a constant placeholder. No usable 192-value profile was visible. No user identities or biometric vectors were logged, and no records were changed by the audit.

The old app saved `FloatArray(128) { 0.1f }` instead of measuring the face. That can make a registration screen say “registered” without saving a recognizable face. The supplied MobileFaceNet actually outputs **192** values. A placeholder must be replaced once by a real camera enrollment; a valid saved profile is reused and is not automatically replaced.

Enrollment uses the original fast open/closed/open blink, left turn, then right turn sequence. It processes camera frames without the verification flow's 200ms throttle and postpones bitmap conversion/TFLite inference until the rider faces forward after the challenge. Tracker-ID churn and a 15-second timer no longer discard a blink. Missing eye probabilities retain the current blink phase; missing or multiple faces reset it. Eight consistent real `.tflite` face samples are then normalized and saved. It updates only the signed-in rider's profile, reads the database back, and verifies the saved embedding before reporting success. If an existing public profile uses a different ID, the signed-in account's email is used to resolve it uniquely. Other accounts are not compared or enrolled.

The shared `face_descriptor` field is a 192-value native MobileFaceNet profile. It must not be interpreted as a face-api.js 128-value embedding.

## What “unlabeled classes” means

The actual `helmet.tflite` input is float32 `[1,3,640,640]`; output is `[1,6,8400]`: four box coordinates and **two** class scores. The exported file contains no label names. A class score is not enough to tell whether its index means helmet, no helmet, or another training category.

The existing export scripts refer to `Helmet-Detection-using-YOLO-v8/AdvHelmet.pt`. The [matching public repository](https://github.com/1amsahil/Helmet-Detection-using-YOLO-v8) has an `AdvHelmet.pt` checkpoint with **three** labels: `0 Helmet`, `1 No Helmet`, `2 Only Helmet`. Its pickle metadata was inspected as bytes, not executed. Because its class count differs, it does **not** establish the mapping of the local two-class model.

For camera-only evaluation, `helmet-model.json` retains the original app's class-0-as-helmet assumption with `labelsVerified: false`. This no longer blocks the camera. Combined success is labeled **test result**. The provisional class mapping and pixel coordinate assumption still need the actual export metadata or comparison against labeled real camera samples. Do not claim measured accuracy from these test results or connect them to ignition authorization.

## Detection fixes retained

The original layouts, typography, colors, button labels, circular face-registration preview, progress ring/dots, verification preview, step indicators, and status card have been restored. Detection instructions use the existing status text. No new registration, retry, or finish buttons are added. Invalid/missing face profiles use the existing registration screen automatically; valid saved profiles are reused.

- The helmet model now receives separate RGB channel planes instead of the incorrect interleaved RGB input.
- Face inference uses the actual 192-value output and the same normalized preprocessing in registration and verification.
- Camera YUV conversion respects plane strides and rotation.
- Helmet inference uses aspect-preserving letterboxing and rejects helmet boxes away from the recognized rider's head.
- Models and the saved database profile are loaded before processing. Errors are displayed rather than silently treated as “no helmet”.

## Validation and remaining work

Android debug build and 18 targeted unit tests pass. They cover the original blink/turn sequence, missing eye-score samples, rejecting closed eyes without a full blink, challenge resets, real tensor packing, database descriptor decoding/placeholder rejection, already-worn helmets, wrong/multiple faces, helmet removal, camera expiry, and database-profile changes. Live database-mutating tests were not run. Blink responsiveness still needs confirmation on the actual phone.

Physical camera accuracy has not yet been measured. Test the actual rider, other people, real motorcycle helmets, caps/headbands, a helmet held beside the face, different lighting, and visor positions. The helmet score (0.60), class margin (0.15), face-distance threshold (0.85), and head-box geometry are initial settings that require this validation. Keep the face and whole helmet visible.

A visible helmet cannot prove an IR sensor is installed inside it. That binding, hardware pairing, and sensor checks are future work. Runtime camera testing performs continuous face matching; it is not a certified replay/mask anti-spoofing system.

Model hashes (unchanged):

- Helmet SHA-256: `BF98D99578825D61C00039966E82E7392D131D742C1C1A9D2EC101DDE2481ECA`
- Face SHA-256: `BE4BC7CFC53F7BC336D0F28B1AB92535F618C913A422B683210750F6B5354854`
