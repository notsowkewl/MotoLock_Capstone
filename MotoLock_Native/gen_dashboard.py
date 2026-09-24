# coding=utf-8
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens'

dashboard_kt = """package com.example.motolock.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
importつき
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.ui.components.*
import com.example.motolock.ui.theme.*

@Composable
fun DashboardScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MotoBg)
            .padding(horizontal = 24.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Spacer(modifier = Modifier.height(24.dp))
        MotoTopBar(
            title = "MotoLock",
            rightContent = {
                IconButton(onClick = { onNavigate("settings") }) {
                    Icon(Icons.Default.Settings, contentDescription = "Settings", tint = MotoBlack)
                }
            }
        )
        
        Spacer(modifier = Modifier.height(30.dp))
        
        Text("Hello!", fontSize = 32.sp, fontWeight = FontWeight.Black, color = MotoBlack)
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "Your motorcycle is locked by default. Complete the unlock check when you are ready to ride.",
            fontSize = 14.sp, color = MotoGray, lineHeight = 20.sp
        )
        
        Spacer(modifier = Modifier.height(30.dp))
        
        // Status Card
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .shadow(12.dp, RoundedCornerShape(20.dp), spotColor = MotoRed.copy(alpha = 0.1f))
                .background(MotoRedSoft, RoundedCornerShape(20.dp))
                .padding(20.dp)
        ) {
            Text("Motorcycle Locked", fontSize = 18.sp, fontWeight = FontWeight.Black, color = MotoRedDark)
            Spacer(modifier = Modifier.height(8.dp))
            Text("Your motorcycle is locked by default. Complete the safety check to unlock ignition access.", fontSize = 13.sp, color = MotoRedDark.copy(alpha = 0.8f))
        }
        
        Spacer(modifier = Modifier.height(30.dp))
        
        MotoCard(
            title = "Device Status",
            subtitle = "ESP32 is connected and waiting for instructions.",
            icon = Icons.Default.CheckCircle
        )
        
        Spacer(modifier = Modifier.height(12.dp))
        
        MotoCard(
            title = "Ride History",
            subtitle = "View your previous rides and safety verification logs.",
            icon = Icons.Default.Lock,
            onClick = { onNavigate("rideHistory") }
        )
        
        Spacer(modifier = Modifier.height(40.dp))
        
        MotoButton(text = "Start Ride Check", onClick = { onNavigate("selectRideMotorcycle") })
        
        Spacer(modifier = Modifier.height(24.dp))
    }
}
"""

ride_history_kt = """package com.example.motolock.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.ui.components.*
import com.example.motolock.ui.theme.*

@Composable
fun RideHistoryScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MotoBg)
            .padding(24.dp)
    ) {
        MotoTopBar(title = "Ride History", onBack = onBack)
        Spacer(modifier = Modifier.height(20.dp))
        
        Text("Your Past Rides", fontSize = 24.sp, fontWeight = FontWeight.Black, color = MotoBlack)
        Spacer(modifier = Modifier.height(20.dp))
        
        Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
            for(i in 1..5) {
                MotoCard(
                    title = "Ride #$i",
                    subtitle = "Passed all checks. Duration: 45 mins",
                    icon = Icons.Default.CheckCircle
                )
                Spacer(modifier = Modifier.height(12.dp))
            }
        }
    }
}
"""

with open(os.path.join(output_dir, "DashboardScreen.kt"), "w", encoding="utf-8") as f:
    f.write(dashboard_kt.replace("つき", ""))
with open(os.path.join(output_dir, "RideHistoryScreen.kt"), "w", encoding="utf-8") as f:
    f.write(ride_history_kt)
print("done dashboard")
