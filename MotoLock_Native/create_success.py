# coding=utf-8
import os

code = """package com.example.motolock

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun FaceIdSuccessScreen(onContinue: () -> Unit) {
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val motoGreen = Color(0xFF1FA35B)
    val lineCol = Color(0xFFE8EBF0)
    val textGray = Color(0xFF737987)

    val bgBrush = Brush.linearGradient(
        colors = listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF))
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(bgBrush)
            .padding(horizontal = 24.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Big Green Checkmark
        Box(
            modifier = Modifier
                .size(100.dp)
                .shadow(32.dp, CircleShape, spotColor = motoGreen.copy(alpha = 0.3f))
                .background(Color(0xFFE8F5EE), CircleShape)
                .border(3.dp, motoGreen, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Check, contentDescription = "Success", tint = motoGreen, modifier = Modifier.size(50.dp))
        }

        Spacer(modifier = Modifier.height(30.dp))

        Text(
            "Face ID Registered Successfully!",
            fontSize = 22.sp,
            fontWeight = FontWeight.Black,
            color = motoBlack,
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(10.dp))

        Text(
            "Your face has been securely stored and will be used as the primary biometric key to start your motorcycle.",
            fontSize = 14.sp,
            color = textGray,
            textAlign = TextAlign.Center,
            lineHeight = 20.sp
        )

        Spacer(modifier = Modifier.height(40.dp))

        // Checklist
        val checks = listOf(
            "Identity verified against driver's license",
            "Facial landmarks securely encrypted",
            "Ready for pre-ride ignition checks"
        )
        
        Column(modifier = Modifier.fillMaxWidth()) {
            checks.forEach { check ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(modifier = Modifier.size(24.dp).background(motoGreen.copy(alpha=0.1f), CircleShape), contentAlignment = Alignment.Center) {
                        Icon(Icons.Default.Check, contentDescription = null, tint = motoGreen, modifier = Modifier.size(14.dp))
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Text(check, fontSize = 13.sp, color = motoBlack, fontWeight = FontWeight.Bold)
                }
            }
        }

        Spacer(modifier = Modifier.height(60.dp))

        Button(
            onClick = onContinue,
            modifier = Modifier
                .fillMaxWidth()
                .height(51.dp)
                .shadow(28.dp, RoundedCornerShape(15.dp), spotColor = motoRed.copy(alpha = 0.22f)),
            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
            contentPadding = PaddingValues(0.dp),
            shape = RoundedCornerShape(15.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(listOf(Color(0xFFFF3038), motoRed)),
                        RoundedCornerShape(15.dp)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Text("Continue", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
            }
        }
    }
}
"""
with open('app/src/main/java/com/example/motolock/FaceIdSuccessScreen.kt', 'w', encoding='utf-8') as f:
    f.write(code)

