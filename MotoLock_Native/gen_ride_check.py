# Generate the detailed screens for the Pre-Ride check flow
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens'

identity_check_kt = """package com.example.motolock.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.ui.components.*
import com.example.motolock.ui.theme.*

@Composable
fun IdentityCheckScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4F6F9))
            .padding(24.dp)
    ) {
        MotoTopBar(title = "Unlock Check", onBack = onBack)
        Spacer(modifier = Modifier.height(30.dp))
        
        Text(
            text = "Complete identity, helmet, and sobriety verification to enable the hardware start button.",
            fontSize = 14.sp,
            color = MotoGray,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(40.dp))
        
        // Steps
        val steps = listOf(
            "Face Verification" to "No Helmet",
            "Face Verification" to "With Helmet",
            "Sobriety Test" to "Helmet MQ-3 sensor",
            "Unlock" to "Ready to Ride"
        )
        
        steps.forEachIndexed { index, pair ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .background(MotoRed, CircleShape),
                    contentAlignment = Alignment.Center
                ) {
                    Text(text = "${index + 1}", color = Color.White, fontWeight = FontWeight.Bold)
                }
                Spacer(modifier = Modifier.width(16.dp))
                Column {
                    Text(text = pair.first, fontWeight = FontWeight.Bold, color = MotoBlack)
                    Text(text = pair.second, fontSize = 12.sp, color = MotoGray)
                }
            }
        }
        
        Spacer(modifier = Modifier.weight(1f))
        MotoButton(text = "Begin Scan", onClick = { onNavigate("verifyNoHelmet") })
    }
}
"""

verify_no_helmet_kt = """package com.example.motolock.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.ui.components.*
import com.example.motolock.ui.theme.*

@Composable
fun VerifyNoHelmetScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4F6F9))
            .padding(24.dp)
    ) {
        MotoTopBar(title = "Step 1", onBack = onBack)
        Spacer(modifier = Modifier.height(20.dp))
        
        Text("Face Identity Scan", fontSize = 24.sp, fontWeight = FontWeight.Black, color = MotoBlack, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(10.dp))
        Text("Please look directly at the camera without your helmet.", fontSize = 14.sp, color = MotoGray, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        
        Spacer(modifier = Modifier.weight(1f))
        
        // Placeholder for Camera Preview Box
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(300.dp)
                .background(MotoBlack, shape = androidx.compose.foundation.shape.RoundedCornerShape(20.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text("Camera Preview", color = Color.White)
        }
        
        Spacer(modifier = Modifier.weight(1f))
        MotoButton(text = "Simulate Success", onClick = { onNavigate("verifyHelmet") })
    }
}
"""

verify_helmet_kt = """package com.example.motolock.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.ui.components.*
import com.example.motolock.ui.theme.*

@Composable
fun VerifyHelmetScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4F6F9))
            .padding(24.dp)
    ) {
        MotoTopBar(title = "Step 2", onBack = onBack)
        Spacer(modifier = Modifier.height(20.dp))
        
        Text("Helmet Verification", fontSize = 24.sp, fontWeight = FontWeight.Black, color = MotoBlack, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(10.dp))
        Text("Put on your helmet and look at the camera to verify identity while wearing it.", fontSize = 14.sp, color = MotoGray, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        
        Spacer(modifier = Modifier.weight(1f))
        
        // Placeholder for Camera Preview Box
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(300.dp)
                .background(MotoBlack, shape = androidx.compose.foundation.shape.RoundedCornerShape(20.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text("Camera Preview", color = Color.White)
        }
        
        Spacer(modifier = Modifier.weight(1f))
        MotoButton(text = "Simulate Success", onClick = { onNavigate("alcoholLocked") }) // Assuming next step is wait for hardware alcohol result, or we go straight to goodToRide if passed
    }
}
"""

with open(os.path.join(output_dir, "IdentityCheckScreen.kt"), "w") as f:
    f.write(identity_check_kt)
with open(os.path.join(output_dir, "VerifyNoHelmetScreen.kt"), "w") as f:
    f.write(verify_no_helmet_kt)
with open(os.path.join(output_dir, "VerifyHelmetScreen.kt"), "w") as f:
    f.write(verify_helmet_kt)
    
print("Generated Ride Check screens successfully!")
