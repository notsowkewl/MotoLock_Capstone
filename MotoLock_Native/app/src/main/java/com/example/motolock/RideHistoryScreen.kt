package com.example.motolock

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun RideHistoryScreen(onBack: () -> Unit) {
    val motoBlack = Color(0xFF101217)
    val textGray = Color(0xFF737987)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F8FA))
            .padding(horizontal = 24.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Spacer(modifier = Modifier.height(48.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .background(Color.White, CircleShape)
                    .shadow(12.dp, CircleShape, spotColor = Color(0xFF0F172A).copy(alpha = 0.08f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.History, contentDescription = null, tint = motoBlack, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.width(16.dp))
            Text(
                "Ride History",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = motoBlack,
                letterSpacing = (-0.5).sp
            )
        }
        
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "Review your recent trips and safety logs.",
            fontSize = 13.sp,
            color = textGray,
            lineHeight = 20.sp
        )

        Spacer(modifier = Modifier.height(32.dp))

        Box(
            modifier = Modifier.fillMaxWidth().padding(top = 40.dp),
            contentAlignment = Alignment.Center
        ) {
            Text("No ride history available.", color = textGray, fontSize = 14.sp)
        }
    }
}
