const fs=require('fs'),path=require('path'),crypto=require('crypto');
const native='C:/Users/Ari/Documents/MotoLock_Native';
const stage=path.join(__dirname,'project');
const base='app/src/main/java/com/example/motolock/';
const restores=[
 [base+'CameraScreen.kt','verification-backup-20260923-195358'],
 [base+'UnlockScreen.kt','verification-backup-20260923-195358'],
 [base+'data/DualAiAnalyzer.kt','verification-backup-20260923-195358'],
 [base+'data/BluetoothService.kt','verification-backup-20260923-195358'],
 [base+'DashboardScreen.kt','verification-backup-20260923-202346'],
 [base+'SetupRouterScreen.kt','verification-backup-20260923-202346']
];
const removals=[base+'VerificationCamera.kt',base+'data/CameraCheck.kt',base+'data/EnrollmentChallenge.kt',
 base+'data/FaceProfiles.kt',base+'data/NativeVision.kt',base+'data/VerificationPolicy.kt',base+'data/TensorPixels.kt',
 'app/src/main/assets/helmet-model.json','app/src/test/java/com/example/motolock/VerificationPolicyTest.kt'];
for(const [file,backup] of restores) fs.copyFileSync(path.join(native,backup,file),path.join(stage,file));
for(const file of removals) {const target=path.join(stage,file);if(fs.existsSync(target))fs.unlinkSync(target);}
fs.writeFileSync(path.join(stage,'VERIFICATION.md'),`# Verification changes rolled back\n\nAt the user's request, the original camera registration, unlock screen, dashboard, setup routing, Bluetooth service and DualAiAnalyzer were restored from the pre-change backups. The additional hold/capture flow and camera-only helpers were removed.\n\nThe Unlock Motorcycle button is hidden unless the original full setup requirements are complete. Original layouts and labels are restored.\n\nThis rollback restores the earlier behavior, including its existing model/enrollment limitations; it does not claim improved detection accuracy. No database records, model weights or hardware firmware were changed by this rollback.\n`);
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase():null;
const entries=[...restores.map(([p])=>p),...removals,'VERIFICATION.md'].map(p=>({path:p,remove:removals.includes(p),originalHash:hash(path.join(native,p)),stagedHash:hash(path.join(stage,p))})).filter(e=>e.originalHash!==e.stagedHash);
fs.writeFileSync(path.join(__dirname,'apply-manifest.json'),JSON.stringify(entries,null,2));
console.log(entries.map(e=>`${e.remove?'REMOVE':'RESTORE'} ${e.path}`).join('\n'));
const dashboard=fs.readFileSync(path.join(stage,base,'DashboardScreen.kt'),'utf8');
if(!dashboard.includes('if (isSetupComplete) {')||!dashboard.includes('hasFaceId && hasEmergencyContact && hasMotorcycle && hasPin && hasConnectedDevice'))throw Error('Original dashboard gating missing');
console.log('Confirmed: original full setup condition controls Unlock Motorcycle button visibility.');
