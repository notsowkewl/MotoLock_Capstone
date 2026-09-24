# coding=utf-8
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens'

verify_identity_kt = """package com.example.motolock.screens

import android.util.Log
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
import com.example.motolock.ui.components.*
import com.example.motolock.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun VerifyIdentityScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current
    val scope = rememberCoroutineScope()
    
    // For face verification, we use a simple state machine for now to represent the process
    // until full MobileFaceNet integration is built.
    var scanState by remember { mutableStateOf("scanning") }

    LaunchedEffect(Unit) {
        delay(2000)
        scanState = "passed"
    }

    val circleColor = when (scanState) {
        "passed" -> MotoGreen
        "failed" -> MotoRed
        else -> MotoOrange
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MotoBg)
            .padding(24.dp)
    ) {
        MotoTopBar(title = "Step 1: Identity", onBack = onBack)
        Spacer(modifier = Modifier.height(20.dp))
        
        Text("Face ID Verification", fontSize = 28.sp, fontWeight = FontWeight.Black, color = MotoBlack)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Look directly at the camera to verify your identity.", fontSize = 14.sp, color = MotoGray)
        Spacer(modifier = Modifier.height(40.dp))
        
        // Circular Camera UI
        Box(
            modifier = Modifier
                .fillMaxWidth(),
            contentAlignment = Alignment.Center
        ) {
            Box(
                modifier = Modifier
                    .size(240.dp)
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
                            
                            try {
                                cameraProvider.unbindAll()
                                cameraProvider.bindToLifecycle(
                                    lifecycleOwner,
                                    CameraSelector.DEFAULT_FRONT_CAMERA,
                                    preview
                                )
                            } catch(e: Exception) {
                                Log.e("VerifyIdentity", "Use case binding failed", e)
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
            text = if (scanState == "passed") "Proceed to Helmet Check" else "Scanning...",
            onClick = { 
                if (scanState == "passed") onNavigate("verifyHelmet") 
            }
        )
    }
}
"""

with open(os.path.join(output_dir, "VerifyIdentityScreen.kt"), "w", encoding="utf-8") as f:
    f.write(verify_identity_kt)
print("VerifyIdentityScreen UI Updated")
