import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens'

sobriety_test_kt = """package com.example.motolock.screens

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
fun SobrietyTestScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF4F6F9))
            .padding(24.dp)
    ) {
        MotoTopBar(title = "Step 3", onBack = onBack)
        Spacer(modifier = Modifier.height(20.dp))
        
        Text("Sobriety Test", fontSize = 24.sp, fontWeight = FontWeight.Black, color = MotoBlack, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        Spacer(modifier = Modifier.height(10.dp))
        Text("Blow into the MQ-3 sensor located in the helmet for 3 seconds.", fontSize = 14.sp, color = MotoGray, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        
        Spacer(modifier = Modifier.weight(1f))
        
        MotoButton(text = "Simulate Success", onClick = { onNavigate("goodToRide") })
        Spacer(modifier = Modifier.height(10.dp))
        MotoGhostButton(text = "Simulate Failure", onClick = { onNavigate("alcoholLocked") }, isDanger = true)
    }
}
"""

good_to_ride_kt = """package com.example.motolock.screens

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
fun GoodToRideScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MotoGreenSoft)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Good to Ride!", fontSize = 32.sp, fontWeight = FontWeight.Black, color = MotoGreen, textAlign = TextAlign.Center)
        Spacer(modifier = Modifier.height(20.dp))
        Text("All safety checks passed. The ignition circuit is now unlocked.", fontSize = 16.sp, color = MotoGray, textAlign = TextAlign.Center)
        
        Spacer(modifier = Modifier.height(40.dp))
        MotoButton(text = "End Ride", onClick = { onNavigate("dashboard") })
    }
}
"""

with open(os.path.join(output_dir, "SobrietyTestScreen.kt"), "w") as f:
    f.write(sobriety_test_kt)
with open(os.path.join(output_dir, "GoodToRideScreen.kt"), "w") as f:
    f.write(good_to_ride_kt)
