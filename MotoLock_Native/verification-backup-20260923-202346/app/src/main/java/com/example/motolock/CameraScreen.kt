package com.example.motolock

import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.example.motolock.data.VerificationPolicy
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import kotlinx.serialization.json.*

@Composable
fun CameraScreen(onBack:()->Unit,onRegistrationSuccess:(()->Unit)?=null) {
    val context=LocalContext.current; val scope=rememberCoroutineScope()
    var permission by remember { mutableStateOf(ContextCompat.checkSelfPermission(context,Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED) }
    val request=rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { permission=it }
    var message by remember { mutableStateOf("Remove headwear. Keep one face visible in good light.") }
    var saving by remember { mutableStateOf(false) }; var finished by remember { mutableStateOf(false) }
    var confirmed by remember { mutableStateOf(false) }
    var cameraError by remember { mutableStateOf(false) }; var generation by remember { mutableIntStateOf(0) }
    val samples=remember { mutableListOf<FloatArray>() }; var count by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) { if(!permission) request.launch(Manifest.permission.CAMERA) }
    Column(Modifier.fillMaxSize().padding(24.dp),verticalArrangement=Arrangement.spacedBy(16.dp)) {
        TextButton(onClick=onBack) { Text("Back") }
        Text("Register your face",style=MaterialTheme.typography.headlineSmall)
        Text(message)
        if(!confirmed) {
            Text("This replaces your saved face profile with real MobileFaceNet samples. Old placeholder and incompatible profiles cannot unlock the motorcycle.")
            Button(onClick={confirmed=true}) { Text("Begin face registration") }
        } else if(permission && !saving && !finished && !cameraError) {
            VerificationCamera(null,false,true,generation,Modifier.fillMaxWidth().weight(1f),onSample={ sample ->
                if(!sample.faceMatches || !sample.live || sample.embedding==null || !VerificationPolicy.fresh(android.os.SystemClock.elapsedRealtime(),sample.capturedAt)) {
                    samples.clear(); count=0; message=sample.message
                } else if(samples.isNotEmpty() && VerificationPolicy.distance(samples.first(),sample.embedding)>0.65f) {
                    samples.clear(); count=0; generation++; message="Face changed. Repeat the liveness check."
                } else {
                    samples.add(sample.embedding.copyOf()); count=samples.size; message="Hold still: capturing face $count / 8"
                    if(samples.size==8) {
                        val mean=VerificationPolicy.normalize(FloatArray(VerificationPolicy.FACE_SIZE) { i -> samples.sumOf { it[i].toDouble() }.toFloat()/samples.size })
                        saving=true
                        scope.launch {
                            try {
                                val user=SupabaseClientManager.client.auth.currentSessionOrNull()?.user ?: error("Sign in before registering")
                                val descriptor=JsonArray(mean.map { JsonPrimitive(it) })
                                val result=SupabaseClientManager.client.postgrest["users"].update({set("face_descriptor",descriptor)}) {filter {eq("id",user.id)}; select()}
                                check(result.data!="[]") { "Your rider profile was not updated. Check account access." }
                                finished=true; message="Face registered successfully"
                            } catch(e:Exception) { message="Registration failed: ${e.message}"; samples.clear(); count=0; generation++ }
                            finally {saving=false}
                        }
                    }
                }
            },onError={message=it; cameraError=true})
            LinearProgressIndicator(progress={count/8f},modifier=Modifier.fillMaxWidth())
        } else if(!permission) Button(onClick={request.launch(Manifest.permission.CAMERA)}) {Text("Allow camera")}
        if(saving) CircularProgressIndicator()
        if(finished) Button(onClick={onRegistrationSuccess?.invoke() ?: onBack()}) {Text("Continue")}
        if(cameraError) Button(onClick={cameraError=false; generation++}) {Text("Retry camera")}
    }
}
