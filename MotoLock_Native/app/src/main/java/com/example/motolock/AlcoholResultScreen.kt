package com.example.motolock

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun AlcoholResultScreen(
    success: Boolean,
    motorLocked: Boolean,
    message: String,
    savingRide: Boolean = false,
    onReturnToDashboard: () -> Unit
) {
    BackHandler { if (!savingRide) onReturnToDashboard() }
    val motoRed = Color(0xFFED1C24)
    Column(
        modifier = Modifier.fillMaxSize().background(Color(0xFFF7F8FA))
            .safeDrawingPadding().verticalScroll(rememberScrollState()).padding(28.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Image(
            painter = painterResource(if (success) R.drawable.safe else R.drawable.lasing),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            modifier = Modifier.size(160.dp)
        )
        Spacer(Modifier.height(28.dp))
        Text(if (success) "Safe ride!" else "Alcohol detected",
            fontSize = 28.sp, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center,
            color = Color(0xFF101217))
        Spacer(Modifier.height(12.dp))
        Text(
            if (success) {
                if (motorLocked) "Checks passed. The motorcycle is currently locked." else "Checks passed. Motorcycle unlocked."
            } else if (motorLocked) "Motorcycle locked. Do not ride after drinking." else message,
            fontSize = 16.sp, textAlign = TextAlign.Center, color = Color(0xFF737987)
        )
        Spacer(Modifier.height(36.dp))
        Button(
            onClick = onReturnToDashboard,
            enabled = !savingRide,
            modifier = Modifier.fillMaxWidth().height(51.dp)
                .shadow(28.dp, RoundedCornerShape(15.dp), spotColor = motoRed.copy(alpha = 0.22f)),
            shape = RoundedCornerShape(15.dp),
            contentPadding = PaddingValues(0.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = Color.Transparent,
                contentColor = Color.White,
                disabledContainerColor = Color.Transparent,
                disabledContentColor = Color.White
            )
        ) {
            Box(
                modifier = Modifier.fillMaxSize().background(
                    Brush.verticalGradient(listOf(Color(0xFFFF3038), motoRed)), RoundedCornerShape(15.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text(if (savingRide) "Saving ride..." else "Return to Dashboard",
                    fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White)
            }
        }
    }
}
