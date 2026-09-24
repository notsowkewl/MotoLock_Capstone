# coding=utf-8
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens'

verify_helmet_kt = """package com.example.motolock.screens

import android.util.Log
import androidx.annotation.OptIn
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.example.motolock.ml.*
import com.example.motolock.ui.components.*
import com.example.motolock.ui.theme.*
import java.util.concurrent.Executors

@OptIn(ExperimentalGetImage::class)
@Composable
fun VerifyHelmetScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val cameraExecutor = remember { Executors.newSingleThreadExecutor() }
    
    val cameraDetector = remember { CameraHelmetDetectorImpl(context) }
    val irDetector = remember { IrHelmetDetectorImpl() }
    val combinedDetector = remember { CombinedHelmetDetector(cameraDetector, irDetector) }

    val detectionState by combinedDetector.combinedState.collectAsState(initial = DetectionResult.UNAVAILABLE)

    DisposableEffect(Unit) {
        combinedDetector.start()
        onDispose {
            combinedDetector.stop()
            cameraDetector.close()
            cameraExecutor.shutdown()
        }
    }

    val circleColor = when (detectionState) {
        DetectionResult.HELMET_DETECTED -> MotoGreen
        DetectionResult.NO_HELMET -> MotoRed
        DetectionResult.UNCERTAIN -> MotoOrange
        DetectionResult.UNAVAILABLE -> MotoGray
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MotoBg)
            .padding(24.dp)
    ) {
        MotoTopBar(title = "Step 2: Helmet Check", onBack = onBack)
        Spacer(modifier = Modifier.height(20.dp))
        
        Text("Helmet Verification", fontSize = 28.sp, fontWeight = FontWeight.Black, color = MotoBlack)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Please put on your motorcycle helmet. The camera will verify it.", fontSize = 14.sp, color = MotoGray)
        Spacer(modifier = Modifier.height(40.dp))
        
        // Circular Camera UI
        Box(
            modifier = Modifier
                .fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .size(240.dp) // Adjusted size for UI parity
                    .clip(CircleShape)
                    .border(8.dp, circleColor, CircleShape)
                    .background(Color.Black)
            ) {
                AndroidView(
                    factory = { ctx ->
                        val previewView = PreviewView(ctx)
                        val cameraProviderFuture = ProcessCameraProvider.getInstance(ctx)
                        
                        cameraProviderFuture.addListener({
                            val cameraProvider = cameraProviderFuture.get()
                            
                            val preview = Preview.Builder().build().also {
                                it.setSurfaceProvider(previewView.surfaceProvider)
                            }
                            
                            val imageAnalyzer = ImageAnalysis.Builder()
                                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                                .build()
                                .also { analysis ->
                                    analysis.setAnalyzer(cameraExecutor) { imageProxy ->
                                        val bitmap = imageProxy.toBitmap()
                                        cameraDetector.processFrame(bitmap)
                                        imageProxy.close()
                                    }
                                }
                            
                            try {
                                cameraProvider.unbindAll()
                                cameraProvider.bindToLifecycle(
                                    lifecycleOwner,
                                    CameraSelector.DEFAULT_FRONT_CAMERA, // Face/Helmet generally front camera
                                    preview,
                                    imageAnalyzer
                                )
                            } catch(e: Exception) {
                                Log.e("VerifyHelmetScreen", "Use case binding failed", e)
                            }
                        }, ContextCompat.getMainExecutor(ctx))
                        previewView
                    },
                    modifier = Modifier.fillMaxSize()
                )
            }
        }
        
        Spacer(modifier = Modifier.weight(1f))
        
        MotoButton(
            text = "Proceed to Next Step",
            onClick = { onNavigate("sobrietyTest") },
            // Button is functionally disabled unless passed, logic can be added in onClick if component lacks enabled param
        )
    }
}
"""

with open(os.path.join(output_dir, "VerifyHelmetScreen.kt"), "w", encoding="utf-8") as f:
    f.write(verify_helmet_kt)
print("VerifyHelmetScreen UI Updated")
