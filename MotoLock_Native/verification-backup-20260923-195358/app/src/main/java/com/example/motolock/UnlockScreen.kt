package com.example.motolock

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
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
    SUCCESS
}

@Composable
fun UnlockScreen(onComplete: () -> Unit, onBack: () -> Unit, onPairDevice: () -> Unit = {}) {
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
    var statusMessage by remember { mutableStateOf("Connecting to MotoLock hardware...") }
    var bluetoothService by remember { mutableStateOf<BluetoothService?>(null) }
    
    // AI State
    var faceNetInterpreter by remember { mutableStateOf<Interpreter?>(null) }
    var helmetInterpreter by remember { mutableStateOf<Interpreter?>(null) }
    var registeredEmbedding by remember { mutableStateOf<FloatArray?>(null) }

    // Flags for Stage 2 (Face + Helmet + IR)
    var isFaceAndHelmetDetected by remember { mutableStateOf(false) }
    var isIrSensorPositive by remember { mutableStateOf(false) }
    
    // Sync Challenge Timestamps
    var irHelmetOnTime by remember { mutableStateOf(0L) }
    var camHelmetOnTime by remember { mutableStateOf(0L) }

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
                var profile = SupabaseClientManager.client.postgrest["users"]
                    .select { filter { eq("id", authUser.id) } }.decodeSingleOrNull<User>()
                if (profile == null && authUser.email != null) {
                    profile = SupabaseClientManager.client.postgrest["users"]
                        .select { filter { eq("email", authUser.email!!) } }.decodeList<User>().firstOrNull()
                }
                
                val faceDesc = profile?.faceDescriptor
                if (faceDesc is JsonArray) {
                    registeredEmbedding = FloatArray(faceDesc.size) { i ->
                        (faceDesc[i] as JsonPrimitive).content.toFloat()
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            statusMessage = "Error loading AI models: ${e.message}"
        }
    }

    // [TEMP] Bluetooth bypassed for camera testing
    LaunchedEffect(Unit) {
        isConnectionFailed = false
        statusMessage = "Position your face and wear your helmet."
        currentStep = UnlockStep.FACE_HELMET_CHECK
        // Mock IR sensor being positive so camera tests can proceed
        isIrSensorPositive = true
    }

    // Request camera permission if not granted
    LaunchedEffect(hasCameraPermission) {
        if (!hasCameraPermission) {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }
    
    DisposableEffect(Unit) {
        onDispose {
            bluetoothService?.disconnect()
            faceNetInterpreter?.close()
            helmetInterpreter?.close()
        }
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
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            StepIndicator(step = 1, current = currentStep.ordinal + 1, label = "Connect", icon = Icons.Default.BluetoothSearching)
            StepIndicator(step = 2, current = currentStep.ordinal + 1, label = "Face/Helmet", icon = Icons.Default.CameraAlt)
            StepIndicator(step = 3, current = currentStep.ordinal + 1, label = "Alcohol", icon = Icons.Default.LocalDrink)
        }

        Spacer(modifier = Modifier.height(30.dp))
        
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f)
                .clip(RoundedCornerShape(24.dp))
                .background(Color.Black),
            contentAlignment = Alignment.Center
        ) {
            if ((currentStep == UnlockStep.FACE_HELMET_CHECK || currentStep == UnlockStep.ALCOHOL_CHECK) && hasCameraPermission) {
                // Camera View
                val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }
                AndroidView(
                    factory = { ctx ->
                        val previewView = PreviewView(ctx)
                        val executor = ContextCompat.getMainExecutor(ctx)
                        cameraProviderFuture.addListener({
                            val cameraProvider = cameraProviderFuture.get()
                            val preview = Preview.Builder().build().also {
                                it.setSurfaceProvider(previewView.surfaceProvider)
                            }
                            
                            val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA

                            val imageAnalyzer = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .build()
                                .also {
                                    it.setAnalyzer(Executors.newSingleThreadExecutor(), DualAiAnalyzer(
                                        faceNetInterpreter,
                                        helmetInterpreter,
                                        registeredEmbedding
                                    ) { success, msg ->
                                        coroutineScope.launch {
                                            isFaceAndHelmetDetected = success
                                            if (currentStep == UnlockStep.FACE_HELMET_CHECK || currentStep == UnlockStep.ALCOHOL_CHECK) {
                                                if (!success) {
                                                    // If they take off the helmet during alcohol test, revert to step 1
                                                    if (currentStep == UnlockStep.ALCOHOL_CHECK) {
                                                        currentStep = UnlockStep.FACE_HELMET_CHECK
                                                    }
                                                    statusMessage = msg // e.g. "Wear the helmet"
                                                } else if (currentStep == UnlockStep.FACE_HELMET_CHECK) {
                                                    statusMessage = if (isIrSensorPositive) {
                                                        "Face & Helmet verified!"
                                                    } else {
                                                        "Helmet detected visually. Waiting for hardware IR sensor..."
                                                    }
                                                    
                                                    if (isIrSensorPositive) {
                                                        currentStep = UnlockStep.ALCOHOL_CHECK
                                                        statusMessage = "Lower chin bar and blow for alcohol test"
                                                    }
                                                }
                                            }
                                        }
                                    })
                                }

                            try {
                                cameraProvider.unbindAll()
                                cameraProvider.bindToLifecycle(lifecycleOwner, cameraSelector, preview, imageAnalyzer)
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }, executor)
                        previewView
                    },
                    modifier = Modifier.fillMaxSize()
                )
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
            } else if (currentStep == UnlockStep.ALCOHOL_CHECK) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.LocalDrink, contentDescription = null, tint = Color.White, modifier = Modifier.size(64.dp))
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Waiting for alcohol sensor...", color = Color.White, fontSize = 16.sp)
                    Spacer(modifier = Modifier.height(8.dp))
                    CircularProgressIndicator(color = motoRed, modifier = Modifier.size(24.dp), strokeWidth = 2.dp)
                }
            } else if (currentStep == UnlockStep.SUCCESS) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF10B981), modifier = Modifier.size(64.dp))
                    Spacer(modifier = Modifier.height(16.dp))
                    Text("Unlocked", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Status Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp))
                .background(Color(0xFFF8FAFC))
                .border(1.dp, lineCol, RoundedCornerShape(16.dp))
                .padding(20.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                statusMessage,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = motoBlack,
                textAlign = TextAlign.Center
            )
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