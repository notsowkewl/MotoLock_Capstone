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

import com.example.motolock.data.*

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
    val rightEyeOpen: Float
)

// ────────────────────────────────────────────────────────────

@Composable
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
        if (!sample.faceMatches || !VerificationPolicy.fresh(android.os.SystemClock.elapsedRealtime(), sample.capturedAt)) {
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
        if (sample.embedding == null) { statusText = sample.message; return }
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
                            if (!saving && (cameraMode == CameraMode.REGISTRATION && !isSuccess || cameraMode == CameraMode.UNLOCK && registeredEmb != null)) {
                                VerificationCamera(registeredEmb, cameraMode == CameraMode.UNLOCK,
                                    cameraMode == CameraMode.REGISTRATION, generation, Modifier.fillMaxSize(),
                                    onSample = { sample -> handleSample(sample) },
                                    onError = { statusText = it; livenessStep = LivenessStep.FAILED })
                            }
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
