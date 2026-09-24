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
import android.os.SystemClock
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.example.motolock.data.*
import kotlinx.coroutines.*

private enum class UnlockStep {
    CONNECTING,
    FACE_HELMET_CHECK,
    ALCOHOL_CHECK,
    SUCCESS
}

@Composable
fun UnlockScreen(onComplete:()->Unit,onBack:()->Unit,onPairDevice:()->Unit={}) {
    val context=LocalContext.current; val lifecycle=LocalLifecycleOwner.current.lifecycle
    val check=remember {CameraCheck()}
    var profile by remember {mutableStateOf<FloatArray?>(null)}
    var needsRegistration by remember {mutableStateOf(false)}
    var databaseError by remember {mutableStateOf<String?>(null)}
    var cameraError by remember {mutableStateOf<String?>(null)}
    var lastProfileRead by remember {mutableLongStateOf(0L)}
    var message by remember {mutableStateOf("Loading your saved Face ID...")}
    var matched by remember {mutableStateOf(false)}
    var generation by remember {mutableIntStateOf(0)}
    var enrollment by remember {mutableStateOf(false)}
    var refresh by remember {mutableIntStateOf(0)}
    var foreground by remember {mutableStateOf(lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))}
    var allowed by remember {mutableStateOf(ContextCompat.checkSelfPermission(context,Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)}
    val request=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {allowed=it}
    fun publish() {message=check.message; matched=check.verified}
    LaunchedEffect(Unit) {if(!allowed) request.launch(Manifest.permission.CAMERA)}
    // Reload on every opening/resume and periodically. Never silently use an offline/obsolete profile.
    LaunchedEffect(foreground,enrollment,refresh) {
        if(!foreground || enrollment) return@LaunchedEffect
        while(isActive) {
            try {
                val saved=FaceProfiles.load()
                if(profile?.contentEquals(saved)!=true) {
                    profile=saved; generation++; check.reset("Face ID loaded. Look at the camera."); publish()
                }
                lastProfileRead=SystemClock.elapsedRealtime(); databaseError=null; needsRegistration=false
            } catch(e:CancellationException) {
                if(e !is TimeoutCancellationException) throw e
                profile=null; databaseError="Database check timed out. Reconnect and retry."; check.reset(databaseError!!); publish()
            } catch(e:FaceProfileRequiredException) {
                profile=null; needsRegistration=true; enrollment=true
                check.reset(e.message ?: "Register your face"); publish()
            } catch(e:Exception) {
                profile=null; databaseError=e.message ?: "Cannot read your saved Face ID"; check.reset(databaseError!!); publish()
            }
            delay(5000)
        }
    }
    LaunchedEffect(Unit) {
        while(isActive) {
            delay(250); check.tick(SystemClock.elapsedRealtime())
            if(lastProfileRead>0 && SystemClock.elapsedRealtime()-lastProfileRead>15000) {
                check.reset("Waiting for a fresh database check")
            }
            if(databaseError==null && cameraError==null && profile!=null) publish()
        }
    }
    DisposableEffect(lifecycle) {
        val observer=LifecycleEventObserver {_,event->
            if(event==Lifecycle.Event.ON_RESUME) foreground=true
            if(event==Lifecycle.Event.ON_PAUSE || event==Lifecycle.Event.ON_STOP) {
                foreground=false; profile=null; lastProfileRead=0; generation++
                check.reset("Camera paused. Look at the camera again."); publish()
            }
        }
        lifecycle.addObserver(observer)
        onDispose {lifecycle.removeObserver(observer)}
    }
    if(enrollment) {
        CameraScreen(onBack=onBack,onRegistrationSuccess={enrollment=false; needsRegistration=false; profile=null; refresh++})
        return
    }
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val bgBrush = Brush.linearGradient(listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF)))
    val currentStep = UnlockStep.FACE_HELMET_CHECK
    val hasCameraPermission = allowed
    val isConnectionFailed = false
    val statusMessage = databaseError ?: cameraError ?: message
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
                if (foreground && profile != null && databaseError == null && cameraError == null) {
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