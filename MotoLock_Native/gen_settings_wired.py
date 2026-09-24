# coding=utf-8
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens'

settings_kt = """package com.example.motolock.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Face
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.ui.components.*
import com.example.motolock.ui.theme.*
import com.example.motolock.data.MotoLockDataStore

@Composable
fun SettingsScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    val context = LocalContext.current
    val dataStore = remember { MotoLockDataStore(context) }
    val savedName by dataStore.riderNameFlow.collectAsState(initial = "Rider")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MotoBg)
            .padding(24.dp)
            .verticalScroll(rememberScrollState())
    ) {
        MotoTopBar(title = "Settings", onBack = onBack)
        Spacer(modifier = Modifier.height(20.dp))
        
        Text("Account", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = MotoGray)
        Spacer(modifier = Modifier.height(8.dp))
        MotoCard(title = savedName, subtitle = "Update your name, email, and phone number", icon = Icons.Default.AccountCircle, onClick = { onNavigate("riderProfile") })
        Spacer(modifier = Modifier.height(8.dp))
        MotoCard(title = "Change Password", subtitle = "Update your login password", icon = Icons.Default.Lock, onClick = { onNavigate("changePassword") })
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Text("Security & Devices", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = MotoGray)
        Spacer(modifier = Modifier.height(8.dp))
        MotoCard(title = "Security PIN", subtitle = "Change your 4-digit backup PIN", icon = Icons.Default.Lock, onClick = { onNavigate("securityPin") })
        Spacer(modifier = Modifier.height(8.dp))
        MotoCard(title = "Face ID Settings", subtitle = "Re-register your face and helmet mapping", icon = Icons.Default.Face, onClick = { onNavigate("faceIdSettings") })
        Spacer(modifier = Modifier.height(8.dp))
        MotoCard(title = "Connected Device", subtitle = "Manage ESP32 bluetooth pairing", icon = Icons.Default.Build, onClick = { onNavigate("connectedDeviceSettings") })
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Text("Emergency", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = MotoGray)
        Spacer(modifier = Modifier.height(8.dp))
        MotoCard(title = "Emergency Contacts", subtitle = "Manage SMS SOS contacts", icon = Icons.Default.Warning, onClick = { onNavigate("emergencyContacts") })
        
        Spacer(modifier = Modifier.height(24.dp))
        
        Text("App Info", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = MotoGray)
        Spacer(modifier = Modifier.height(8.dp))
        MotoCard(title = "About MotoLock", subtitle = "Version 1.0.0", icon = Icons.Default.Info, onClick = { onNavigate("aboutMotoLock") })
        
        Spacer(modifier = Modifier.height(40.dp))
        MotoGhostButton(text = "Log Out", onClick = { onNavigate("login") }, isDanger = true)
        Spacer(modifier = Modifier.height(24.dp))
    }
}
"""

with open(os.path.join(output_dir, "SettingsScreen.kt"), "w", encoding="utf-8") as f:
    f.write(settings_kt)
print("Settings wired")
