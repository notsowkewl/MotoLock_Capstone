# coding=utf-8
import os

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
    MaxBrightnessEffect()

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
            .padding(horizontal = 24.dp, vertical = 22.dp)
    ) {
        MotoTopBar(title = "", onBack = onBack)
        
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text("STEP 2 OF 3", color = MotoRed, fontSize = 12.sp, fontWeight = FontWeight.Black)
            Spacer(modifier = Modifier.height(7.dp))
            
            Text("Helmet Check", fontSize = 22.sp, fontWeight = FontWeight.Black, color = MotoBlack, lineHeight = 24.sp)
            Spacer(modifier = Modifier.height(8.dp))
            
            Text("Please put on your motorcycle helmet. The camera will verify it.", fontSize = 13.sp, color = MotoGray, textAlign = TextAlign.Center)
            Spacer(modifier = Modifier.height(15.dp))
            
            // Circular Camera UI with styling
            Box(
                modifier = Modifier.fillMaxWidth(),
                contentAlignment = Alignment.Center
            ) {
                Box(
                    modifier = Modifier
                        .size(224.dp)
                        .clip(CircleShape)
                        .border(6.dp, Color(0xFFE8ECF2), CircleShape) // Base border
                        .border(8.dp, circleColor.copy(alpha = 0.5f), CircleShape) // Glow
                        .border(6.dp, circleColor, CircleShape) // Active color
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
                                        CameraSelector.DEFAULT_FRONT_CAMERA,
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
                
                // Overlay Corners
                val cornerSize = 34.dp
                Box(modifier = Modifier.size(240.dp)) {
                    // Top Left
                    Box(modifier = Modifier.align(Alignment.TopStart).padding(start = 28.dp, top = 28.dp).size(cornerSize).border(3.dp, MotoGreen).clip(RoundedCornerShape(topStart = 8.dp)))
                    // Top Right
                    Box(modifier = Modifier.align(Alignment.TopEnd).padding(end = 28.dp, top = 28.dp).size(cornerSize).border(3.dp, MotoGreen).clip(RoundedCornerShape(topEnd = 8.dp)))
                    // Bottom Left
                    Box(modifier = Modifier.align(Alignment.BottomStart).padding(start = 28.dp, bottom = 28.dp).size(cornerSize).border(3.dp, MotoGreen).clip(RoundedCornerShape(bottomStart = 8.dp)))
                    // Bottom Right
                    Box(modifier = Modifier.align(Alignment.BottomEnd).padding(end = 28.dp, bottom = 28.dp).size(cornerSize).border(3.dp, MotoGreen).clip(RoundedCornerShape(bottomEnd = 8.dp)))
                }
            }
            
            Spacer(modifier = Modifier.height(25.dp))
            
            // Tip Box
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xEBF2F2F2), RoundedCornerShape(18.dp))
                    .border(1.dp, MotoLine, RoundedCornerShape(18.dp))
                    .padding(14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(43.dp)
                        .background(Color(0xFFF4F6F9), RoundedCornerShape(16.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Text("ℹ️", fontSize = 16.sp) // Fallback for icon
                }
                Spacer(modifier = Modifier.width(12.dp))
                Text(
                    "Ensure your visor is up so your face is visible.",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF2F3440)
                )
            }
        }
        
        Spacer(modifier = Modifier.weight(1f))
        
        MotoButton(
            text = "Start Helmet Scan",
            onClick = { onNavigate("sobrietyTest") }
        )
    }
}
"""

with open('C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens/VerifyHelmetScreen.kt', 'w', encoding='utf-8') as f:
    f.write(verify_helmet_kt)
print("VerifyHelmetScreen restored to pixel-perfect design")
