# MotoLock Rider Android app QA — 2026-09-29

## Kotlin source update (2026-09-29, not device QA)

Per the user's direction, no phone or live backend testing was performed for this update. The latest Kotlin source compiled successfully and produced a debug APK (`MotoLock_Native/app/build/outputs/apk/debug/app-debug.apk`). The user asked that testing be left to them; no tests or device install were run in this update. The previous full local unit run had five existing `CameraFlowTest` failures in helmet telemetry and stale expectations; the focused validation and face-session tests passed before the additional Auth/PIN adjustments. The connected Infinix still reports the previously installed APK timestamp `2026-09-29 11:23:02`; the newly built APK has not been installed.

Source changes include Auth result gating, relying on the existing `auth.users` trigger for rider profile creation with the same Auth UUID, confirmation-state signup UX, sign-up inline validation, unverified login rejection, password and PIN recovery flows, profile Name save/reload, PIN operations through the existing authenticated least-privilege RPCs instead of direct PIN table access, manual-override confirmation and existing ride-history audit persistence, five face attempts, and verification reset after losing the verified face. Live Auth/email behavior, deployed PIN migration/RLS and recovery function, Google provider, firmware BLE/OLED persistence, and hardware behavior remain unverified. No SQL migration or RLS policy was changed in this Kotlin pass.

## Scope and result

This pass is limited to normal rider/account/settings flows. Face recognition, helmet and alcohol sensing, manual override, Bluetooth pairing, ESP32, locks, and motorcycle behavior are explicitly out of scope.

**Overall: BLOCKED.** On the retry, an Infinix X6528 appeared over ADB and the installed package `com.example.motolock` launched. Basic UI checks were possible. The installed APK is an older build (version 1.0 / code 1, installed 2026-09-29 11:23 local time); it could not be rebuilt from current source because Vite config startup fails with `spawn EPERM`. This means current-source coverage and backend flows remain blocked. No PASS is inferred from source code or mocked browser tests.

## Evidence collected

| Evidence | Result |
| --- | --- |
| Android SDK path | `ANDROID_HOME=E:\Android\Sdk`; `adb.exe` exists. |
| Connected device | Infinix X6528, Android 13, attached by ADB over TCP. |
| Installed app | `com.example.motolock`, version 1.0/code 1; app launched to Login. No fatal exception was found in the inspected Logcat tail. |
| Installed APK provenance | The app ran from the already-installed APK. Rebuilding current source failed with Vite `spawn EPERM`; APK installation/update was not attempted. |
| Live Supabase/Auth/Email | BLOCKED: no authenticated service access or controlled mailbox was available for this pass. |
| UI finding | Signup displays “Full Name”; this does not match the requested exact label “Name”. Failure observed in installed build. Current source has a `Name` label, but it could not be built and installed for retest. |
| Screenshot evidence | [Login error](android-rider-qa-login-error.png), [signup required-field validation](android-rider-qa-signup-empty.png), [recovery screen](android-rider-qa-recovery-screen.png). |
| In-scope current-run tests | 6 UI cases executed on device; only UI-level pass statuses count below. |

## Test case checklist

Use PASS only after observing the case on the connected Android phone. Current status for every unexecuted case is BLOCKED because there is no ADB device or installable current APK.

| Test ID | Feature/function | Steps and expected result | Status | Evidence/notes |
| --- | --- | --- | --- | --- |
| APP-01 | App startup | Launch app; Login screen loads without a crash. | PASS | Observed Login screen on Infinix X6528; package `com.example.motolock` remained resumed. |
| NAV-01 | Login/signup navigation | Open signup from Login and use back to return. | PASS | Signup and Login screens opened. Full dashboard navigation remains in NAV-02. |
| AUTH-01 | Signup required fields | Submit empty form; required fields are identified and no account is created. | PASS | Observed red validation on name, email, password, and confirm password; no signup request was submitted. Screenshot: [signup-empty](android-rider-qa-signup-empty.png). |
| AUTH-02 | Invalid email/password | Try malformed email and weak password; clear validation appears and signup is rejected. | BLOCKED | No device. |
| AUTH-03 | New email signup | Register with a controlled new email; account creation succeeds and verification message arrives. | BLOCKED | Requires phone and accessible mailbox/Auth. |
| AUTH-04 | Existing email signup | Register a used email; privacy-safe response appears and no duplicate rider profile is created. | BLOCKED | Requires a controlled live account/Auth/database. |
| AUTH-05 | Unverified login gate | Log in before verification; access to rider screens is denied and verification resend is offered. | BLOCKED | Requires live Auth/email. |
| AUTH-06 | Verified login | Verify email, log in, and confirm Dashboard opens. | BLOCKED | Requires live Auth/email and phone. |
| AUTH-07a | Login error handling: nonexistent user | Try a nonexistent account; error is clear and does not disclose account details. | PASS | Tried `qa.nonexistent.20260929@example.invalid` with a dummy password; app showed generic “Invalid email or password.” Screenshot: [login error](android-rider-qa-login-error.png). |
| AUTH-07b | Login error handling: wrong password | Try a wrong password for a controlled existing account; error remains generic. | BLOCKED | No controlled test account credentials were available. |
| AUTH-08 | Logout and login again | Log out, confirm protected screens are inaccessible, then sign in again successfully. | BLOCKED | Requires phone and live Auth. |
| AUTH-09 | Restart/session | Force-close and relaunch while signed in; verify intended session restore. Check expiry/revocation behavior. | BLOCKED | Requires device and configured Auth sessions. |
| REC-00 | Password recovery screen | Open recovery from Login; recovery request screen is reachable. | PASS | Reset Password screen and Send Reset Link action appeared. Screenshot: [recovery screen](android-rider-qa-recovery-screen.png). This is UI-only. |
| REC-01 | Password recovery request | Request recovery; receive actual email/code and open link/code in app. | BLOCKED | No request sent because no controlled mailbox/live Auth access was available. |
| REC-02 | Password recovery completion | Set new password; new password works and old password fails. | BLOCKED | Requires live Auth/email. |
| REC-03 | Invalid/expired/reused recovery | Try invalid, expired, and reused code/link; each is rejected without changing credentials. | BLOCKED | Requires controlled live recovery messages. |
| REC-04 | Recovery throttling | Repeat requests/completions; server rate limiting is enforced and response is safe. | BLOCKED | Requires live Edge Function/Auth. |
| PIN-01 | PIN create/validate | Create PIN; reject invalid PIN and accept correct PIN. | BLOCKED | Requires phone and live backend. |
| PIN-02 | PIN change | Change with correct existing PIN; reject wrong old PIN and mismatched confirmation. | BLOCKED | Requires phone and live backend. |
| PIN-03 | PIN persistence/RLS | Re-login and verify PIN; confirm create/change succeeds without RLS error and unauthorized writes fail. | BLOCKED | Requires live database/RLS. |
| PROF-01 | Name display/edit | Verify label is “Name”, edit and save; success appears only after database confirmation. | FAIL (label) / BLOCKED (save) | Installed app’s signup field says “Full Name”, not “Name”. Profile edit/save was not reached because login was unavailable. Source fix is not in this installed APK and build retry is blocked. |
| PROF-02 | Name persistence | Reopen screen, log out/in, confirm edited Name remains. | BLOCKED | Requires phone and live database. |
| PROF-03 | Invalid/cancel/failure | Try empty/invalid values, cancel, induce backend/network failure; no false success is shown. | BLOCKED | Requires phone and controllable backend/network. |
| PROF-04 | Email identity ownership | Update email through verified Auth flow; reload profile and verify same Auth UUID. Profile email edits must not claim another identity. | BLOCKED | Requires live Auth/database and phone. |
| GOOGLE-01 | Google sign-in | Sign in, log out, sign in again; verify correct rider identity/profile. | BLOCKED | Requires Android OAuth redirect configuration and Google account. |
| GOOGLE-02 | Google email change ownership | Sign in as sample1, change verified Auth email to sample2, then sign in as sample1; confirm ownership is not transferred or duplicated. | BLOCKED | Requires controlled accounts and deployed Auth config. |
| NAV-01 | Dashboard/navigation | Check Dashboard to Settings, Profile, Ride History; back navigation and logout return work without dead routes/crashes. | BLOCKED | Requires phone. |
| NAV-02 | Loading/empty/error states | Observe loading, empty data, backend error and recovery states. | BLOCKED | Requires phone and service test conditions. |
| HIST-01 | Ride History display | Open screen; verify available fixture rows, formatting, timestamps/statuses, or empty state. | BLOCKED | Requires phone and database/known test data. |
| HIST-02 | Ride History service errors | Deny network/fail query; show recoverable error and no fabricated records. | BLOCKED | Requires phone and controllable backend. |
| SEC-01 | Client secrets | Inspect installed package/config and Logcat for service-role keys or sensitive credentials. | BLOCKED | No APK/device. |
| SEC-02 | Rider isolation | As rider A, try normal UI routes/data access to rider B profile; access is denied. | BLOCKED | Requires two live accounts and deployed RLS. |
| SEC-03 | Profile/PIN authorization | Confirm profile writes target own Auth UUID and PIN operations use protected backend/RLS. | BLOCKED | Requires live database and phone. |
| SEC-04 | Logout clearing | Log out and inspect app navigation/session; protected user data cannot be reopened as prior rider. | BLOCKED | Requires phone and live Auth. |

## Counts

- Total documented cases: 33
- Executed on physical phone: 6
- PASS: 5 (app launch, Login/signup navigation, required-field feedback, generic nonexistent-user error, recovery screen access)
- FAIL: 1 (installed build field label is “Full Name”, not “Name”)
- BLOCKED: 27 (includes backend, email, authenticated account, and unvisited screen cases)

## Bugs and retest

- Bug discovered: installed APK shows “Full Name” where the checklist requires “Name”. Current source appears to use the desired label, but rebuild failed with Vite `spawn EPERM`; it was not installed and the fix was not retested.
- Bugs fixed during this pass: none.
- Tests rerun after fixes: none.
- Prior mocked/browser/build evidence remains in [qa-status-20260929.md](qa-status-20260929.md) and does not count as evidence for current-source phone behavior.

## Excluded per request

Face recognition, helmet detection, alcohol detection, manual override, Bluetooth hardware pairing, ESP32, physical lock, and motorcycle behavior were not tested or changed in this pass.
