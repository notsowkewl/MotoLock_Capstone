package com.example.motolock

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun RideHistoryScreen(onBack: () -> Unit) {
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val textGray = Color(0xFF737987)

    val bgBrush = Brush.linearGradient(
        colors = listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF))
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(bgBrush)
            .padding(horizontal = 24.dp, vertical = 22.dp)
            .verticalScroll(rememberScrollState())
    ) {
        // Topbar
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Spacer(modifier = Modifier.size(36.dp))

            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Default.History, contentDescription = null, modifier = Modifier.size(20.dp), tint = motoRed)
                Spacer(modifier = Modifier.width(6.dp))
                Text("Ride History", fontSize = 18.sp, fontWeight = FontWeight.Black, color = motoBlack)
            }

            Spacer(modifier = Modifier.size(36.dp))
        }

        Spacer(modifier = Modifier.height(40.dp))

        // Empty state
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .background(Color(0xFFF1F3F6), CircleShape),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.History, contentDescription = null, tint = textGray, modifier = Modifier.size(36.dp))
            }
            Spacer(modifier = Modifier.height(20.dp))
            Text(
                "No Ride History Yet",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = motoBlack
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "Your unlock and ride sessions will appear here once you start riding.",
                fontSize = 13.sp,
                color = textGray,
                lineHeight = 18.sp
            )
        }
    }
}