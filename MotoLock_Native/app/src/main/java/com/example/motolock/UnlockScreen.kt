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
    // old launcher removed

    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val textGray = Color(0xFF737987)

    val bgBrush = Brush.linearGradient(
        colors = listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF))
    )

    var currentStep by remember { mutableStateOf(UnlockStep.CONNECTING) }
    var isConnectionFailed by remember { mutableStateOf(false) }
    var statusMessage by remember { mutableStateOf("Loading saved Face ID...") }
    var bluetoothService by remember { mutableStateOf<BluetoothService?>(null) }
    
    // AI State
    var faceNetInterpreter by remember { mutableStateOf<Interpreter?>(null) }
    var helmetInterpreter by remember { mutableStateOf<Interpreter?>(null) }
    var registeredEmbedding by remember { mutableStateOf<FloatArray?>(null) }

    var aiReady by remember { mutableStateOf(false) }
    val cameraWorker = remember { Executors.newSingleThreadExecutor() }
    var cameraAnalysis by remember { mutableStateOf<ImageAnalysis?>(null) }
    var cameraProvider by remember { mutableStateOf<ProcessCameraProvider?>(null) }
    var activeAnalyzer by remember { mutableStateOf<DualAiAnalyzer?>(null) }
    val disposed = remember { java.util.concurrent.atomic.AtomicBoolean(false) }

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
                val profile = SupabaseClientManager.client.postgrest["users"]
                    .select { filter { eq("id", authUser.id) } }.decodeSingleOrNull<User>()
                
                val faceDesc = profile?.faceDescriptor
                registeredEmbedding = FaceData.decode(faceDesc)
            } else error("Sign in to load your Face ID")
            aiReady = true
            statusMessage = "Position your face in the camera."
        } catch (e: Exception) {
            if (e is kotlinx.coroutines.CancellationException) throw e
            e.printStackTrace()
            statusMessage = e.message ?: "Unable to load your saved Face ID"
        }
    }

    // Handle Multiple Permissions (Camera + Bluetooth)
    val permissionsToRequest = mutableListOf(Manifest.permission.CAMERA)
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
        permissionsToRequest.add(Manifest.permission.BLUETOOTH_CONNECT)
        permissionsToRequest.add(Manifest.permission.BLUETOOTH_SCAN)
    } else {
        permissionsToRequest.add(Manifest.permission.ACCESS_FINE_LOCATION)
    }

    val permissionsLauncher = rememberLauncherForActivityResult(
        androidx.activity.result.contract.ActivityResultContracts.RequestMultiplePermissions()
    ) { perms -> 
        hasCameraPermission = perms[Manifest.permission.CAMERA] ?: false
        // Assuming BT permissions if camera is granted for simplicity, but real app checks each
    }

    // Connect to actual Bluetooth Hardware
    LaunchedEffect(hasCameraPermission, currentStep) {
        if (!hasCameraPermission) {
            permissionsLauncher.launch(permissionsToRequest.toTypedArray())
            return@LaunchedEffect
        }

        if (currentStep != UnlockStep.CONNECTING) return@LaunchedEffect

        isConnectionFailed = false
        currentStep = UnlockStep.CONNECTING
        statusMessage = "Connecting to MotoLock..."

        val sharedPrefs = context.getSharedPreferences("MotoLockPrefs", android.content.Context.MODE_PRIVATE)
        val macAddress = sharedPrefs.getString("esp32_mac", null)
        
        if (macAddress != null) {
            val btService = BluetoothService(context)
            val success = btService.connectToDevice(macAddress)
            if (success) {
                SessionState.activeBluetoothService = btService
                bluetoothService = btService
                currentStep = UnlockStep.FACE_HELMET_CHECK
                statusMessage = "Connected. Position your face in the camera."
            } else {
                isConnectionFailed = true
                statusMessage = "Failed to connect. Is the helmet powered on?"
            }
        } else {
            isConnectionFailed = true
            statusMessage = "No helmet paired. Please pair your MotoLock device."
        }
    }
    
    DisposableEffect(Unit) {
        onDispose {
            disposed.set(true)
            cameraAnalysis?.clearAnalyzer()
            cameraAnalysis?.let { cameraProvider?.unbind(it) }
            activeAnalyzer?.stop()
            bluetoothService?.disconnect()
            cameraWorker.execute {
                activeAnalyzer?.close()
                faceNetInterpreter?.close()
                helmetInterpreter?.close()
            }
            cameraWorker.shutdown()
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
            if (currentStep == UnlockStep.FACE_HELMET_CHECK && hasCameraPermission && aiReady) {
                // Camera View
                val cameraProviderFuture = remember { ProcessCameraProvider.getInstance(context) }
                AndroidView(
                    factory = { ctx ->
                        val previewView = PreviewView(ctx)
                        val executor = ContextCompat.getMainExecutor(ctx)
                        cameraProviderFuture.addListener({
                            if (disposed.get()) return@addListener
                            val provider = cameraProviderFuture.get()
                            cameraProvider = provider
                            val preview = Preview.Builder().build().also {
                                it.setSurfaceProvider(previewView.surfaceProvider)
                            }
                            
                            val cameraSelector = CameraSelector.DEFAULT_FRONT_CAMERA

                            val imageAnalyzer = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .build()
                                .also {
                                    cameraAnalysis = it
                                    val telemetryManager = com.example.motolock.data.RealHelmetTelemetryManager(context)
                                    val sharedPrefs = context.getSharedPreferences("MotoLockPrefs", android.content.Context.MODE_PRIVATE)
                                    val pairedDeviceId = sharedPrefs.getString("esp32_mac", null)
                                    val pairedVisualId = sharedPrefs.getString("esp32_visual_id", "MOTO-3F1A9") // Default for testing
                                    val pubKeyString = sharedPrefs.getString("esp32_public_key", null)
                                    val publicKeyBytes = pubKeyString?.chunked(2)?.map { it.toInt(16).toByte() }?.toByteArray()

                                    val analyzer = DualAiAnalyzer(
                                        faceNetInterpreter, 
                                        helmetInterpreter, 
                                        registeredEmbedding,
                                        telemetryManager = telemetryManager,
                                        pairedHelmetDeviceId = pairedDeviceId,
                                        pairedHelmetVisualId = pairedVisualId,
                                        helmetPublicKey = publicKeyBytes ?: ByteArray(0), // Dummy array if null for now
                                        logoIdentityDetector = com.example.motolock.data.IntegratedLogoDetector()
                                    ) { success, msg ->
                                        isFaceAndHelmetDetected = success
                                        if (success) {
                                            // Bridge ML to Bluetooth
                                            coroutineScope.launch {
                                                val sharedPrefs = context.getSharedPreferences("MotoLockPrefs", android.content.Context.MODE_PRIVATE)
                                                val encSecret = sharedPrefs.getString("esp32_secret_enc", null)
                                                if (encSecret != null) {
                                                    try {
                                                        val secret = com.example.motolock.data.KeystoreHelper.decryptSecret(encSecret)
                                                        val btService = SessionState.activeBluetoothService
                                                        if (btService != null) {
                                                            val unlocked = btService.sendUnlockCommand(secret)
                                                            if (unlocked) {
                                                                statusMessage = "Motorcycle Unlocked!"
                                                                currentStep = UnlockStep.SUCCESS
                                                            } else {
                                                                statusMessage = "Bluetooth Auth Failed."
                                                            }
                                                        } else {
                                                            statusMessage = "Bluetooth Disconnected."
                                                        }
                                                    } catch (e: SecurityException) {
                                                        statusMessage = "Decryption failed. Please re-pair the device."
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
                                provider.bindToLifecycle(lifecycleOwner, cameraSelector, preview, imageAnalyzer)
                            } catch (e: Exception) {
                                e.printStackTrace()
                            }
                        }, executor)
                        previewView
                    },
                    modifier = Modifier.fillMaxSize()
                )
            } else if (currentStep == UnlockStep.CONNECTING) {
                val sharedPrefsCheck = context.getSharedPreferences("MotoLockPrefs", android.content.Context.MODE_PRIVATE)
                val hasPairedDevice = sharedPrefsCheck.getString("esp32_mac", null) != null
                androidx.compose.foundation.layout.Column(
                    horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally,
                    modifier = androidx.compose.ui.Modifier.padding(24.dp)
                ) {
                    if (!hasPairedDevice) {
                        // No device paired at all
                        androidx.compose.material3.Icon(
                            androidx.compose.material.icons.Icons.Default.BluetoothSearching,
                            contentDescription = null,
                            tint = androidx.compose.ui.graphics.Color(0xFFED1C24),
                            modifier = androidx.compose.ui.Modifier.size(56.dp)
                        )
                        androidx.compose.foundation.layout.Spacer(modifier = androidx.compose.ui.Modifier.height(16.dp))
                        androidx.compose.material3.Text(
                            "No Device Paired",
                            color = androidx.compose.ui.graphics.Color.White,
                            fontSize = 18.sp,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold
                        )
                        androidx.compose.foundation.layout.Spacer(modifier = androidx.compose.ui.Modifier.height(8.dp))
                        androidx.compose.material3.Text(
                            "You need to pair your MotoLock device first before unlocking.",
                            color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.7f),
                            fontSize = 13.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        androidx.compose.foundation.layout.Spacer(modifier = androidx.compose.ui.Modifier.height(24.dp))
                        androidx.compose.material3.Button(
                            onClick = { onPairDevice() },
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = androidx.compose.ui.graphics.Color(0xFFED1C24)),
                            modifier = androidx.compose.ui.Modifier.fillMaxWidth(0.8f)
                        ) {
                            androidx.compose.material3.Text("Pair Device Now", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                        }
                    } else if (isConnectionFailed) {
                        // Paired but can't reach it
                        androidx.compose.material3.Icon(
                            androidx.compose.material.icons.Icons.Default.BluetoothSearching,
                            contentDescription = null,
                            tint = androidx.compose.ui.graphics.Color.Gray,
                            modifier = androidx.compose.ui.Modifier.size(56.dp)
                        )
                        androidx.compose.foundation.layout.Spacer(modifier = androidx.compose.ui.Modifier.height(16.dp))
                        androidx.compose.material3.Text(
                            "Cannot Reach ESP32",
                            color = androidx.compose.ui.graphics.Color.White,
                            fontSize = 18.sp,
                            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold
                        )
                        androidx.compose.foundation.layout.Spacer(modifier = androidx.compose.ui.Modifier.height(8.dp))
                        androidx.compose.material3.Text(
                            "Make sure the helmet device is powered on and within Bluetooth range.",
                            color = androidx.compose.ui.graphics.Color.White.copy(alpha = 0.7f),
                            fontSize = 13.sp,
                            textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        androidx.compose.foundation.layout.Spacer(modifier = androidx.compose.ui.Modifier.height(24.dp))
                        androidx.compose.material3.Button(
                            onClick = {
                                isConnectionFailed = false
                                currentStep = UnlockStep.CONNECTING
                            },
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = androidx.compose.ui.graphics.Color(0xFFED1C24)),
                            modifier = androidx.compose.ui.Modifier.fillMaxWidth(0.8f)
                        ) {
                            androidx.compose.material3.Text("Retry", fontWeight = androidx.compose.ui.text.font.FontWeight.Bold)
                        }
                        androidx.compose.foundation.layout.Spacer(modifier = androidx.compose.ui.Modifier.height(12.dp))
                        androidx.compose.material3.TextButton(onClick = { onPairDevice() }) {
                            androidx.compose.material3.Text("Re-pair Device", color = androidx.compose.ui.graphics.Color(0xFFED1C24))
                        }
                    } else {
                        // Actively connecting
                        androidx.compose.material3.CircularProgressIndicator(color = androidx.compose.ui.graphics.Color(0xFFED1C24))
                        androidx.compose.foundation.layout.Spacer(modifier = androidx.compose.ui.Modifier.height(16.dp))
                        androidx.compose.material3.Text(
                            "Connecting to MotoLock...",
                            color = androidx.compose.ui.graphics.Color.White,
                            fontSize = 14.sp
                        )
                    }
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
