# Current status: helmet interpretation failed the bare-head test

The rider confirmed that the previous camera passes occurred WITHOUT a helmet. Class-0 scores reached approximately 0.95 while class 1 stayed low. The provisional class-0=helmet assumption is not usable. This observation alone does not establish that class 1 means motorcycle helmet.

The current app therefore returns "Helmet check unavailable" after a matching face, regardless of the unvalidated helmet prediction. It must not report either a helmet pass or "Put your helmet" from these scores. Face mismatch and multiple/no-face checks remain active. This prevents the demonstrated false success; accurate helmet detection is NOT yet fixed. No layouts or registration gestures changed.

Opt-in diagnostics now include both class maxima within the head region and face comparison distance; helmet diagnostics can run even if identity fails. No images, identifiers or embeddings are logged. The next required evidence is a labeled modular-helmet test to distinguish reversed labels from an unsuitable model. Face matching also fluctuated and needs measured comparison, rather than a relaxed threshold.

Debug build and all five CameraFlowTest tests passed, including rejection of both raw positive and negative helmet predictions when the model is unvalidated. Model weights and database records are unchanged.

## Earlier implementation notes (superseded where they describe a working helmet pass)

﻿# Camera flow verification — 2026-09-23

The original layouts and blink → left → right registration sequence are retained. There is no added hold step. Dashboard and setup routing are unchanged: Unlock Motorcycle remains hidden when setup is incomplete.

## Camera-only behavior

- No detected face: ask the rider to keep their face visible.
- More than one detected face: fail the current check, regardless of helmet/identity.
- One face that does not match the signed-in account's stored profile: `Face ID not recognized`, with or without a helmet.
- Matching rider without a helmet detection on their head: `Put your helmet`.
- Matching rider with a helmet detection on their head: camera check passed. The camera keeps checking; no success is latched.
- Starting with a helmet already on uses the same face comparison. If the helmet hides the face, verification cannot pass; no previous face match is substituted.

IR and alcohol hardware are not integrated in this camera-only version. No IR reading is mocked, no alcohol stage is passed, and neither camera route sends an UNLOCK command. A camera result does not prove that the helmet has a sensor.

## Data and inference fixes

The existing MobileFaceNet asset outputs 192 values. Enrollment now saves a real normalized embedding captured when the eyes reopen after blinking, without inference slowing the blink frames or another hold/capture step. Saving reads the record back and checks that the vector matches. Recognition uses the same crop, RGB normalization and embedding normalization. Legacy JSON-string and JSON-array descriptors are supported; invalid, constant and wrong-length vectors are rejected.

Unlock loads the signed-in user's current database profile before creating the analyzer. A read-only audit found five visible records: one usable 192-value descriptor and four missing descriptors. No remote records were changed by this implementation.

Camera conversion respects YUV row/pixel strides. Helmet inference uses the asset's actual CHW input, letterboxing, competing-class scores, and a geometric check associating a predicted helmet box with the visible rider's head. Inference runs on the camera worker for unlock.

## Validation and remaining limits

The debug APK builds and CameraFlowTest passes (four tests covering identity/helmet message precedence, multiple/missing faces and loss of a previous pass, descriptor formats, and invalid-vector rejection). Existing unrelated tests that access live Supabase were not run.

Physical phone/camera accuracy has NOT been measured. The helmet asset still has two unlabeled classes; class 0 retains the original app's provisional helmet interpretation. This is not proof of helmet-vs-cap accuracy, helmet safety certification, or protection against photos/video. The face distance and helmet confidence thresholds also require measurements on real riders and helmets. No model weights were changed.

Before claiming accuracy, test on a phone: registered and different riders with/without helmets; helmet already worn; caps/headbands; held or background helmets; a second visible face entering; face leaving; helmet removal; low light and covered faces. Each failed condition must replace any previous pass. Registration should retain its original three gestures and save a nonconstant 192-value profile.

## Modular helmet follow-up

The connected phone was still running a build last updated at 20:55:30, before the preceding source fixes. The updated debug APK was installed with `adb install -r -t`, preserving app data.

Static inspection of the exact helmet asset confirmed that its final coordinate operation multiplies decoded pixel boxes by 0.0015625000232830644 (1/640). Decoding now uses normalized coordinates explicitly instead of guessing units from frame predictions. This prevents an outlier box from changing the coordinate interpretation of every detection.

Opt-in `MotoLockDetection` debug logs report only result messages, class-score maxima, geometry rejection counts, and whether a candidate matches the head region. They contain no photos or face embeddings. Logging is enabled on the connected test phone with `log.tag.MotoLockDetection=DEBUG` for the requested no-helmet/modular-helmet comparison. Model class mapping and real-world detection accuracy still require that comparison; this update does not claim those issues are resolved.
