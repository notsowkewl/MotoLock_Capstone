package com.example.motolock

import android.Manifest
import android.content.pm.PackageManager
import android.os.SystemClock
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.example.motolock.data.*
import kotlinx.coroutines.*

@Composable
fun UnlockScreen(onComplete:()->Unit,onBack:()->Unit,onPairDevice:()->Unit={}) {
    val context=LocalContext.current; val lifecycle=LocalLifecycleOwner.current.lifecycle
    val check=remember {CameraCheck()}
    var profile by remember {mutableStateOf<FloatArray?>(null)}
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
                lastProfileRead=SystemClock.elapsedRealtime(); databaseError=null
            } catch(e:CancellationException) {
                if(e !is TimeoutCancellationException) throw e
                profile=null; databaseError="Database check timed out. Reconnect and retry."; check.reset(databaseError!!); publish()
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
        CameraScreen(onBack={enrollment=false},onRegistrationSuccess={enrollment=false; profile=null; refresh++})
        return
    }
    Column(Modifier.fillMaxSize().padding(24.dp),verticalArrangement=Arrangement.spacedBy(12.dp)) {
        TextButton(onClick=onBack) {Text("Back")}
        Text("Face and helmet check",style=MaterialTheme.typography.headlineSmall)
        Text("Camera testing only • No hardware required")
        Text(databaseError ?: cameraError ?: message,
            color=if(matched && databaseError==null && cameraError==null) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface)
        if(allowed && foreground && profile!=null && databaseError==null && cameraError==null) {
            VerificationCamera(profile,true,false,generation,Modifier.fillMaxWidth().weight(1f),onSample={sample->
                if(lastProfileRead==0L || SystemClock.elapsedRealtime()-lastProfileRead>15000) check.reset("Waiting for a fresh database check")
                else check.observe(SystemClock.elapsedRealtime(),sample.capturedAt,sample.faceMatches,sample.helmetOnHead,sample.message,sample.helmetLabelsVerified)
                publish()
            },onError={cameraError=it; check.reset(it); publish()})
            Text("Keep your whole helmet and face visible. Helmet predictions are provisional while the model is being validated.",style=MaterialTheme.typography.bodySmall)
        }
        if(!allowed) Button(onClick={request.launch(Manifest.permission.CAMERA)}) {Text("Allow camera")}
        if(databaseError!=null || cameraError!=null) TextButton(onClick={cameraError=null; refresh++; generation++}) {Text("Retry")}
        TextButton(onClick={enrollment=true; check.reset("Registering face"); publish()}) {Text("Register / update Face ID")}
        TextButton(onClick=onComplete) {Text("Finish camera test")}
    }
}
