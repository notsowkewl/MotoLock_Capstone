const fs=require('fs'),path=require('path');
const stage=path.join(__dirname,'project'),native='C:/Users/Ari/Documents/MotoLock_Native';
const p='app/src/main/java/com/example/motolock/';
let dashboard=fs.readFileSync(path.join(native,p,'DashboardScreen.kt'),'utf8');
dashboard=dashboard.replace('hasFaceId = profile.faceDescriptor != null && profile.faceDescriptor !is kotlinx.serialization.json.JsonNull','hasFaceId = com.example.motolock.data.FaceProfiles.isUsable(profile.faceDescriptor)');
dashboard=dashboard.replace('// Only show Unlock button when setup is fully complete','// Camera testing does not require a paired device or completed hardware setup.');
dashboard=dashboard.replace('if (isSetupComplete) {','if (!isLoading) {');
dashboard=dashboard.replace('"Unlock Motorcycle"','"Check Face & Helmet"');
dashboard=dashboard.replace('showSetupModal = true;','showSetupModal = false;').replace('showSetupModal = true\r\n                SessionState.isFirstDashboardLoad','showSetupModal = false\r\n                SessionState.isFirstDashboardLoad').replace('showSetupModal = true\n                SessionState.isFirstDashboardLoad','showSetupModal = false\n                SessionState.isFirstDashboardLoad');
fs.writeFileSync(path.join(stage,p,'DashboardScreen.kt'),dashboard);
let setup=fs.readFileSync(path.join(native,p,'SetupRouterScreen.kt'),'utf8');
setup=setup.replace('userProfile != null && userProfile.faceDescriptor != null && userProfile.faceDescriptor.toString() != "null" && userProfile.faceDescriptor.toString() != "[]"','com.example.motolock.data.FaceProfiles.isUsable(userProfile?.faceDescriptor)');
const begin=setup.indexOf('        val device = SupabaseClientManager.client.postgrest["devices"]');
const end=setup.indexOf('        navController.navigate("dashboard")',begin);
if(begin<0||end<0)throw Error('Setup route anchor missing');
setup=setup.slice(0,begin)+'        // Hardware pairing is deferred while the camera is being validated.\n'+setup.slice(end);
fs.writeFileSync(path.join(stage,p,'SetupRouterScreen.kt'),setup);
// Keep the original Bluetooth service for the existing optional pairing screen.
fs.copyFileSync(path.join(native,'verification-backup-20260923-195358',p,'data/BluetoothService.kt'),path.join(stage,p,'data/BluetoothService.kt'));
let policy=fs.readFileSync(path.join(stage,p,'data/VerificationPolicy.kt'),'utf8');
policy=policy.slice(0,policy.indexOf('/** Only the pre-start flow'));
fs.writeFileSync(path.join(stage,p,'data/VerificationPolicy.kt'),policy);
// Restore only our firmware edits, preserving any unrelated user changes.
const receiver='motolock-backend/esp32_oled.txt';
if(fs.readFileSync(receiver,'utf8').replace(/\r\n/g,'\n')!==fs.readFileSync(path.join(__dirname,'esp32_oled.txt'),'utf8').replace(/\r\n/g,'\n'))throw Error('Receiver has changed since our patch; manual merge required');
fs.copyFileSync(path.join(__dirname,'esp32_oled.before.txt'),receiver);
const sensor='motolock-backend/esp32_sensor.txt';
let sensorText=fs.readFileSync(sensor,'utf8').replace('Serial.print(irState == LOW ? "TRIGGERED" : "NOT TRIGGERED");','Serial.print(irState ? "TRIGGERED" : "NOT TRIGGERED");');
// Original file had no final newline.
sensorText=sensorText.replace(/\r?\n$/,'');fs.writeFileSync(sensor,sensorText);
console.log('Prepared camera-only routes and restored our firmware changes.');
