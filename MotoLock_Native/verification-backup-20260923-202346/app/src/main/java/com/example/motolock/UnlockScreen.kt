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
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.*
import kotlinx.coroutines.channels.Channel
import kotlinx.serialization.json.*
import java.util.UUID

@Composable
fun UnlockScreen(onComplete:()->Unit,onBack:()->Unit,onPairDevice:()->Unit={}) {
    val context=LocalContext.current; val lifecycle=LocalLifecycleOwner.current.lifecycle
    val service=remember {BluetoothService(context)}; val gate=remember {VerificationGate()}
    val commands=remember {Channel<String>(Channel.UNLIMITED)}
    var session by remember {mutableStateOf(UUID.randomUUID().toString())}
    var ready by remember {mutableStateOf(false)}; var fatal by remember {mutableStateOf<String?>(null)}
    var registered by remember {mutableStateOf<FloatArray?>(null)}
    var stage by remember {mutableStateOf(gate.stage)}; var message by remember {mutableStateOf("Loading face profile and connecting to hardware")}
    var generation by remember {mutableIntStateOf(0)}
    var enrollment by remember {mutableStateOf(false)}
    var foreground by remember {mutableStateOf(lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED))}
    var connected by remember {mutableStateOf(false)}
    var sessionRequestedAt by remember {mutableLongStateOf(0L)}
    val permissions=remember {buildList {add(Manifest.permission.CAMERA); if(android.os.Build.VERSION.SDK_INT>=31) add(Manifest.permission.BLUETOOTH_CONNECT)}}
    var allowed by remember {mutableStateOf(permissions.all {ContextCompat.checkSelfPermission(context,it)==PackageManager.PERMISSION_GRANTED})}
    val request=rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { allowed=permissions.all {p->it[p]==true} }
    fun publish() {stage=gate.stage; message=gate.message; generation=gate.resetGeneration}
    fun cancelIfNeeded() {
        if(gate.needsCancel) {
            commands.trySend("V2_CANCEL:$session")
            session=UUID.randomUUID().toString(); ready=false
            sessionRequestedAt=SystemClock.elapsedRealtime()
            commands.trySend("V2_BEGIN:$session"); gate.cancelSent()
        }
    }
    LaunchedEffect(allowed,enrollment) {
        if(!allowed) {request.launch(permissions.toTypedArray()); return@LaunchedEffect}
        if(enrollment) return@LaunchedEffect
        try {
            val user=SupabaseClientManager.client.auth.currentSessionOrNull()?.user ?: error("Sign in again")
            val profile=SupabaseClientManager.client.postgrest["users"].select {filter {eq("id",user.id)}}.decodeSingleOrNull<JsonObject>()
                ?: error("Rider profile not found")
            check(profile["status"]?.jsonPrimitive?.content?.lowercase()=="active") {"This rider account is not active"}
            var descriptor=profile["face_descriptor"] ?: error("Register your face first")
            if(descriptor is JsonPrimitive && descriptor.isString) descriptor=Json.parseToJsonElement(descriptor.content)
            registered=VerificationPolicy.normalize((descriptor as? JsonArray ?: error("Register your face again")).map {it.jsonPrimitive.float}.toFloatArray())
            val mac=context.getSharedPreferences("MotoLockPrefs",android.content.Context.MODE_PRIVATE).getString("esp32_mac",null)
                ?: error("Pair your MotoLock hardware first")
            SessionState.activeBluetoothService?.disconnect(); SessionState.activeBluetoothService=null
            check(service.connectToDevice(mac)) {"Cannot connect to paired MotoLock hardware"}
            connected=true; sessionRequestedAt=SystemClock.elapsedRealtime()
            commands.trySend("V2_BEGIN:$session")
            service.readDataStream().collect {line->
                val status=HardwareStatus.parse(line) ?: return@collect
                check(status.protocol==2) {"Receiver firmware needs verification protocol 2. See VERIFICATION.md."}
                if(status.session!=session) return@collect
                ready=true
                gate.hardware(SystemClock.elapsedRealtime(),status.worn,status.test,status.authorized,status.locked,status.sensorFresh)
                if(status.test=="RESULT_PASS" && gate.acceptPass(SystemClock.elapsedRealtime())) commands.trySend("V2_AUTHORIZE:$session")
                cancelIfNeeded(); publish()
            }
            error("Bluetooth connection ended")
        } catch(e:CancellationException) {throw e}
        catch(e:Exception) {fatal=e.message; gate.reset(e.message ?: "Verification failed"); cancelIfNeeded(); publish(); ready=false; connected=false}
    }
    LaunchedEffect(Unit) {
        for(command in commands) {
            try {
                val bound=command.substringAfter(':',"")
                val guarded=command.startsWith("V2_CHECK:") || command.startsWith("V2_AUTHORIZE:") || command.startsWith("V2_BREATH_START:")
                if(guarded && (bound!=session || !foreground || fatal!=null || !gate.valid(SystemClock.elapsedRealtime()))) continue
                service.sendCommand(command)
            } catch(e:CancellationException) {throw e}
            catch(e:Exception) {fatal="Hardware command failed: ${e.message}"; gate.reset(fatal!!); publish(); ready=false}
        }
    }
    LaunchedEffect(Unit) {
        while(isActive) {
            delay(250)
            gate.tick(SystemClock.elapsedRealtime())
            if(connected && !ready && SystemClock.elapsedRealtime()-sessionRequestedAt>7000) {
                fatal="No current verification session from receiver. Check its firmware and reconnect."
            }
            cancelIfNeeded()
            if(ready && foreground && fatal==null && gate.stage>=VerificationGate.Stage.ALCOHOL && gate.stage!=VerificationGate.Stage.STARTED && gate.valid(SystemClock.elapsedRealtime())) commands.trySend("V2_CHECK:$session")
            if(ready) publish()
        }
    }
    DisposableEffect(lifecycle) {
        val observer=LifecycleEventObserver {_,event->
            foreground=event==Lifecycle.Event.ON_RESUME || (event!=Lifecycle.Event.ON_PAUSE && event!=Lifecycle.Event.ON_STOP && foreground)
            if(event==Lifecycle.Event.ON_PAUSE || event==Lifecycle.Event.ON_STOP) {
                gate.reset("App paused. Verify again before starting."); cancelIfNeeded(); publish()
            }
        }
        lifecycle.addObserver(observer)
        onDispose {lifecycle.removeObserver(observer); service.disconnect(); commands.close()}
    }
    if(enrollment) {CameraScreen(onBack={enrollment=false},onRegistrationSuccess={enrollment=false; fatal=null}); return}
    Column(Modifier.fillMaxSize().padding(24.dp),verticalArrangement=Arrangement.spacedBy(14.dp)) {
        TextButton(onClick=onBack) {Text("Back")}
        Text("Verify before starting",style=MaterialTheme.typography.headlineSmall)
        Text(when(stage) {
            VerificationGate.Stage.BARE_FACE->"1. Face and liveness"
            VerificationGate.Stage.PUT_ON_HELMET->"2. Put on paired helmet"
            VerificationGate.Stage.ALCOHOL->"3. Alcohol test"
            VerificationGate.Stage.AUTHORIZING,VerificationGate.Stage.READY->"4. Start motorcycle"
            VerificationGate.Stage.STARTED->"Motor started"
        })
        Text(fatal ?: message)
        if(allowed && registered!=null && ready && foreground && fatal==null && stage!=VerificationGate.Stage.STARTED) {
            VerificationCamera(registered,true,stage==VerificationGate.Stage.BARE_FACE,generation,Modifier.fillMaxWidth().weight(1f),onSample={sample->
                val before=gate.stage
                gate.vision(SystemClock.elapsedRealtime(),sample.capturedAt,sample.faceMatches,sample.helmetOnHead,sample.live,sample.message)
                if(before!=VerificationGate.Stage.ALCOHOL && gate.stage==VerificationGate.Stage.ALCOHOL) {
                    commands.trySend("V2_CHECK:$session"); commands.trySend("V2_BREATH_START:$session")
                }
                cancelIfNeeded(); publish()
            },onError={fatal=it; gate.reset(it); cancelIfNeeded(); publish()})
        }
        if(!allowed) Button(onClick={request.launch(permissions.toTypedArray())}) {Text("Allow camera and Bluetooth")}
        if(fatal!=null || registered==null) {
            TextButton(onClick={service.disconnect(); enrollment=true; fatal=null; ready=false}) {Text("Register face again")}
            TextButton(onClick=onPairDevice) {Text("Pair MotoLock hardware")}
        }
        if(stage==VerificationGate.Stage.STARTED) Button(onClick=onComplete) {Text("Done")}
    }
}
