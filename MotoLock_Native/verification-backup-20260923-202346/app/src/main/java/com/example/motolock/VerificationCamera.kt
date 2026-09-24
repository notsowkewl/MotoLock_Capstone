package com.example.motolock

import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.example.motolock.data.NativeVision
import com.example.motolock.data.VisionSample
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean

@Composable
fun VerificationCamera(registered:FloatArray?, requireHelmet:Boolean, challenge:Boolean,
    resetGeneration:Int, modifier:Modifier=Modifier, onSample:(VisionSample)->Unit, onError:(String)->Unit) {
    val context=LocalContext.current; val owner=LocalLifecycleOwner.current
    val previewView=remember { PreviewView(context).apply { scaleType=PreviewView.ScaleType.FIT_CENTER } }
    val sampleCallback by rememberUpdatedState(onSample); val errorCallback by rememberUpdatedState(onError)
    val challengeState by rememberUpdatedState(challenge); val generationState by rememberUpdatedState(resetGeneration)
    AndroidView(factory={previewView},modifier=modifier)
    DisposableEffect(owner,registered,requireHelmet) {
        val stopped=AtomicBoolean(false); val executor=Executors.newSingleThreadExecutor()
        val main=ContextCompat.getMainExecutor(context); val future=ProcessCameraProvider.getInstance(context)
        var vision:NativeVision?=null; var provider:ProcessCameraProvider?=null
        var preview:Preview?=null; var analysis:ImageAnalysis?=null
        var lastFrame=0L; var generation=resetGeneration
        executor.execute {
            try {
                vision=NativeVision(context,requireHelmet)
                main.execute {
                    if(!stopped.get()) future.addListener({
                        if(!stopped.get()) try {
                            provider=future.get()
                            preview=Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
                            analysis=ImageAnalysis.Builder().setTargetResolution(android.util.Size(640,480))
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
                            analysis!!.setAnalyzer(executor) { proxy ->
                                val now=android.os.SystemClock.elapsedRealtime()
                                if(stopped.get() || now-lastFrame<200) proxy.close()
                                else {
                                    lastFrame=now
                                    val currentGeneration=generationState
                                    if(generation!=currentGeneration) { vision!!.resetLiveness(); generation=currentGeneration }
                                    val result=vision!!.analyze(proxy,registered,challengeState)
                                    main.execute { if(!stopped.get() && currentGeneration==generationState) sampleCallback(result) }
                                }
                            }
                            provider!!.bindToLifecycle(owner,CameraSelector.DEFAULT_FRONT_CAMERA,preview,analysis)
                        } catch(e:Exception) { errorCallback(e.message ?: "Cannot start camera") }
                    },main)
                }
            } catch(e:Exception) { main.execute { if(!stopped.get()) errorCallback(e.message ?: "Cannot load verification models") } }
        }
        onDispose {
            stopped.set(true); analysis?.clearAnalyzer()
            preview?.let { provider?.unbind(it) }; analysis?.let { provider?.unbind(it) }
            executor.execute { vision?.close() }; executor.shutdown()
        }
    }
}
