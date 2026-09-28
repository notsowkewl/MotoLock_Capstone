package com.example.motolock

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch

@Composable
fun FaceIdManagementScreen(onBack: () -> Unit, onEnroll: () -> Unit) {
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    
    var isEnrolled by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var reloadData by remember { mutableStateOf(0) }

    LaunchedEffect(reloadData) {
        isLoading = true
        loadError = null
        try {
            val session = SupabaseClientManager.client.auth.currentSessionOrNull()
            val userId = session?.user?.id
            if (userId != null) {
                val userProfile = com.example.motolock.data.RiderAccount.profile()
                
                if (userProfile != null) {
                    isEnrolled = userProfile.faceDescriptor != null &&
                        userProfile.faceDescriptor !is kotlinx.serialization.json.JsonNull
                }
            }
        } catch (e: Exception) {
            if (e is kotlinx.coroutines.CancellationException) throw e
            loadError = "Unable to load saved Face ID. Check your connection and retry."
            e.printStackTrace()
        } finally {
            isLoading = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F8FA))
            .padding(24.dp)
    ) {
        // Back Button
        Box(
            modifier = Modifier
                .size(36.dp)
                .background(Color.White, RoundedCornerShape(12.dp))
                .border(1.dp, lineCol, RoundedCornerShape(12.dp))
                .clickable { onBack() },
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp), tint = Color(0xFF101217))
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Icon Header
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier.size(64.dp).background(motoRed.copy(alpha = 0.05f), RoundedCornerShape(32.dp)).border(1.dp, motoRed.copy(alpha = 0.2f), RoundedCornerShape(32.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.PhotoCamera, contentDescription = null, tint = motoRed, modifier = Modifier.size(28.dp))
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        Text("Face ID Management", fontSize = 24.sp, fontWeight = FontWeight.Black, color = motoBlack, modifier = Modifier.align(Alignment.CenterHorizontally))
        Spacer(modifier = Modifier.height(6.dp))
        Text("Manage your facial recognition data used for identity verification.", fontSize = 13.sp, color = Color(0xFF737987), modifier = Modifier.align(Alignment.CenterHorizontally), textAlign = TextAlign.Center)

        Spacer(modifier = Modifier.height(32.dp))

        if (loadError != null) {
            Text(loadError!!, color = motoRed)
            TextButton(onClick = { reloadData++ }) { Text("Retry") }
        } else if (isLoading) {
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = motoRed)
            }
        } else {
            // Status Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White, RoundedCornerShape(16.dp))
                    .border(1.dp, lineCol, RoundedCornerShape(16.dp))
                    .padding(20.dp)
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = if (isEnrolled) Icons.Default.CheckCircle else Icons.Default.Warning,
                        contentDescription = null,
                        tint = if (isEnrolled) Color(0xFF10B981) else Color(0xFFF59E0B),
                        modifier = Modifier.size(40.dp)
                    )
                    Spacer(modifier = Modifier.width(16.dp))
                    Column {
                        Text(
                            text = if (isEnrolled) "Status: Active & Enrolled" else "Status: Not Enrolled",
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = motoBlack
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = if (isEnrolled) "Your Face ID is securely stored and ready for ignition unlock." else "You need to enroll your face to use the system.",
                            fontSize = 12.sp,
                            color = Color(0xFF737987),
                            lineHeight = 16.sp
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))

            Button(
                onClick = { onEnroll() },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = motoRed),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text(if (isEnrolled) "Retake Face ID" else "Enroll Face ID", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }
}

