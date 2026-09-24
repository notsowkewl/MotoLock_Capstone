const fs=require('fs');
let s=fs.readFileSync('motolock-backend/esp32_oled.txt','utf8').replace(/\r\n/g,'\n');
function replace(a,b){if(!s.includes(a))throw Error('Missing firmware anchor: '+a.slice(0,80)); s=s.replace(a,b);}
replace('#define HELMET_DATA_TIMEOUT 5000','#define HELMET_DATA_TIMEOUT 1200');
replace('char pendingBtEvent[24] = "";',`char pendingBtEvent[24] = "";

// Protocol 2: short-lived pre-start camera permission. Never stops a running motor.
String verificationSession = "";
unsigned long verificationLeaseAt = 0;
const unsigned long VERIFICATION_LEASE_MS = 2500;
void stopBreathTest();

bool verificationLeaseFresh() {
  return verificationSession.length() == 36 && verificationLeaseAt != 0 &&
         millis() - verificationLeaseAt <= VERIFICATION_LEASE_MS;
}

void cancelPreStartVerification() {
  verificationLeaseAt = 0;
  if (!motorLocked || manualOverride) return;
  appStartAuthorized = false;
  buttonDisabled = true;
  stopBreathTest();
  digitalWrite(RELAY_PIN, RELAY_OFF);
}`);
replace('  String status = "STATUS:{";',`  String status = "STATUS:{";
  status += "\\"verificationProtocol\\":2,";
  status += "\\"verificationSession\\":\\"" + verificationSession + "\\",";
  status += "\\"helmetDataFresh\\":";
  status += hasFreshHelmetData() ? "true," : "false,";`);
replace('  memcpy(&receivedData,',`  // Reject malformed packets before touching sensor memory.
  if (len != sizeof(receivedData)) return;
  memcpy(&receivedData,`);
replace('void loop() {',`void loop() {
  if (motorLocked && !manualOverride && verificationSession.length() > 0 &&
      (!verificationLeaseFresh() || !SerialBT.hasClient() || !isHelmetDetected())) {
    if (appStartAuthorized || breathTestActive || breathTestWaiting) cancelPreStartVerification();
  }`);
replace('  msg.trim();',`  msg.trim();
  bool verifiedCommand = false;
  if (msg.startsWith("V2_")) {
    int separator = msg.indexOf(':');
    String command = separator >= 0 ? msg.substring(0, separator) : "";
    String session = separator >= 0 ? msg.substring(separator + 1) : "";
    bool validSession = session.length() == 36;
    for (unsigned int i = 0; i < session.length(); ++i) {
      char c = session[i];
      if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || c == '-')) validSession = false;
    }
    if (command == "V2_BEGIN" && validSession && motorLocked && !manualOverride) {
      cancelPreStartVerification();
      verificationSession = session;
      sendBluetoothStatus();
      msg = "";
    } else if (session == verificationSession && validSession) {
      if (command == "V2_CANCEL") {
        cancelPreStartVerification();
        verificationSession = "";
        msg = "";
      } else if (command == "V2_CHECK" && motorLocked && isHelmetDetected()) {
        verificationLeaseAt = millis();
        msg = "";
      } else if (command == "V2_BREATH_START" && verificationLeaseFresh() && motorLocked) {
        verifiedCommand = true; msg = "BREATH_START";
      } else if (command == "V2_AUTHORIZE" && verificationLeaseFresh() && motorLocked &&
                 isBreathStatus("RESULT_PASS") && hasFinalBrac && !isAlcoholLimitDetected()) {
        verifiedCommand = true; msg = "AUTHORIZE_START";
      } else { msg = ""; }
    } else { msg = ""; }
  }
  // Old clients cannot grant start permission or initiate a test without camera verification.
  if (!verifiedCommand && (msg == "UNLOCK" || msg == "AUTHORIZE_START" || msg == "BREATH_START")) {
    SerialBT.println("VERIFICATION_REQUIRED");
    msg = "";
  }`);
replace('    if (isHelmetDetected() &&\n        !isAlcoholLimitDetected() &&\n        ignitionEnabled)', '    if (verificationLeaseFresh() && isBreathStatus("RESULT_PASS") &&\n        isHelmetDetected() && !isAlcoholLimitDetected() && ignitionEnabled)');
// Normal start branch only; manual emergency override remains the documented separate path.
replace('    // SAFE\n    else {\n\n      if (ignitionEnabled)', '    // SAFE\n    else {\n\n      if (ignitionEnabled && appStartAuthorized && verificationLeaseFresh() &&\n          isHelmetDetected() && isBreathStatus("RESULT_PASS") && !isAlcoholLimitDetected())');
fs.writeFileSync('.work/native-verification/esp32_oled.txt',s);
console.log('Prepared receiver protocol 2 changes. Not flashed or applied.');
