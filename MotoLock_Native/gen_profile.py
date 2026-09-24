# coding=utf-8
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens'

rider_profile_kt = """package com.example.motolock.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.ui.components.*
import com.example.motolock.ui.theme.*

@Composable
fun RiderProfileScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MotoBg)
            .padding(24.dp)
    ) {
        MotoTopBar(title = "Rider Profile", onBack = onBack)
        Spacer(modifier = Modifier.height(20.dp))
        
        Text("Update Profile", fontSize = 24.sp, fontWeight = FontWeight.Black, color = MotoBlack)
        Spacer(modifier = Modifier.height(20.dp))
        
        OutlinedTextField(
            value = name, onValueChange = { name = it },
            label = { Text("Full Name") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = MotoRed)
        )
        Spacer(modifier = Modifier.height(12.dp))
        
        OutlinedTextField(
            value = phone, onValueChange = { phone = it },
            label = { Text("Phone Number") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = MotoRed)
        )
        
        Spacer(modifier = Modifier.weight(1f))
        MotoButton(text = "Save Changes", onClick = { onBack() })
    }
}
"""

with open(os.path.join(output_dir, "RiderProfileScreen.kt"), "w", encoding="utf-8") as f:
    f.write(rider_profile_kt)
print("done profile")
