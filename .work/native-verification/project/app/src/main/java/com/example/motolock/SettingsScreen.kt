package com.example.motolock

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material.icons.filled.SettingsApplications
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    onNavigateToContacts: () -> Unit,
    onNavigateToMotorcycle: () -> Unit,
    onLogout: () -> Unit,
    onBack: () -> Unit
) {
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val textGray = Color(0xFF737987)

    val bgBrush = Brush.linearGradient(
        colors = listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF))
    )

    val coroutineScope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(bgBrush)
            .padding(horizontal = 24.dp, vertical = 22.dp)
    ) {
        // Topbar
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(Color.White.copy(alpha = 0.88f), RoundedCornerShape(14.dp))
                    .border(1.dp, lineCol, RoundedCornerShape(14.dp))
                    .shadow(18.dp, RoundedCornerShape(14.dp), spotColor = Color(0xFF0F172A).copy(alpha = 0.05f))
                    .clickable { onBack() },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp), tint = motoBlack)
            }
            
            Spacer(modifier = Modifier.size(36.dp))
        }

        Spacer(modifier = Modifier.height(22.dp))

        // Title
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Text("Settings", fontSize = 22.sp, fontWeight = FontWeight.Black, color = motoBlack, letterSpacing = (-0.04).sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text("Manage your profile and hardware configurations", fontSize = 13.sp, color = textGray, lineHeight = 18.sp)
        }

        Spacer(modifier = Modifier.height(30.dp))

        // Cards
        SettingsCard(
            title = "Emergency Contacts",
            description = "Setup your trusted contacts for automatic SOS alerts.",
            icon = Icons.Default.Warning,
            onClick = onNavigateToContacts
        )
        
        Spacer(modifier = Modifier.height(12.dp))
        
        SettingsCard(
            title = "Motorcycle & ESP32",
            description = "Configure your Bluetooth pairing and lock delays.",
            icon = Icons.Default.SettingsApplications,
            onClick = onNavigateToMotorcycle
        )

        Spacer(modifier = Modifier.weight(1f))

        // Log out button
        Button(
            onClick = {
                coroutineScope.launch {
                    try {
                        SupabaseClientManager.client.auth.signOut()
                    } catch (e: Exception) {}
                    onLogout()
                }
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(51.dp)
                .shadow(10.dp, RoundedCornerShape(15.dp), spotColor = motoRed.copy(alpha = 0.08f)),
            colors = ButtonDefaults.buttonColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, motoRed),
            shape = RoundedCornerShape(15.dp)
        ) {
            Text("Log Out", fontSize = 13.sp, fontWeight = FontWeight.Black, color = motoRed)
        }
    }
}

@Composable
fun SettingsCard(title: String, description: String, icon: androidx.compose.ui.graphics.vector.ImageVector, onClick: () -> Unit) {
    val lineCol = Color(0xFFE8EBF0)
    val textGray = Color(0xFF737987)

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Color.White.copy(alpha = 0.92f), RoundedCornerShape(18.dp))
            .border(1.dp, lineCol, RoundedCornerShape(18.dp))
            .clickable { onClick() }
            .padding(14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(43.dp)
                .background(Color(0xFFF4F6F9), RoundedCornerShape(16.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = Color(0xFFED1C24), modifier = Modifier.size(22.dp))
        }
        Spacer(modifier = Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF2F3440))
            Spacer(modifier = Modifier.height(3.dp))
            Text(description, fontSize = 11.sp, color = textGray, lineHeight = 15.sp)
        }
    }
}
