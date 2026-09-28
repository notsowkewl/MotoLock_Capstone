# Device-specific helmet stickers

Admin → MotoLock Devices → Generate sticker opens a preview for the selected device's `helmet_visual_id`. Downloads are self-contained SVG (56 × 66 mm) or PNG (1120 × 1320 pixels). Transparent is the default; green is optional. Print PNGs at 56 × 66 mm and preserve the white data marks, including white ink on clear material.

## Identity flow

1. The helmet firmware supplies its actual hardware ID and visual ID during pairing. The visual ID is not the database device UUID or the motor Bluetooth address.
2. The updated Android pairing screen inserts or updates `devices.helmet_device_id` and `devices.helmet_visual_id` for the signed-in user's motor address, then reads the values back before marking sync complete. Existing installations sync when Hardware Setup reconnects; failed writes can be retried.
3. Admin reads these fields with the device record and encodes that exact visual ID. Missing/invalid IDs cannot be exported; reconnect the helmet in the updated mobile app to sync it.
4. Android decodes any valid 18-bit visual ID using the same shield layout. CameraDecision still requires the decoded ID to match the paired helmet and its signed telemetry. A sticker from a different helmet does not authorize an unlock.

The supported range is MOTO-00000 through MOTO-3FFFF. These are visual labels, not unique cryptographic credentials; the firmware derives the value from 18 hardware-address bits, so collisions are possible. Signed device identity remains required.

## Rollout

Apply `supabase/migrations/20260928000000_device_helmet_identity.sql` to the project's database before deploying the updated mobile app. It adds nullable identity columns and format constraints, leaving older device records unset. Existing device ownership/RLS policies are unchanged and must permit the paired user to select/insert/update their own device. This migration has not been applied to the live database by this code change.

Build/deploy the admin and Android apps, then reconnect each device through Hardware Setup to populate older records. No ID is fabricated for legacy devices.

## Validation

- `npx vitest run src/shared/helmet-marker.test.ts src/admin/DevicesPage.test.tsx`
- `npm run build`
- `bash gradlew --offline :app:compileDebugKotlin` from MotoLock_Native
- `python3 tools/helmet-detector-test/run.py --image <sticker.png> --output <results-dir> --fixture-only --expected MOTO-xxxxx`

The web encoder test covers all 262,144 payloads and checks its geometry against the Kotlin detector. Generated SVGs can be rasterized and passed to the production detector via the desktop harness. Synthetic tests do not establish actual printed-camera performance: glare, tiny image size, occlusion and strong helmet curvature still require phone testing. Keep the same red lock/M and encoded shield geometry; unrelated logo artwork is not supported.
