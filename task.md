# MotoLock System — Specific Task List

---

## 🛒 HARDWARE — Still Needs to be Purchased
- [ ] Buy SIM7600G-H 4G LTE Module (with LTE antenna)
- [ ] Buy Active SIM Card with SMS/Data load
- [ ] Buy NEO-M8N GPS Module (with ceramic antenna)
- [ ] Buy LM2596 DC-DC Buck Converter
- [ ] Buy 4-Channel Logic Level Converter (3.3V ↔ 5V)
- [ ] Buy Inline Blade Fuse Holder + 3A Blade Fuse
- [ ] Buy Large IP67 Waterproof ABS Project Box (Receiver)
- [ ] Buy Small Waterproof Project Box (Helmet Transmitter)
- [ ] Buy TP4056 LiPo Charging Module (for helmet battery)
- [ ] Buy 2x Electrolytic Capacitors (1000µF, 25V)
- [ ] Buy 2x Perfboards (Dot Matrix Boards)
- [ ] Buy Roll of 22 AWG Stranded Wire
- [ ] Buy Pack of T-Tap Wire Connectors

---

## ⚙️ HARDWARE CODE — ESP32 Receiver (`esp32_oled.txt`)
- [ ] Wire NEO-M8N GPS to ESP32 Dev Module (assign RX/TX pins after hardware arrives)
- [ ] Wire SIM7600G-H to ESP32 Dev Module (assign RX/TX pins after hardware arrives)
- [ ] Wire LM2596 Buck Converter between motorcycle ACC wire and ESP32 power
- [ ] Add `TinyGPS++` library to parse NEO-M8N GPS coordinates (Latitude, Longitude)
- [ ] Add SIM7600G-H AT command sequence to `esp32_oled.txt`:
  - [ ] `AT` → Initialize the module
  - [ ] `AT+CMGF=1` → Set SMS to text mode
  - [ ] `AT+CMGS` → Send SMS to all emergency contact numbers
- [ ] Trigger GPS read + SMS send when `RESULT_FAIL` event fires on the receiver
- [ ] Format SMS: *"ALERT: [Rider Name] failed the alcohol test. BrAC: [X]%. Location: https://maps.google.com/?q=[LAT],[LNG]"*
- [ ] Implement SMS retry queue — if no signal, retry every 30 seconds until SMS is delivered
- [ ] Log Manual Override event via Bluetooth to mobile app when activated
- [ ] Test ESP-NOW range and stability between Helmet TX and Motorcycle RX

---

## ⚙️ HARDWARE CODE — ESP32 Transmitter (`esp32_sensor.txt`)
- [ ] Solder ESP32-C3 + MQ-3 + IR Sensor onto a perfboard
- [ ] Add TP4056 charging module into the transmitter circuit for battery management
- [ ] Verify IR sensor correctly detects "helmet worn" (LOW signal) vs. "not worn" (HIGH signal)
- [ ] Verify MQ-3 reads 0 when helmet is not worn (IR not triggered)

---

## 🖥️ BACKEND — Node.js / Express (`server.js`)
- [x] `/api/admin/dashboard` — Stats (total users, total rides, failed tests, trends)
- [x] `/api/admin/reports/pdf` — Generate PDF compliance report
- [x] `/api/admin/reports/excel` — Generate Excel compliance report
- [x] Admin middleware (blocks non-admin roles from admin routes)
- [x] `/api/admin/users` GET — List all rider accounts (name, email, status, face enrolled)
- [x] `/api/admin/users/:id` DELETE — Admin deletes a rider account
- [ ] `/api/admin/users/:id/suspend` PUT — Admin suspends/unsuspends a rider
- [x] `/api/admin/analytics/peak-hours` GET — Bar chart data of failed tests by hour of day
- [x] `/api/admin/analytics/peak-days` GET — Bar chart data of failed tests by day of week
- [x] `/api/admin/analytics/monthly-trend` GET — Line chart data of ride failures per month
- [x] `/api/admin/override-logs` GET — List all manual override events with timestamp
- [ ] `/api/alerts` POST — Endpoint called by ESP32 (via SIM7600 HTTP) to log GPS + BrAC on fail
- [x] Database backup script — MySQL dump to `.sql` file downloadable by admin
- [x] `/api/admin/backup` GET — Trigger database backup and return download link
- [x] Database Cascade Deletion Pipeline — Cascades deletes to linked devices/rides tables to avoid FK issues
- [x] Phone number masking utility in PDF/Excel backend exports
- [x] `/api/admin/audit-logs` GET & POST — Read/write administrative logs

---

## 📱 FRONTEND — Identity Verification (Face Recognition in `index.html`)
*Code review findings: currently uses `tinyFaceDetector`, has NO liveness detection, camera stops between steps (bypass loophole exists), no multi-face check.*

### A. Upgrade Detection Model
- [ ] Replace `faceapi.nets.tinyFaceDetector` with `faceapi.nets.ssdMobilenetv1` in `loadFaceModels()` — tiny model misses helmeted faces too often
- [ ] Update `readFaceDescriptor()` to use `new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5 })` instead of `TinyFaceDetectorOptions`
- [ ] Update `FACE_DETECTOR_SCORE_THRESHOLD` and `FACE_DETECTOR_INPUT_SIZE` constants accordingly

### B. Liveness Detection — Build `runLivenessChallenge()` (MISSING — Must Build)
*Currently: zero liveness check. A printed photo passes verification.*
- [ ] Build `runLivenessChallenge(videoId)` function using `faceLandmark68Net` landmarks
- [ ] Challenge 1 — **Blink detection:** Compute Eye Aspect Ratio (EAR) on landmark points 36–41 (left eye) and 42–47 (right eye). EAR below 0.25 = blink confirmed
- [ ] Challenge 2 — **Head turn left:** Check if nose tip (landmark 30) X-position shifts left relative to face center
- [ ] Challenge 3 — **Head turn right:** Check if nose tip (landmark 30) X-position shifts right relative to face center
- [ ] Show animated instruction UI for each challenge: *"Blink now → Turn left → Turn right"*
- [ ] Add 10-second countdown timer per challenge — if not completed → fail liveness → full reset
- [ ] Call `runLivenessChallenge()` at the START of both no-helmet AND with-helmet steps

### C. Continuous Face Tracking During Helmet Transition — Build `watchFaceDuringTransition()` (MISSING — Must Build)
*Currently: `stopFaceCamera()` is called after no-helmet pass. Camera closes. Bypass is possible by switching persons.*
- [ ] After no-helmet verification passes, do NOT call `stopFaceCamera()` — keep `faceCameraStream` alive
- [ ] Build `watchFaceDuringTransition(video)` that polls `readFaceDescriptor(video)` every 500ms
- [ ] If `descriptor === null` for more than 1500ms → face left frame → call `resetFullVerification()` → show *"Face left the frame. Start over."*
- [ ] If `faceapi.detectAllFaces()` returns 2+ detections → immediately call `resetFullVerification()` → show *"Multiple faces detected. Verification reset."*
- [ ] Only stop `watchFaceDuringTransition()` once the with-helmet face step begins and IR sensor is confirmed

### D. Multiple Face Detection Check — Build `checkForMultipleFaces(video)` (MISSING — Must Build)
- [ ] Build `checkForMultipleFaces(video)` using `faceapi.detectAllFaces()` (not `detectSingleFace`)
- [ ] Call at the START of both no-helmet and with-helmet verification steps
- [ ] If count > 1 → block verification, show *"Only the registered rider should be in front of the camera"*

### E. Helmet-Wearing Confirmation on Camera (Needs Improvement)
*Currently: with-helmet step only checks IR sensor. Does not verify the on-camera person IS the one wearing the helmet.*
- [ ] During with-helmet step, after IR sensor confirms worn, add bounding box height check:
  - If face bounding box `top Y` is close to 0 (helmet cutting top of frame) → likely helmeted ✅
  - If full forehead is visible → show *"Make sure your helmet is properly on and visible to camera"*
- [ ] Compare current frame descriptor to `enrolledFaceDescriptor` (no-helmet): if distance is < 0.15 (looks too similar to no-helmet profile) → warn *"Helmet not detected on your face. Please put it on."*

### F. UI Polish
- [ ] Add step progress indicator at top: **Step 1 of 3 → Step 2 of 3 → Step 3 of 3**
- [ ] Add animated face outline overlay on video that turns green when face is detected, red when not
- [ ] Add countdown timer bar during each liveness challenge showing seconds remaining
- [ ] Replace plain status text (e.g. *"Confirming 2/5..."*) with animated progress bar
- [ ] Show explicit instruction card before camera opens for each step
- [ ] After no-helmet pass: show animated overlay *"Keep face on camera. Put helmet on now."*
- [ ] Add retry button that calls `resetFullVerification()` from Step 1

### G. Enrollment Polish (Face ID Setup)
- [ ] Run liveness challenge during enrollment before accepting any face samples
- [ ] Increase enrollment sample count to 8 (currently lower) for better averaged descriptor
- [ ] Add explicit helmet enrollment step during setup (currently helmet descriptor is learned lazily on first ride)
- [ ] Show enrollment progress: *"Capture 3 of 8 — Hold still..."*
- [ ] After enrollment: show summary *"Face ID Registered — Without Helmet ✅ With Helmet ✅"*

---

## 📱 FRONTEND — Other Mobile App Improvements

### Sobriety Test Result Screen
- [ ] When `RESULT_FAIL` received via Bluetooth from ESP32:
  - [ ] Show "Test Failed" screen with recorded BrAC value
  - [ ] Show "Get a Safe Ride Home" section with:
    - [ ] **Grab** button → deep link: `grab://` or `https://grab.onelink.me/2695613898`
    - [ ] **JoyRide** button → deep link or app store link
- [ ] Show 5-minute cooldown countdown timer during lockout

### Emergency Contact Import
- [x] Integrate Web Contact Picker API to allow riders to import name and phone number directly from their device contacts list

### Offline Caching
- [x] Store ride history records in `localStorage` / IndexedDB when no internet
- [x] Auto-sync cached ride logs to `/api/ride-history` when internet restored
- [x] Show visual offline mode indicator in app

---

## 🖥️ FRONTEND — Admin Dashboard (Build from Scratch)
- **Status Note**: Migrated to a Vite-managed React Single Page Application (SPA) utilizing modular CSS tokens, vector SVG icons (no emojis), explicit dark/light theme options, clean top-bar unified page headers matching sidebar options, inline page action buttons (e.g. Add User next to Search), and removed the redundant/unused Geographical Tracking (Live Map) tab.

### Authentication
- [x] Admin login page (Email + Password, role must be `admin`)
- [x] Redirect non-admin users back to rider app

### Dashboard Overview Page
- [x] Stats cards: Total Riders, Total Rides, Total Failed Tests, Active Alerts
- [x] Line chart: Monthly trend of failed sobriety tests
- [x] Bar chart: Peak hours of failed tests
- [x] Bar chart: Peak days of failed tests
- [x] Real-time active alert feed (new failures appear without page refresh)

### User Management Page
- [x] Table: all rider accounts (Name, Email, Phone, Face Enrolled, Status)
- [x] View individual rider's emergency contacts list and registered motorcycles directly in table
- [x] Edit complete rider account info (Name, Email, Phone, Role) and manage/edit their associated motorcycles and emergency contacts directly via a centered overlay popup modal
- [x] Phone number character masking (`091******89`) in UI table lists
- [x] Search/filter by name or email
- [x] Suspend or delete rider account buttons
- [x] View individual rider's ride history

### Reports & Export Page
- [x] Date range picker (week, month, custom range)
- [x] Searchable, categorized dropdown containing 40+ specialized Report Types
- [x] Interactive Report Preview panel showing table preview before exporting
- [x] Export PDF and Export Excel compliance report buttons inside preview card

### Override Logs Page
- [x] Table: all Manual Override events (Rider, Date, BrAC at time of override)

### Backup & Restore Page
- [x] "Create Backup" button → downloads full JSON/SQL database schema
- [x] Restore instructions for panelists

### System Health, Settings & Logging (Additional Pages)
- [x] Live hardware devices & status monitoring dashboard console
- [x] Visual system health indicator checks (API & MySQL connection status)
- [x] Configurable threshold parameter settings interface (alcohol, timeout limits)
- [x] Administrative Audit Log trail layout view tab
- [x] Light Mode / Dark Mode switch visual toggle picker

---

## 📄 DOCUMENTATION (For Panelists)
- [x] Hardware Viability Proof document
- [x] Hardware 3D Visualization render
- [x] Hardware & Scalability Defense guide (GPS cost + max users)
- [x] Hardware Placement Guide (motorcycle + helmet 3D renders)
- [ ] Wiring diagram for Motorcycle Receiver (T-Tap installation with pin numbers)
- [x] System Architecture diagram (Mobile App → Backend → ESP32 Bluetooth → SIM7600 → Server)
