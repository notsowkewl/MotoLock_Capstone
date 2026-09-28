package com.example.motolock

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.view.WindowManager
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.Camera
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LockOpen
import androidx.compose.material.icons.filled.BluetoothSearching
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.LocalDrink
import androidx.compose.material3.*
import com.example.motolock.data.AlcoholCheckPolicy
import com.example.motolock.data.AlcoholCheckPolicy.State
import com.example.motolock.data.CameraDecision
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import com.example.motolock.data.BluetoothService
import com.example.motolock.data.DualAiAnalyzer
import com.example.motolock.data.FaceData
import com.example.motolock.models.User
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.channels.FileChannel
import java.util.concurrent.Executors

private enum class UnlockStep {
    CONNECTING,
    FACE_HELMET_CHECK,
    ALCOHOL_CHECK,
    SUCCESS,
    ALCOHOL_DETECTED
}

@Composable
fun UnlockScreen(onComplete: () -> Unit, onBack: () -> Unit, onPairDevice: () -> Unit = {}) {
    val service = SessionState.activeBluetoothService
    val disconnected = remember { kotlinx.coroutines.flow.MutableStateFlow(false) }
    val connected by (service?.connectionState ?: disconnected).collectAsState()

    // The camera screen does not exist until there is a live motor connection.
    if (service == null || !connected) {
        LaunchedEffect(Unit) {
            SessionState.isMotorUnlocked = false
            CameraDecision.reset()
        }
        ESP32PairingScreen(onComplete = {}, onBack = onBack)
    } else {
        key(service) {
            ConnectedUnlockScreen(service, onComplete, onBack, onPairDevice)
        }
    }
}

@Composable
private fun ConnectedUnlockScreen(
    sessionService: BluetoothService,
    onComplete: () -> Unit,
    onBack: () -> Unit,
    onPairDevice: () -> Unit
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val coroutineScope = rememberCoroutineScope()
    var hasCameraPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA)
                == PackageManager.PERMISSION_GRANTED
        )
    }
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestPermission()
    ) { granted -> hasCameraPermission = granted }

    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val textGray = Color(0xFF737987)

    val bgBrush = Brush.linearGradient(
        colors = listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF))
    )

    var currentStep by remember { mutableStateOf(UnlockStep.CONNECTING) }
    var isConnectionFailed by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf("Connecting to MotoLock...") }
    var lowLightDetected by remember { mutableStateOf(false) }
    var faceCooldownUntil by remember { mutableStateOf(0L) }
    var faceCooldownSeconds by remember { mutableStateOf(0) }
    var faceMismatchLatched by remember { mutableStateOf(false) }
    
    // Reset the unlock phase state machine every time this screen opens
    LaunchedEffect(Unit) { CameraDecision.reset() }

    LaunchedEffect(currentStep) {
        if (currentStep == UnlockStep.FACE_HELMET_CHECK) {
            val guard = com.example.motolock.data.FaceAttemptCooldown.status(context)
            faceCooldownUntil = if (guard.remainingMs > 0L) System.currentTimeMillis() + guard.remainingMs else 0L
        }
    }

    LaunchedEffect(faceCooldownUntil) {
        if (faceCooldownUntil == 0L) {
            faceCooldownSeconds = 0
            return@LaunchedEffect
        }
        while (true) {
            val remaining = faceCooldownUntil - System.currentTimeMillis()
            if (remaining <= 0L) break
            faceCooldownSeconds = ((remaining + 999L) / 1000L).toInt()
            statusMessage = "Too many failed Face ID checks. Try again in $faceCooldownSeconds seconds."
            kotlinx.coroutines.delay(250L)
        }
        com.example.motolock.data.FaceAttemptCooldown.status(context)
        faceMismatchLatched = false
        faceCooldownUntil = 0L
        faceCooldownSeconds = 0
        if (currentStep == UnlockStep.FACE_HELMET_CHECK) {
            statusMessage = "Cooldown complete. Try Face ID again."
        }
    }

    // AI State
    var faceNetInterpreter by remember { mutableStateOf<Interpreter?>(null) }
    var helmetInterpreter by remember { mutableStateOf<Interpreter?>(null) }
    var registeredEmbedding by remember { mutableStateOf<FloatArray?>(null) }

    val helmetIdentity = remember { com.example.motolock.data.HelmetIdentity.load(context) }
    var aiReady by remember { mutableStateOf(false) }
    val cameraWorker = remember { Executors.newSingleThreadExecutor() }
    var cameraPreview by remember { mutableStateOf<Preview?>(null) }
    var cameraAnalysis by remember { mutableStateOf<ImageAnalysis?>(null) }
    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }
    var activeCamera by remember { mutableStateOf<Camera?>(null) }
    var activeAnalyzer by remember { mutableStateOf<DualAiAnalyzer?>(null) }
    var activeTelemetryManager by remember { mutableStateOf<com.example.motolock.data.HelmetTelemetryManager?>(null) }
    var alcoholFailed by remember { mutableStateOf(false) }
    var pendingHistoryWrites by remember { mutableStateOf(0) }
    val savingRide = pendingHistoryWrites > 0
    var alcoholStatus by remember { mutableStateOf("Reading sensor...") }
    val disposed = remember { java.util.concurrent.atomic.AtomicBoolean(false) }

    val alcoholSamples = remember { com.example.motolock.data.AlcoholSampleWindow() }

    fun handleAlcoholDetected(detectedLevel: Float? = alcoholSamples.maximum ?: sessionService.motorStatus.value?.alcoholPercent) {
        if (currentStep == UnlockStep.ALCOHOL_DETECTED) return
        pendingHistoryWrites++
        alcoholFailed = true
        currentStep = UnlockStep.ALCOHOL_DETECTED
        SessionState.isMotorUnlocked = false
        alcoholStatus = "Alcohol detected. Unlock blocked."
        coroutineScope.launch {
            try {
                try { sessionService.sendLockCommand() } catch (e: Exception) {
                    if (e is kotlinx.coroutines.CancellationException) throw e
                    alcoholStatus = "Alcohol detected. Lock confirmation unavailable."
                }
                try { sessionService.showAlcoholResult(detectedLevel) } catch (e: Exception) {
                    if (e is kotlinx.coroutines.CancellationException) throw e
                }
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                e.printStackTrace()
                Toast.makeText(context, "Alcohol detected. Check your connection.", Toast.LENGTH_LONG).show()
            } finally {
                pendingHistoryWrites--
            }
        }
    }

    val liveMotorStatus by sessionService.motorStatus.collectAsState()
    LaunchedEffect(liveMotorStatus) {
        val now = android.os.SystemClock.elapsedRealtime()
        val motorDetectedAlcohol = AlcoholCheckPolicy.state(liveMotorStatus, now) == State.DETECTED
        if (motorDetectedAlcohol && currentStep != UnlockStep.ALCOHOL_DETECTED) {
            alcoholSamples.observe(liveMotorStatus, now)
            handleAlcoholDetected(alcoholSamples.maximum ?: liveMotorStatus?.alcoholPercent)
            return@LaunchedEffect
        }
        if (currentStep == UnlockStep.ALCOHOL_CHECK) {
            alcoholSamples.observe(liveMotorStatus, now)
            alcoholSamples.reportDetected(liveMotorStatus, now)
        }
        if (currentStep == UnlockStep.SUCCESS &&
            AlcoholCheckPolicy.state(liveMotorStatus, android.os.SystemClock.elapsedRealtime()) == State.DETECTED) {
            handleAlcoholDetected()
        }
    }

    // Camera-only status; no hardware sensor is simulated.
    var isFaceAndHelmetDetected by remember { mutableStateOf(false) }
    // Init Models and Embedding
    LaunchedEffect(Unit) {
        try {
            // Load models
            val faceNetFd = context.assets.openFd("mobilefacenet.tflite")
            val faceNetChannel = FileInputStream(faceNetFd.fileDescriptor).channel
            val faceNetBuffer = faceNetChannel.map(FileChannel.MapMode.READ_ONLY, faceNetFd.startOffset, faceNetFd.declaredLength)
            faceNetInterpreter = Interpreter(faceNetBuffer, Interpreter.Options().apply { setNumThreads(4) })

            val helmetFd = context.assets.openFd("helmet.tflite")
            val helmetChannel = FileInputStream(helmetFd.fileDescriptor).channel
            val helmetBuffer = helmetChannel.map(FileChannel.MapMode.READ_ONLY, helmetFd.startOffset, helmetFd.declaredLength)
            helmetInterpreter = Interpreter(helmetBuffer, Interpreter.Options().apply { setNumThreads(4) })

            // Load embedding
            val authUser = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
            if (authUser != null) {
                val profile = com.example.motolock.data.RiderAccount.profile()
                
                val faceDesc = profile?.faceDescriptor
                registeredEmbedding = FaceData.decode(faceDesc)
            } else error("Sign in to load your Face ID")
            aiReady = true
            if (currentStep == UnlockStep.FACE_HELMET_CHECK) statusMessage = "Position your face in the camera."
        } catch (e: Exception) {
            if (e is kotlinx.coroutines.CancellationException) throw e
            e.printStackTrace()
            statusMessage = e.message ?: "Unable to load your saved Face ID"
        }
    }

    LaunchedEffect(Unit) {
        try {
            val prefs = context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE)
            val mac = prefs.getString("esp32_mac", null) ?: error("Pair your motorcycle first.")
            val encrypted = prefs.getString("esp32_secret_enc", null) ?: error("Pair your motorcycle first.")
            val secret = com.example.motolock.data.KeystoreHelper.decryptSecret(encrypted) ?: error("Pairing credentials are unavailable.")
            val svc = sessionService
            check(svc.isConnected) { "Bluetooth disconnected." }
            check(svc.authenticateSession(secret)) { "Motor authentication failed." }
            val identity = helmetIdentity ?: error("Pair your helmet first.")
            check(identity.matches(svc.readHelmetIdentity())) { "Connected helmet differs from your paired helmet." }
            check(!disposed.get() && svc.isConnected && SessionState.activeBluetoothService === svc) { "Bluetooth disconnected." }
            currentStep = UnlockStep.FACE_HELMET_CHECK
        } catch (e: Exception) {
            if (e is kotlinx.coroutines.CancellationException) throw e
            isConnectionFailed = true
            statusMessage = e.message ?: "Connection failed. Pair your device and retry."
        }
    }

    LaunchedEffect(SessionState.activeBluetoothService) {
        SessionState.activeBluetoothService?.connectionState?.collect { connected ->
            if (!connected && currentStep != UnlockStep.CONNECTING && currentStep != UnlockStep.ALCOHOL_DETECTED) {
                activeAnalyzer?.stop()
                cameraAnalysis?.clearAnalyzer()
                SessionState.isMotorUnlocked = false
                statusMessage = "Bluetooth disconnected. Reconnect and verify again."
                isConnectionFailed = true
                currentStep = UnlockStep.CONNECTING
            }
        }
    }

    // Stop camera processing once the result page is displayed.
    LaunchedEffect(currentStep) {
        if (currentStep == UnlockStep.FACE_HELMET_CHECK) {
            try { sessionService.setAlcoholCheckPhase(false) } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                // Alcohol entry requires an acknowledged phase update before prompting.
            }
        }
        if (currentStep == UnlockStep.SUCCESS || currentStep == UnlockStep.ALCOHOL_DETECTED) {
            cameraAnalysis?.clearAnalyzer()
            activeAnalyzer?.stop()
            cameraAnalysis?.let { cameraProvider?.unbind(it) }
            cameraPreview?.let { cameraProvider?.unbind(it) }
        }
    }

    // Request camera permission if not granted
    LaunchedEffect(hasCameraPermission, currentStep) {
        if (!hasCameraPermission && currentStep == UnlockStep.FACE_HELMET_CHECK) {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }
    
    DisposableEffect(Unit) {
        onDispose {
            disposed.set(true)
            cameraAnalysis?.clearAnalyzer()
            cameraAnalysis?.let { cameraProvider?.unbind(it) }
            cameraPreview?.let { cameraProvider?.unbind(it) }
            activeAnalyzer?.stop()
            cameraWorker.execute {
                activeAnalyzer?.close()
                faceNetInterpreter?.close()
                helmetInterpreter?.close()
            }
            cameraWorker.shutdown()
        }
    }

    val activityWindow = (context as? Activity)?.window
    DisposableEffect(activityWindow, currentStep, lowLightDetected) {
        val window = activityWindow
        val originalBrightness = window?.attributes?.screenBrightness
        if (window != null && currentStep == UnlockStep.FACE_HELMET_CHECK && lowLightDetected) {
            window.attributes = window.attributes.apply {
                screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL
            }
        }
        onDispose {
            if (window != null && originalBrightness != null) {
                window.attributes = window.attributes.apply { screenBrightness = originalBrightness }
            }
        }
    }

    if (currentStep == UnlockStep.SUCCESS || currentStep == UnlockStep.ALCOHOL_DETECTED) {
        AlcoholResultScreen(
            success = currentStep == UnlockStep.SUCCESS,
            motorLocked = liveMotorStatus?.locked == true,
            message = if (currentStep == UnlockStep.ALCOHOL_DETECTED) alcoholStatus else statusMessage,
            savingRide = savingRide,
            onReturnToDashboard = onComplete
        )
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(bgBrush)
            .padding(horizontal = 24.dp, vertical = 22.dp)
    ) {
        // Topbar
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(Color.White.copy(alpha = 0.88f), RoundedCornerShape(14.dp))
                    .border(1.dp, lineCol, RoundedCornerShape(14.dp))
                    .shadow(18.dp, RoundedCornerShape(14.dp), spotColor = Color(0xFF0F172A).copy(alpha = 0.05f))
                    .clickable { onBack() },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp), tint = motoBlack)
            }
        }
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Text(
            "Unlock Motorcycle",
            fontSize = 24.sp,
            fontWeight = FontWeight.Black,
            color = motoBlack
        )
        
        Spacer(modifier = Modifier.height(16.dp))

        // Progress indicators
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            StepIndicator(step = 1, current = currentStep.ordinal, label = "Face/Helmet", icon = Icons.Default.CameraAlt)
            StepIndicator(step = 2, current = currentStep.ordinal, label = "Alcohol", icon = Icons.Default.LocalDrink)
        }

        Spacer(modifier = Modifier.height(12.dp))
        if (lowLightDetected && currentStep == UnlockStep.FACE_HELMET_CHECK) {
            Text(
                "Low light detected. Screen brightness and camera exposure have been increased for face verification.",
                color = textGray,
                fontSize = 12.sp,
                modifier = Modifier.fillMaxWidth()
            )
            Spacer(modifier = Modifier.height(10.dp))
        }
        Spacer(modifier = Modifier.height(8.dp))
        
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .clip(RoundedCornerShape(24.dp))
                .background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            val showCamera = (currentStep == UnlockStep.ALCOHOL_CHECK ||
                (currentStep == UnlockStep.FACE_HELMET_CHECK && faceCooldownUntil == 0L)) &&
                hasCameraPermission && aiReady
            if (showCamera) {
                // Camera View — stays ON during alcohol check to monitor rider presence
                val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }
                AndroidView(
                    factory = { ctx ->
                        val previewView = PreviewView(ctx)
                        val executor = ContextCompat.getMainExecutor(ctx)
                        cameraProviderFuture.addListener({
                            if (disposed.get() || !sessionService.isConnected ||
                                SessionState.activeBluetoothService !== sessionService ||
                                (currentStep != UnlockStep.FACE_HELMET_CHECK && currentStep != UnlockStep.ALCOHOL_CHECK)) return@addListener
                            val provider = cameraProviderFuture.get()
                            cameraProvider = provider
                            val preview = Preview.Builder().build().also {
                                cameraPreview = it
                                it.setSurfaceProvider(previewView.surfaceProvider)
                            }
                            
                            val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA

                            val imageAnalyzer = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .build()
                                .also {
                                    cameraAnalysis = it
                                    val manager = com.example.motolock.data.RealHelmetTelemetryManager(context)
                                    activeTelemetryManager = manager
                                    val analyzer = DualAiAnalyzer(
                                        faceNetInterpreter = faceNetInterpreter,
                                        helmetInterpreter = helmetInterpreter,
                                        registeredEmbedding = registeredEmbedding,
                                        telemetryManager = manager,
                                        // Pin all verification to the physically provisioned helmet.
                                        pairedHelmetDeviceId = helmetIdentity?.deviceId,
                                        pairedHelmetVisualId = helmetIdentity?.visualId,
                                        helmetPublicKey = helmetIdentity?.publicKey,
                                        logoIdentityDetector = com.example.motolock.data.IntegratedLogoDetector(),
                                        onLowLightChanged = { lowLight ->
                                            lowLightDetected = lowLight
                                            activeCamera?.let { camera ->
                                                val range = camera.cameraInfo.exposureState.exposureCompensationRange
                                                val target = if (lowLight) minOf(range.upper, 3) else 0.coerceIn(range.lower, range.upper)
                                                camera.cameraControl.setExposureCompensationIndex(target)
                                            }
                                        }
                                    ) { success, msg ->
                                        if (disposed.get() || !sessionService.isConnected ||
                                            SessionState.activeBluetoothService !== sessionService) return@DualAiAnalyzer

                                        if (currentStep == UnlockStep.FACE_HELMET_CHECK) {
                                            if (faceCooldownUntil > System.currentTimeMillis()) return@DualAiAnalyzer

                                            if (msg.startsWith("Face ID not recognized", ignoreCase = true)) {
                                                isFaceAndHelmetDetected = false
                                                if (!faceMismatchLatched) {
                                                    faceMismatchLatched = true
                                                    val attempt = com.example.motolock.data.FaceAttemptCooldown
                                                        .registerFailure(context)
                                                    if (attempt.remainingMs > 0L) {
                                                        faceCooldownUntil = System.currentTimeMillis() + attempt.remainingMs
                                                        faceCooldownSeconds = ((attempt.remainingMs + 999L) / 1000L).toInt()
                                                        statusMessage = "Too many failed Face ID checks. Try again in 30 seconds."
                                                        activeAnalyzer?.stop()
                                                        cameraAnalysis?.clearAnalyzer()
                                                    } else {
                                                        val remainingAttempts =
                                                            com.example.motolock.data.FaceAttemptCooldown.MAX_FAILED_ATTEMPTS -
                                                                attempt.failedAttempts
                                                        statusMessage = "Face ID not recognized. $remainingAttempts tries before a 30-second cooldown."
                                                    }
                                                }
                                                return@DualAiAnalyzer
                                            }

                                            faceMismatchLatched = false
                                            if (msg.startsWith("Face verified", ignoreCase = true)) {
                                                com.example.motolock.data.FaceAttemptCooldown.registerSuccess(context)
                                            }
                                        }

                                        // During alcohol check: monitor rider is still in frame and alone
                                        if (currentStep == UnlockStep.ALCOHOL_CHECK) {
                                            if (alcoholFailed) return@DualAiAnalyzer
                                            if (msg.contains("Multiple faces", ignoreCase = true)) {
                                                currentStep = UnlockStep.FACE_HELMET_CHECK
                                                CameraDecision.reset()
                                                alcoholStatus = "Reading sensor..."
                                                statusMessage = "Multiple faces detected. Only one rider allowed."
                                            }
                                            return@DualAiAnalyzer
                                        }

                                        if (currentStep != UnlockStep.FACE_HELMET_CHECK) return@DualAiAnalyzer
                                        isFaceAndHelmetDetected = success
                                        if (success) {
                                            currentStep = UnlockStep.ALCOHOL_CHECK
                                            statusMessage = "Authorizing motorcycle..."
                                            coroutineScope.launch {
                                                val prefs = context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE)
                                                val encrypted = prefs.getString("esp32_secret_enc", null)
                                                val secret = encrypted?.let { com.example.motolock.data.KeystoreHelper.decryptSecret(it) }
                                                
                                                                                                if (secret == null) {
                                                    alcoholStatus = "Pair your motorcycle first."
                                                    return@launch
                                                }

                                                alcoholSamples.reset()
                                                run {
                                                        try {
                                                            sessionService.setAlcoholCheckPhase(true)
                                                        } catch (e: Exception) {
                                                            if (e is kotlinx.coroutines.CancellationException) throw e
                                                            alcoholFailed = true
                                                            alcoholStatus = if (e.message == "ERR_UNSUPPORTED_COMMAND")
                                                                "Update the motor firmware to sync the alcohol check."
                                                            else "Unable to sync the motor display. Return and retry."
                                                            return@launch
                                                        }
                                                    }
                                                while (currentStep == UnlockStep.ALCOHOL_CHECK && !disposed.get()) {
                                                    val now = android.os.SystemClock.elapsedRealtime()
                                                    val sensorState = AlcoholCheckPolicy.state(sessionService.motorStatus.value, now)
                                                    if (alcoholSamples.startedAt == null &&
                    (sensorState == State.READY || sensorState == State.DETECTED)) {
                                                        alcoholSamples.start(now, sessionService.motorStatus.value)
                                                    }
                                                    alcoholSamples.observe(sessionService.motorStatus.value, now)
                                                    if (sensorState == State.DETECTED || alcoholSamples.detected) {
                                                        handleAlcoholDetected(alcoholSamples.maximum ?: sessionService.motorStatus.value?.alcoholPercent)
                                                        return@launch
                                                    }
                                                    if (sensorState != State.READY) {
                                                        alcoholStatus = when (sensorState) {
                                                            State.WARMING -> "MQ3 warming up. Please wait."
                                                            State.STABILIZING -> "MQ3 stabilizing. Keep sensor in clean air."
                                                            State.NOT_WORN -> "Wear your helmet before the alcohol check."
                                                            else -> "Waiting for fresh helmet sensor data..."
                                                        }
                                                        if (alcoholSamples.startedAt != null) {
                                                            alcoholStatus += " Timer paused; will resume after sensor is ready."
                                                        }
                                                        kotlinx.coroutines.delay(200)
                                                        continue
                                                    }
                                                    val remaining = alcoholSamples.remaining(now)
                                                    if (remaining > 0) {
                                                        alcoholStatus = "Blow into sensor... (" + ((remaining + 999) / 1000) + " s)"
                                                        kotlinx.coroutines.delay(200)
                                                        continue
                                                    }
                                                    alcoholStatus = "Analyzing sample..."
                                                    try {
                                                        val service = sessionService
                                                        check(service.isConnected && SessionState.activeBluetoothService === service) { "Bluetooth disconnected." }
                                                                                                                if (service.sendUnlockCommand(secret)) {
                                                            if (disposed.get() || currentStep != UnlockStep.ALCOHOL_CHECK ||
                                                                !service.isConnected || SessionState.activeBluetoothService !== service) {
                                                                service.sendLockCommand()
                                                                return@launch
                                                            }
                                                            if (AlcoholCheckPolicy.state(service.motorStatus.value, android.os.SystemClock.elapsedRealtime()) != State.READY) {
                                                                service.sendLockCommand()
                                                                continue
                                                            }
                                                            pendingHistoryWrites++
                                                            currentStep = UnlockStep.SUCCESS
                                                            SessionState.isMotorUnlocked = true
                                                            statusMessage = "Motorcycle unlocked."
                                                            
                                                            try {
                                                                com.example.motolock.data.RideHistoryRepository.recordUnlock(
                                                                    context, alcoholSamples.maximum
                                                                )
                                                            } catch (e: Exception) {
                                                                if (e is kotlinx.coroutines.CancellationException) throw e
                                                                e.printStackTrace()
                                                                Toast.makeText(context, "Motorcycle unlocked, but ride history could not be saved.", Toast.LENGTH_LONG).show()
                                                            } finally {
                                                                pendingHistoryWrites--
                                                            }

                                                            break
                                                        }
                                                    } catch (e: Exception) {
                                                        if (e is kotlinx.coroutines.CancellationException) throw e
                                                        if (e.message == "ERR_HELMET_NOT_READY") {
                                                            alcoholSamples.reset()
                                                            alcoholStatus = "Waiting for updated helmet sensor status..."
                                                        } else {
                                                            alcoholFailed = true
                                                            alcoholStatus = e.message ?: "Unable to authorize motorcycle. Return and retry."
                                                            return@launch
                                                        }
                                                        kotlinx.coroutines.delay(1000)
                                                    }
                                                }
                                            }
                                        } else {
                                            statusMessage = msg
                                        }
                                    }
                                    activeAnalyzer = analyzer
                                    it.setAnalyzer(cameraWorker, analyzer)
                                }

                            try {
                                provider.unbindAll()
                                activeCamera = provider.bindToLifecycle(lifecycleOwner, cameraSelector, preview, imageAnalyzer)
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }, executor)
                        previewView
                    },
                    modifier = Modifier.fillMaxSize()
                )
            } else if (currentStep == UnlockStep.FACE_HELMET_CHECK && faceCooldownSeconds > 0) {
                androidx.compose.foundation.layout.Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
                    CircularProgressIndicator(color = motoRed)
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Face ID paused", color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Text("Try again in $faceCooldownSeconds seconds", color = Color.White.copy(alpha = 0.8f))
                }
            } else if (currentStep == UnlockStep.CONNECTING) {
                androidx.compose.foundation.layout.Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
                    if (isConnectionFailed) {
                        androidx.compose.material3.Icon(androidx.compose.material.icons.Icons.Default.BluetoothSearching, contentDescription = null, tint = androidx.compose.ui.graphics.Color.Gray, modifier = androidx.compose.ui.Modifier.size(48.dp))
                        androidx.compose.foundation.layout.Spacer(modifier = androidx.compose.ui.Modifier.height(16.dp))
                        androidx.compose.material3.Text("Tap here to see devices", color = androidx.compose.ui.graphics.Color(0xFFED1C24), fontWeight = androidx.compose.ui.text.font.FontWeight.Bold, modifier = androidx.compose.ui.Modifier.clickable { onPairDevice() })
                    } else {
                        androidx.compose.material3.CircularProgressIndicator(color = androidx.compose.ui.graphics.Color(0xFFED1C24))
                    }
                }
            } else if (currentStep == UnlockStep.SUCCESS) {
                val percent = activeTelemetryManager?.getTelemetry()?.alcoholPercent ?: 0f
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(64.dp))
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Unlocked", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        "Alcohol: %.3f%%".format(percent),
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 16.sp
                    )
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Status Card — show during face/helmet and alcohol check steps
        if (currentStep == UnlockStep.FACE_HELMET_CHECK || currentStep == UnlockStep.ALCOHOL_CHECK) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(Color(0xFFF8FAFC))
                    .border(1.dp, lineCol, RoundedCornerShape(16.dp))
                    .padding(20.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    if (currentStep == UnlockStep.ALCOHOL_CHECK) {
                        Text("Alcohol check", fontSize = 12.sp, color = textGray, textAlign = TextAlign.Center)
                        val reading = liveMotorStatus?.takeIf {
                            android.os.SystemClock.elapsedRealtime() - it.receivedAt in 0L..3500L &&
                                it.helmetDataFresh == true && it.mq3BaselineReady == true
                        }?.alcoholPercent
                        Text(reading?.let { "Alcohol: %.3f%%".format(it) } ?: "Alcohol: --",
                            fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = motoBlack)
                        Spacer(modifier = Modifier.height(8.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            if (!alcoholFailed) CircularProgressIndicator(color = motoRed, modifier = Modifier.size(14.dp), strokeWidth = 2.dp)
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(alcoholStatus, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = motoBlack)
                        }
                    } else {
                        Text(statusMessage, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = motoBlack, textAlign = TextAlign.Center)
                    }
                }
            }
        }
    }
}

@Composable
fun StepIndicator(step: Int, current: Int, label: String, icon: androidx.compose.ui.graphics.vector.ImageVector) {
    val isCompleted = step < current
    val isActive = step == current
    
    val color = when {
        isCompleted -> Color(0xFF10B981) // Green for done
        isActive -> Color(0xFFED1C24)    // Red for active
        else -> Color(0xFFE2E8F0)        // Gray for upcoming
    }
    val contentColor = if (isCompleted || isActive) Color.White else Color(0xFF94A3B8)
    val labelColor = when {
        isActive -> Color(0xFF1E293B)
        isCompleted -> Color(0xFF10B981)
        else -> Color(0xFF94A3B8)
    }
    
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(color),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = contentColor, modifier = Modifier.size(20.dp))
        }
        Spacer(modifier = Modifier.height(6.dp))
        Text(label, fontSize = 10.sp, fontWeight = FontWeight.Bold, color = labelColor)
    }
}







