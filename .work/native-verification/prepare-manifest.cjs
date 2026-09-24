const fs=require('fs'),path=require('path'),crypto=require('crypto');
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase():null;
const entries=[
 'app/src/main/java/com/example/motolock/CameraScreen.kt',
 'app/src/main/java/com/example/motolock/UnlockScreen.kt',
 'app/src/main/java/com/example/motolock/VerificationCamera.kt',
 'app/src/main/java/com/example/motolock/DashboardScreen.kt',
 'app/src/main/java/com/example/motolock/SetupRouterScreen.kt',
 'app/src/main/java/com/example/motolock/data/BluetoothService.kt',
 'app/src/main/java/com/example/motolock/data/HardwareStatus.kt',
 'app/src/main/java/com/example/motolock/data/FaceProfiles.kt',
 'app/src/main/java/com/example/motolock/data/CameraCheck.kt',
 'app/src/main/java/com/example/motolock/data/EnrollmentChallenge.kt',
 'app/src/main/java/com/example/motolock/data/NativeVision.kt',
 'app/src/main/java/com/example/motolock/data/VerificationPolicy.kt',
 'app/src/main/java/com/example/motolock/data/TensorPixels.kt',
 'app/src/main/assets/helmet-model.json',
 'app/src/test/java/com/example/motolock/VerificationPolicyTest.kt',
 'VERIFICATION.md'
].map(p=>({path:p,remove:p.endsWith('/HardwareStatus.kt'),originalHash:hash(path.join('C:/Users/Ari/Documents/MotoLock_Native',p)),stagedHash:hash(path.join(__dirname,'project',p))})).filter(e=>e.originalHash!==e.stagedHash);
fs.writeFileSync(path.join(__dirname,'apply-manifest.json'),JSON.stringify(entries,null,2));
console.log(entries.map(e=>`${e.remove?'REMOVE':e.originalHash?'UPDATE':'ADD'} ${e.path}`).join('\n'));
