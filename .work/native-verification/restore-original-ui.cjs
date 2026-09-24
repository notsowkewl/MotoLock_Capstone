const fs=require('fs'),path=require('path');
const stage=path.join(__dirname,'project/app/src/main/java/com/example/motolock');
const backup='C:/Users/Ari/Documents/MotoLock_Native/verification-backup-20260923-195358/app/src/main/java/com/example/motolock';
const read=p=>fs.readFileSync(p,'utf8').replace(/\r\n/g,'\n');
const originalUnlock=read(path.join(backup,'UnlockScreen.kt'));
let currentUnlock=read(path.join(stage,'UnlockScreen.kt'));
const originalImports=originalUnlock.slice(0,originalUnlock.indexOf('private enum class UnlockStep'))
 .replace('import com.example.motolock.data.DualAiAnalyzer\n','');
const currentExtra=currentUnlock.slice(currentUnlock.indexOf('import '),currentUnlock.indexOf('@Composable'));
const imports=[...new Set((originalImports+'\n'+currentExtra).split('\n').filter(l=>l.startsWith('import ')))].join('\n');
let logic=currentUnlock.slice(currentUnlock.indexOf('@Composable'),currentUnlock.indexOf('    Column(Modifier.fillMaxSize()'));
logic=logic.replace('var databaseError by remember','var needsRegistration by remember {mutableStateOf(false)}\n    var databaseError by remember');
logic=logic.replace('lastProfileRead=SystemClock.elapsedRealtime(); databaseError=null','lastProfileRead=SystemClock.elapsedRealtime(); databaseError=null; needsRegistration=false');
logic=logic.replace('} catch(e:Exception) {\n                profile=null;', '} catch(e:FaceProfileRequiredException) {\n                profile=null; needsRegistration=true; enrollment=true\n                check.reset(e.message ?: "Register your face"); publish()\n            } catch(e:Exception) {\n                profile=null;');
logic=logic.replace('CameraScreen(onBack={enrollment=false},onRegistrationSuccess={enrollment=false; profile=null; refresh++})','CameraScreen(onBack=onBack,onRegistrationSuccess={enrollment=false; needsRegistration=false; profile=null; refresh++})');
logic+=`    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val bgBrush = Brush.linearGradient(listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF)))
    val currentStep = UnlockStep.FACE_HELMET_CHECK
    val hasCameraPermission = allowed
    val isConnectionFailed = false
    val statusMessage = databaseError ?: cameraError ?: message
`;
let ui=originalUnlock.slice(originalUnlock.indexOf('    Column(\n'));
const previewStart=ui.indexOf('                // Camera View');
const previewEnd=ui.indexOf('            } else if (currentStep == UnlockStep.CONNECTING)',previewStart);
if(previewStart<0||previewEnd<0)throw Error('Unlock preview anchor missing');
ui=ui.slice(0,previewStart)+`                if (foreground && profile != null && databaseError == null && cameraError == null) {
                    VerificationCamera(profile, true, false, generation, Modifier.fillMaxSize(), onSample = { sample ->
                        if (lastProfileRead == 0L || SystemClock.elapsedRealtime() - lastProfileRead > 15000) {
                            check.reset("Waiting for a fresh database check")
                        } else {
                            check.observe(SystemClock.elapsedRealtime(), sample.capturedAt, sample.faceMatches,
                                sample.helmetOnHead, sample.message, sample.helmetLabelsVerified)
                        }
                        publish()
                    }, onError = { cameraError = it; check.reset(it); publish() })
                }
`+ui.slice(previewEnd);
fs.writeFileSync(path.join(stage,'UnlockScreen.kt'),'package com.example.motolock\n\n'+imports+'\n\n'+originalUnlock.slice(originalUnlock.indexOf('private enum class UnlockStep'),originalUnlock.indexOf('@Composable'))+logic+ui);

const originalCamera=read(path.join(backup,'CameraScreen.kt'));
let cameraHeader=originalCamera.slice(0,originalCamera.indexOf('@Composable'))
 .replace('import com.example.motolock.data.DualAiAnalyzer\n','');
cameraHeader=cameraHeader.replace('private enum class CameraMode','import com.example.motolock.data.*\n\nprivate enum class CameraMode');
let cameraUi=originalCamera.slice(originalCamera.indexOf('    Column(\n'),originalCamera.indexOf('\nclass LivenessAnalyzer('));
const cameraStart=cameraUi.indexOf('                            AndroidView(');
const cameraEnd=cameraUi.indexOf('                    // Dots progress indicator below',cameraStart);
if(cameraStart<0||cameraEnd<0)throw Error('Enrollment preview anchor missing');
cameraUi=cameraUi.slice(0,cameraStart)+`                            if (!saving && !isSuccess) {
                                VerificationCamera(registeredEmb, cameraMode == CameraMode.UNLOCK,
                                    cameraMode == CameraMode.REGISTRATION, generation, Modifier.fillMaxSize(),
                                    onSample = { sample -> handleSample(sample) },
                                    onError = { statusText = it; livenessStep = LivenessStep.FAILED })
                            }
                        }
                    }

`+cameraUi.slice(cameraEnd);
const logicCamera=`@Composable
fun CameraScreen(onBack: () -> Unit, onRegistrationSuccess: (() -> Unit)? = null) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val motoGreen = Color(0xFF1FA35B)
    val lineCol = Color(0xFFE8EBF0)
    val progressColor = Color(0xFF3B82F6)
    val bgBrush = Brush.linearGradient(listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF)))
    var hasCameraPermission by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    val permLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { hasCameraPermission = it }
    var cameraMode by remember { mutableStateOf(CameraMode.LOADING) }
    var statusText by remember { mutableStateOf("Loading...") }
    var isSuccess by remember { mutableStateOf(false) }
    var saving by remember { mutableStateOf(false) }
    var registeredEmb by remember { mutableStateOf<FloatArray?>(null) }
    var livenessStep by remember { mutableStateOf(LivenessStep.DETECT_FACE) }
    var generation by remember { mutableIntStateOf(0) }
    val samples = remember { mutableListOf<FloatArray>() }
    val cameraCheck = remember { CameraCheck() }
    val arcProgress by animateFloatAsState(targetValue = livenessStep.progress, animationSpec = tween(600), label = "liveness_arc")

    LaunchedEffect(Unit) { if (!hasCameraPermission) permLauncher.launch(Manifest.permission.CAMERA) }
    LaunchedEffect(Unit) {
        while (true) {
            try {
                val saved = FaceProfiles.load()
                if (onRegistrationSuccess != null) { onRegistrationSuccess(); return@LaunchedEffect }
                if (registeredEmb?.contentEquals(saved) != true) {
                    registeredEmb = saved; generation++; cameraCheck.reset("Position your face in the frame")
                }
                cameraMode = CameraMode.UNLOCK
            } catch (e: FaceProfileRequiredException) {
                registeredEmb = null; cameraMode = CameraMode.REGISTRATION
                statusText = LivenessStep.DETECT_FACE.title
                return@LaunchedEffect
            } catch (e: kotlinx.coroutines.CancellationException) {
                if (e !is kotlinx.coroutines.TimeoutCancellationException) throw e
                registeredEmb = null; isSuccess = false; statusText = "Database check timed out. Reconnecting..."
                cameraMode = CameraMode.UNLOCK
            } catch (e: Exception) {
                registeredEmb = null; isSuccess = false; statusText = e.message ?: "Cannot read saved Face ID"
                cameraMode = CameraMode.UNLOCK
            }
            delay(5000)
        }
    }

    fun handleSample(sample: VisionSample) {
        if (cameraMode == CameraMode.UNLOCK) {
            if (registeredEmb == null) return
            cameraCheck.observe(android.os.SystemClock.elapsedRealtime(), sample.capturedAt,
                sample.faceMatches, sample.helmetOnHead, sample.message, sample.helmetLabelsVerified)
            isSuccess = cameraCheck.verified; statusText = cameraCheck.message
            return
        }
        if (saving || isSuccess || livenessStep == LivenessStep.FAILED) return
        if (!sample.faceMatches || sample.embedding == null || !VerificationPolicy.fresh(android.os.SystemClock.elapsedRealtime(), sample.capturedAt)) {
            samples.clear(); livenessStep = LivenessStep.DETECT_FACE; statusText = sample.message
            return
        }
        if (!sample.live) {
            samples.clear(); statusText = sample.message
            livenessStep = when {
                sample.message.contains("left", true) -> LivenessStep.TURN_LEFT
                sample.message.contains("right", true) -> LivenessStep.TURN_RIGHT
                sample.message.contains("blink", true) -> LivenessStep.BLINK
                else -> LivenessStep.DETECT_FACE
            }
            return
        }
        if (samples.isNotEmpty() && VerificationPolicy.distance(samples.first(), sample.embedding) > 0.65f) {
            samples.clear(); generation++; livenessStep = LivenessStep.DETECT_FACE
            statusText = "Face changed. Repeat the liveness check."
            return
        }
        samples.add(sample.embedding.copyOf())
        livenessStep = LivenessStep.PROCESSING; statusText = "Hold still: capturing face "+samples.size+" / 8"
        if (samples.size == 8) {
            val mean = VerificationPolicy.normalize(FloatArray(VerificationPolicy.FACE_SIZE) { i -> samples.sumOf { it[i].toDouble() }.toFloat()/samples.size })
            saving = true
            scope.launch {
                try {
                    FaceProfiles.saveAndVerify(mean)
                    isSuccess = true; livenessStep = LivenessStep.SUCCESS; statusText = "Registration complete!"
                    delay(1500); onRegistrationSuccess?.invoke() ?: onBack()
                } catch (e: kotlinx.coroutines.CancellationException) {
                    if (e !is kotlinx.coroutines.TimeoutCancellationException) throw e
                    livenessStep = LivenessStep.FAILED; statusText = "Failed: database check timed out"
                } catch (e: Exception) {
                    livenessStep = LivenessStep.FAILED; statusText = "Failed: "+e.message
                } finally { saving = false }
                if (!isSuccess) {
                    delay(2500); samples.clear(); generation++; livenessStep = LivenessStep.DETECT_FACE
                    statusText = LivenessStep.DETECT_FACE.title
                }
            }
        }
    }

`;
// Do not start an enrollment-style analyzer when a verification profile cannot be read.
cameraUi=cameraUi.replace('if (!saving && !isSuccess) {','if (!saving && (cameraMode == CameraMode.REGISTRATION && !isSuccess || cameraMode == CameraMode.UNLOCK && registeredEmb != null)) {');
fs.writeFileSync(path.join(stage,'CameraScreen.kt'),cameraHeader+logicCamera+cameraUi);

let dashboard=read(path.join(stage,'DashboardScreen.kt')).replace('"Check Face & Helmet"','"Unlock Motorcycle"');
fs.writeFileSync(path.join(stage,'DashboardScreen.kt'),dashboard);
console.log('Restored original screen layout trees; replaced only camera processing/state bindings.');
