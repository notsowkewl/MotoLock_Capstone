package com.example.motolock

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import kotlinx.serialization.json.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.example.motolock.data.BluetoothService
import com.example.motolock.data.DualAiAnalyzer
import com.example.motolock.data.FaceData
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.channels.FileChannel
import java.util.concurrent.Executors
import kotlin.math.abs

// ────────────────────────────────────────────────────────────

private enum class CameraMode { LOADING, REGISTRATION, UNLOCK }

private enum class LivenessStep(val title: String, val progress: Float) {
    DETECT_FACE("Position your face in the circle", 0f),
    BLINK      ("Blink slowly",                     0.25f),
    TURN_LEFT  ("Turn your head to your left",      0.5f),
    TURN_RIGHT ("Turn your head to your right",     0.75f),
    PROCESSING ("Processing...",                      0.9f),
    SUCCESS    ("Face registered!",                 1f),
    FAILED     ("Registration Failed",              0f)
}

data class FaceFrame(
    val faceCount: Int,
    val eulerY: Float,
    val eulerZ: Float,
    val leftEyeOpen: Float,
    val rightEyeOpen: Float,
    val captureFace: (() -> FloatArray?)? = null
)

// ────────────────────────────────────────────────────────────

@Composable
fun CameraScreen(
    onBack: () -> Unit,
    onRegistrationSuccess: (() -> Unit)? = null
) {
    val context        = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val coroutineScope = rememberCoroutineScope()

    val motoRed   = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val motoGreen = Color(0xFF1FA35B)
    val lineCol   = Color(0xFFE8EBF0)
    val textGray  = Color(0xFF737987)
    val progressColor = Color(0xFF3B82F6) // Blue for progress
    val bgBrush   = Brush.linearGradient(listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF)))

    var hasCameraPermission by remember {
        mutableStateOf(ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED)
    }
    val permLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        granted -> hasCameraPermission = granted
    }
    LaunchedEffect(Unit) { if (!hasCameraPermission) permLauncher.launch(Manifest.permission.CAMERA) }

    // ────────────────────────────────────────────────────────────
    var cameraMode      by remember { mutableStateOf(CameraMode.LOADING) }
    var statusText      by remember { mutableStateOf("Loading...") }
    var isSuccess       by remember { mutableStateOf(false) }
    var registeredEmb   by remember { mutableStateOf<FloatArray?>(null) }

    val stepState       = remember { mutableStateOf(LivenessStep.DETECT_FACE) }
    var livenessStep    by stepState

    val eyePhaseState     = remember { mutableIntStateOf(0) }
    var enrollmentEmbedding by remember { mutableStateOf<FloatArray?>(null) }
    val cameraWorker = remember { Executors.newSingleThreadExecutor() }
    var cameraAnalysis by remember { mutableStateOf<ImageAnalysis?>(null) }
    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }
    var unlockAnalyzer by remember { mutableStateOf<DualAiAnalyzer?>(null) }
    var registrationAnalyzer by remember { mutableStateOf<LivenessAnalyzer?>(null) }
    val disposed = remember { java.util.concurrent.atomic.AtomicBoolean(false) }
    val bluetoothService = remember { BluetoothService(context) }

    val arcProgress by animateFloatAsState(
        targetValue  = livenessStep.progress,
        animationSpec = tween(600),
        label = "liveness_arc"
    )

    fun loadModel(name: String): Interpreter? = try {
        val afd = context.assets.openFd(name)
        val buf = FileInputStream(afd.fileDescriptor).channel
            .map(FileChannel.MapMode.READ_ONLY, afd.startOffset, afd.declaredLength)
        Interpreter(buf, Interpreter.Options().apply { setNumThreads(4) })
    } catch (e: Exception) { null }

    val faceNetInterp = remember { loadModel("mobilefacenet.tflite") }
    val helmetInterp  = remember { loadModel("helmet.tflite") }

    DisposableEffect(Unit) { onDispose {
        disposed.set(true)
        cameraAnalysis?.clearAnalyzer()
        cameraAnalysis?.let { cameraProvider?.unbind(it) }
        unlockAnalyzer?.stop()
        registrationAnalyzer?.close()
        bluetoothService.disconnect()
        cameraWorker.execute {
            unlockAnalyzer?.close()
            faceNetInterp?.close()
            helmetInterp?.close()
        }
        cameraWorker.shutdown()
    } }

    LaunchedEffect(Unit) {
        try {
            val authUser = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
            if (authUser == null) {
                cameraMode = CameraMode.REGISTRATION
                statusText = LivenessStep.DETECT_FACE.title
                return@LaunchedEffect
            }

            var profile = SupabaseClientManager.client.postgrest["users"]
                .select { filter { eq("id", authUser.id) } }
                .decodeSingleOrNull<JsonObject>()

            if (profile == null && !authUser.email.isNullOrBlank()) {
                profile = SupabaseClientManager.client.postgrest["users"]
                    .select { filter { eq("email", authUser.email!!) } }.decodeSingleOrNull<JsonObject>()
            }
            val faceDescElement = profile?.get("face_descriptor")
            registeredEmb = runCatching { FaceData.decode(faceDescElement) }.getOrNull()
            if (registeredEmb != null) {
                if (onRegistrationSuccess != null) {
                    delay(300)
                    onRegistrationSuccess()
                    return@LaunchedEffect
                } else {
                    cameraMode = CameraMode.UNLOCK
                    statusText = "Position your face in the frame"
                }
            } else {
                cameraMode = CameraMode.REGISTRATION
                livenessStep = LivenessStep.DETECT_FACE
                statusText = LivenessStep.DETECT_FACE.title
            }
        } catch (e: Exception) {
            if (e is kotlinx.coroutines.CancellationException) throw e
            e.printStackTrace()
            cameraMode = CameraMode.UNLOCK
            statusText = "Unable to load saved Face ID. Reopen the camera to retry."
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().background(bgBrush).padding(horizontal = 24.dp, vertical = 22.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(36.dp)
                .background(Color.White.copy(alpha = 0.88f), RoundedCornerShape(14.dp))
                .border(1.dp, lineCol, RoundedCornerShape(14.dp))
                .clickable { onBack() },
                contentAlignment = Alignment.Center) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, null, Modifier.size(20.dp), tint = motoBlack)
            }
            Spacer(Modifier.width(16.dp))
            Text(if (cameraMode == CameraMode.REGISTRATION) "Face Registration" else "Face Recognition",
                fontSize = 18.sp, fontWeight = FontWeight.Black, color = motoBlack)
        }

        Spacer(Modifier.height(30.dp))

        when {
            cameraMode == CameraMode.LOADING -> {
                Box(Modifier.fillMaxSize(), Alignment.Center) {
                    CircularProgressIndicator(color = motoRed)
                }
            }
            !hasCameraPermission -> {
                Box(Modifier.fillMaxSize(), Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Camera permission required.", color = motoRed, fontWeight = FontWeight.Bold)
                        Spacer(Modifier.height(12.dp))
                        Button(onClick = { permLauncher.launch(Manifest.permission.CAMERA) },
                            colors = ButtonDefaults.buttonColors(containerColor = motoRed)) {
                            Text("Grant Permission", color = Color.White)
                        }
                    }
                }
            }
            else -> {
                Column(
                    Modifier.fillMaxWidth().weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    // ALL TEXT IS AT THE TOP NOW (Clean UI)
                    Text(
                        text = statusText,
                        fontSize = 20.sp, fontWeight = FontWeight.Black,
                        color = when {
                            isSuccess -> motoGreen
                            statusText.contains("Failed") || statusText.contains("Multiple") || statusText.contains("No face") -> motoRed
                            else -> motoBlack
                        },
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(horizontal = 8.dp)
                    )

                    Spacer(Modifier.height(24.dp))

                    val arcColor = if (isSuccess) motoGreen else if (livenessStep == LivenessStep.FAILED) motoRed else progressColor
                    val strokeDp = 12.dp

                    Box(Modifier.size(320.dp), contentAlignment = Alignment.Center) {
                        Canvas(Modifier.fillMaxSize()) {
                            val pad = strokeDp.toPx() / 2f
                            drawArc(
                                color = Color(0xFFE2E8F0),
                                startAngle = -90f, sweepAngle = 360f, useCenter = false,
                                topLeft = Offset(pad, pad), size = Size(size.width - pad * 2, size.height - pad * 2),
                                style = Stroke(strokeDp.toPx(), cap = StrokeCap.Round)
                            )
                        }
                        Canvas(Modifier.fillMaxSize()) {
                            if (arcProgress > 0f) {
                                val pad = strokeDp.toPx() / 2f
                                drawArc(
                                    color = arcColor,
                                    startAngle = -90f, sweepAngle = arcProgress * 360f, useCenter = false,
                                    topLeft = Offset(pad, pad), size = Size(size.width - pad * 2, size.height - pad * 2),
                                    style = Stroke(strokeDp.toPx(), cap = StrokeCap.Round)
                                )
                            }
                        }
                        Box(Modifier.size(288.dp).clip(CircleShape).shadow(24.dp, CircleShape, spotColor = arcColor.copy(alpha = 0.15f))) {
                            AndroidView(
                                factory = { ctx ->
                                    val pv = PreviewView(ctx)
                                    val cpf = ProcessCameraProvider.getInstance(ctx)
                                    val ex = cameraWorker

                                    cpf.addListener({
                                        if (disposed.get()) return@addListener
                                        val cp = cpf.get()
                                        cameraProvider = cp
                                        val preview = Preview.Builder().build().also { it.setSurfaceProvider(pv.surfaceProvider) }
                                        val ia = ImageAnalysis.Builder()
                                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()

                                        cameraAnalysis = ia
                                        when (cameraMode) {
                                            CameraMode.REGISTRATION -> {
                                                val analyzer = LivenessAnalyzer(faceNetInterp) { frame ->
                                                    // Auto-reset state if failed (continuous flow, no buttons)
                                                    if (stepState.value in listOf(LivenessStep.FAILED, LivenessStep.PROCESSING, LivenessStep.SUCCESS)) return@LivenessAnalyzer
                                                    
                                                    if (frame.faceCount > 1) {
                                                        statusText = "Multiple faces detected!"
                                                        enrollmentEmbedding = null
                                                        livenessStep = LivenessStep.DETECT_FACE
                                                        eyePhaseState.intValue = 0
                                                        return@LivenessAnalyzer
                                                    }
                                                    if (frame.faceCount == 0) {
                                                        statusText = "No face detected"
                                                        enrollmentEmbedding = null
                                                        livenessStep = LivenessStep.DETECT_FACE
                                                        eyePhaseState.intValue = 0
                                                        return@LivenessAnalyzer
                                                    }

                                                    if (statusText == "No face detected" || statusText.startsWith("Multiple")) {
                                                        statusText = stepState.value.title
                                                    }

                                                    when (stepState.value) {
                                                        LivenessStep.DETECT_FACE -> {
                                                            livenessStep = LivenessStep.BLINK
                                                            statusText = LivenessStep.BLINK.title
                                                            eyePhaseState.intValue = 0
                                                        }

                                                        LivenessStep.BLINK -> {
                                                            if (abs(frame.eulerY) > 15f) {
                                                                statusText = "Look straight ahead to blink"
                                                                eyePhaseState.intValue = 0
                                                                return@LivenessAnalyzer
                                                            }

                                                            val L = frame.leftEyeOpen
                                                            val R = frame.rightEyeOpen
                                                            
                                                            // FULL BLINK CYCLE: OPEN -> CLOSED -> OPEN
                                                            val closed = L < 0.35f && R < 0.35f
                                                            val open   = L > 0.85f && R > 0.85f

                                                            when (eyePhaseState.intValue) {
                                                                0 -> { // Wait for eyes to be OPEN
                                                                    if (open) {
                                                                        eyePhaseState.intValue = 1
                                                                        statusText = "Eyes open - now blink!"
                                                                    }
                                                                }
                                                                1 -> { // Wait for eyes to CLOSE
                                                                    if (closed) {
                                                                        eyePhaseState.intValue = 2
                                                                        statusText = "Blink"
                                                                    }
                                                                }
                                                                2 -> { // Wait for eyes to OPEN AGAIN (prevents false passes)
                                                                    if (open) {
                                                                        // Capture once after the blink; no extra hold step or inference during blinking.
                                                                        enrollmentEmbedding = frame.captureFace?.invoke()
                                                                        if (enrollmentEmbedding == null) {
                                                                            statusText = "Could not capture face. Face the camera and blink again."
                                                                            eyePhaseState.intValue = 0
                                                                            return@LivenessAnalyzer
                                                                        }
                                                                        livenessStep = LivenessStep.TURN_LEFT
                                                                        statusText = LivenessStep.TURN_LEFT.title
                                                                    }
                                                                }
                                                            }
                                                        }

                                                        LivenessStep.TURN_LEFT -> {
                                                            if (frame.eulerY > 15f) {
                                                                statusText = "Good! Now turn right"
                                                                livenessStep = LivenessStep.TURN_RIGHT
                                                                statusText = LivenessStep.TURN_RIGHT.title
                                                            } else {
                                                                statusText = "Turn to your left"
                                                            }
                                                        }

                                                        LivenessStep.TURN_RIGHT -> {
                                                            if (frame.eulerY < -15f) {
                                                                livenessStep = LivenessStep.PROCESSING
                                                                statusText = "Saving face registration..."
                                                                coroutineScope.launch {
                                                                    saveRegisteredFace(enrollmentEmbedding) { ok, err ->
                                                                        if (ok) {
                                                                            isSuccess = true
                                                                            livenessStep = LivenessStep.SUCCESS
                                                                            statusText = "Registration complete!"
                                                                            coroutineScope.launch {
                                                                                delay(1500)
                                                                                onRegistrationSuccess?.invoke() ?: onBack()
                                                                            }
                                                                        } else {
                                                                            livenessStep = LivenessStep.FAILED
                                                                            statusText = "Failed: $err"
                                                                            // Auto retry after 2.5 seconds (Continuous flow)
                                                                            coroutineScope.launch {
                                                                                delay(2500)
                                                                                isSuccess = false
                                                                                eyePhaseState.intValue = 0
                                                                                livenessStep = LivenessStep.DETECT_FACE
                                                                                statusText = LivenessStep.DETECT_FACE.title
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            } else {
                                                                statusText = "Turn to your right"
                                                            }
                                                        }
                                                        else -> {}
                                                    }
                                                }
                                                registrationAnalyzer = analyzer
                                                ia.setAnalyzer(ex, analyzer)
                                            }

                                            CameraMode.UNLOCK -> {
                                                val telemetryManager = com.example.motolock.data.RealHelmetTelemetryManager(context)
                                                val analyzer = DualAiAnalyzer(
                                                    faceNetInterp, 
                                                    helmetInterp, 
                                                    registeredEmb,
                                                    telemetryManager = telemetryManager,
                                                    pairedHelmetDeviceId = null,
                                                    pairedHelmetVisualId = null,
                                                    helmetPublicKey = null,
                                                    logoIdentityDetector = com.example.motolock.data.IntegratedLogoDetector()
                                                ) { ok, msg ->
                                                    // Re-evaluate continuously; a camera pass never sends hardware commands.
                                                    isSuccess = ok
                                                    statusText = msg
                                                }
                                                unlockAnalyzer = analyzer
                                                ia.setAnalyzer(ex, analyzer)
                                            }
                                            else -> {}
                                        }

                                        try {
                                            cp.unbindAll()
                                            cp.bindToLifecycle(lifecycleOwner, CameraSelector.DEFAULT_FRONT_CAMERA, preview, ia)
                                        } catch (_: Exception) {}

                                    }, ContextCompat.getMainExecutor(ctx))
                                    pv
                                },
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                    }

                    // Dots progress indicator below
                    if (cameraMode == CameraMode.REGISTRATION && livenessStep != LivenessStep.SUCCESS && livenessStep != LivenessStep.FAILED) {
                        Spacer(Modifier.height(20.dp))
                        val steps = listOf(LivenessStep.DETECT_FACE, LivenessStep.BLINK, LivenessStep.TURN_LEFT, LivenessStep.TURN_RIGHT)
                        val cur   = steps.indexOfFirst { it == livenessStep }.coerceAtLeast(0)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            steps.forEachIndexed { i, _ ->
                                Box(Modifier.size(if (i == cur) 10.dp else 8.dp)
                                    .background(when { i < cur -> progressColor; i == cur -> motoGreen; else -> Color(0xFFD1D5DB) }, CircleShape))
                            }
                        }
                    }
                }
            }
        }
    }
}

// ────────────────────────────────────────────────────────────

class LivenessAnalyzer(
    private val faceModel: Interpreter?,
    private val onFrame: (FaceFrame) -> Unit
) : ImageAnalysis.Analyzer, AutoCloseable {

    private val opts = com.google.mlkit.vision.face.FaceDetectorOptions.Builder()
        .setPerformanceMode(com.google.mlkit.vision.face.FaceDetectorOptions.PERFORMANCE_MODE_FAST)
        .setLandmarkMode(com.google.mlkit.vision.face.FaceDetectorOptions.LANDMARK_MODE_ALL)
        .setClassificationMode(com.google.mlkit.vision.face.FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
        .build()

    private val detector = com.google.mlkit.vision.face.FaceDetection.getClient(opts)
    private var isProcessing = false
    @Volatile private var stopped = false
    override fun close() { stopped = true; detector.close() }

    @android.annotation.SuppressLint("UnsafeOptInUsageError")
    override fun analyze(proxy: ImageProxy) {
        if (stopped || isProcessing) { proxy.close(); return }
        val mi = proxy.image; if (mi == null) { proxy.close(); return }

        isProcessing = true
        val img = com.google.mlkit.vision.common.InputImage.fromMediaImage(mi, proxy.imageInfo.rotationDegrees)
        detector.process(img)
            .addOnSuccessListener { faces ->
                if (stopped) { isProcessing = false; proxy.close(); return@addOnSuccessListener }
                when {
                    faces.isEmpty() -> onFrame(FaceFrame(0, 0f, 0f, 1f, 1f))
                    faces.size > 1  -> onFrame(FaceFrame(faces.size, 0f, 0f, 1f, 1f))
                    else -> {
                        val f = faces[0]
                        onFrame(FaceFrame(
                            faceCount    = 1,
                            eulerY       = f.headEulerAngleY,
                            eulerZ       = f.headEulerAngleZ,
                            leftEyeOpen  = f.leftEyeOpenProbability  ?: 1f,
                            rightEyeOpen = f.rightEyeOpenProbability ?: 1f,
                            captureFace = {
                                runCatching {
                                    val model = requireNotNull(faceModel) { "Face model not loaded" }
                                    val bitmap = FaceData.uprightBitmap(proxy)
                                    try { FaceData.embed(bitmap, f.boundingBox, model) } finally { bitmap.recycle() }
                                }.getOrNull()
                            }
                        ))
                    }
                }
                isProcessing = false
                proxy.close()
            }
            .addOnFailureListener {
                isProcessing = false
                proxy.close() 
            }
    }
}

// ────────────────────────────────────────────────────────────

private suspend fun saveRegisteredFace(embedding: FloatArray?, onComplete: (Boolean, String?) -> Unit) {
    try {
        val authUser = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
            ?: run { onComplete(false, "No active session"); return }
        
        val uid = authUser.id
        val email = authUser.email ?: ""
        
        val emb = FaceData.normalize(requireNotNull(embedding) { "No face captured. Try again." })
        val json = JsonArray(emb.map { JsonPrimitive(it) })
        
        // 1. First, attempt to update by auth UID
        val res = SupabaseClientManager.client.postgrest["users"].update({ 
            set("face_descriptor", json)
        }) { 
            filter { eq("id", uid) } 
            select() // MUST select to return updated rows
        }
        
        if (res.data == "[]") {
            // 2. If no rows updated (ID mismatch or missing), attempt to update by email
            val resEmail = SupabaseClientManager.client.postgrest["users"].update({ 
                set("face_descriptor", json)
            }) { 
                filter { eq("email", email) } 
                select()
            }
            
            if (resEmail.data == "[]") {
                // 3. If STILL missing, UPSERT a new user record so the setup router can find it
                val newUser = com.example.motolock.models.User(
                    id = uid,
                    name = authUser.userMetadata?.get("full_name")?.toString() ?: "Rider",
                    email = email,
                    faceDescriptor = json
                )
                val insertRes = SupabaseClientManager.client.postgrest["users"].insert(newUser) {
                    select()
                }
                if (insertRes.data == "[]") {
                     throw Exception("Failed to insert new user record. RLS policy blocking?")
                }
            }
        }
        
        // Double check verification to absolutely guarantee it persisted
        val verifyById = SupabaseClientManager.client.postgrest["users"]
            .select { filter { eq("id", uid) } }
            .decodeSingleOrNull<com.example.motolock.models.User>()
            
        val verifyByEmail = SupabaseClientManager.client.postgrest["users"]
            .select { filter { eq("email", email) } }
            .decodeList<com.example.motolock.models.User>().firstOrNull()
            
        val saved = FaceData.decode((verifyById ?: verifyByEmail)?.faceDescriptor)
        check(saved.indices.all { kotlin.math.abs(saved[it] - emb[it]) < 0.0001f }) {
            "Saved Face ID did not match the captured face. Please retry."
        }
        
        onComplete(true, null)
    } catch (e: Exception) {
        e.printStackTrace()
        android.util.Log.e("CameraScreen", "DB save failed: ${e.message}")
        onComplete(false, e.localizedMessage)
    }
}




