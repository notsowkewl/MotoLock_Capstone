package com.example.motolock

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material3.*
import androidx.compose.runtime.*
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
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch

@Composable
fun PinSetupScreen(onBack: () -> Unit, onComplete: () -> Unit) {
    var pin by remember { mutableStateOf("") }
    var confirmPin by remember { mutableStateOf("") }
    var isConfirming by remember { mutableStateOf(false) }
    var isSaving by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }

    val coroutineScope = rememberCoroutineScope()
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
            .padding(horizontal = 24.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Back icon Ã¢â‚¬â€ only visible on the Confirm PIN step so user can fix a typo
        if (isConfirming) {
            Row(modifier = Modifier.fillMaxWidth()) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .background(Color.White.copy(alpha = 0.88f), RoundedCornerShape(14.dp))
                        .border(1.dp, lineCol, RoundedCornerShape(14.dp))
                        .shadow(18.dp, RoundedCornerShape(14.dp), spotColor = Color(0xFF0F172A).copy(alpha = 0.05f))
                        .clip(RoundedCornerShape(14.dp))
                        .clickable(enabled = !isSaving) {
                            isConfirming = false
                            confirmPin = ""
                            errorMessage = null
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "Back to PIN entry",
                        modifier = Modifier.size(20.dp),
                        tint = motoBlack
                    )
                }
            }
            Spacer(modifier = Modifier.height(28.dp))
        } else {
            Spacer(modifier = Modifier.height(20.dp))
        }

        Text(
            if (isConfirming) "Confirm PIN" else "Set Security PIN",
            fontSize = 28.sp,
            fontWeight = FontWeight.Black,
            color = motoBlack
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            if (isConfirming) "Re-enter your PIN to confirm" else "Create a 4-digit PIN for quick access",
            fontSize = 14.sp,
            color = textGray
        )

        Spacer(modifier = Modifier.height(40.dp))

        // PIN dot indicators
        Row(
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            val currentPinStr = if (isConfirming) confirmPin else pin
            for (i in 0 until 4) {
                val isFilled = i < currentPinStr.length
                Box(
                    modifier = Modifier
                        .size(18.dp)
                        .clip(CircleShape)
                        .border(2.dp, motoBlack, CircleShape)
                        .background(if (isFilled) motoBlack else Color.Transparent)
                )
            }
        }

        // Error message
        if (errorMessage != null) {
            Spacer(modifier = Modifier.height(20.dp))
            Text(
                text = errorMessage!!,
                color = motoRed,
                fontSize = 13.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .fillMaxWidth()
                    .background(motoRed.copy(alpha = 0.07f), RoundedCornerShape(10.dp))
                    .padding(12.dp)
            )
        }

        Spacer(modifier = Modifier.height(40.dp))

        if (isSaving) {
            CircularProgressIndicator(color = motoRed)
            Spacer(modifier = Modifier.weight(1f))
            return@Column
        }

        // Keypad
        val keys = listOf(
            listOf("1", "2", "3"),
            listOf("4", "5", "6"),
            listOf("7", "8", "9"),
            listOf("", "0", "DEL")
        )

        keys.forEach { row ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                row.forEach { key ->
                    Box(
                        modifier = Modifier
                            .width(88.dp)
                            .height(64.dp)
                            .background(Color.Transparent, RoundedCornerShape(12.dp))
                            .border(
                                width = if (key.isNotEmpty()) 1.dp else 0.dp,
                                color = if (key.isNotEmpty()) lineCol else Color.Transparent,
                                shape = RoundedCornerShape(12.dp)
                            )
                            .clip(RoundedCornerShape(12.dp))
                            .clickable(enabled = key.isNotEmpty() && !isSaving) {
                                errorMessage = null
                                if (key == "DEL") {
                                    if (isConfirming && confirmPin.isNotEmpty()) {
                                        confirmPin = confirmPin.dropLast(1)
                                    } else if (!isConfirming && pin.isNotEmpty()) {
                                        pin = pin.dropLast(1)
                                    }
                                } else {
                                    if (isConfirming) {
                                        if (confirmPin.length < 4) {
                                            confirmPin += key
                                            if (confirmPin.length == 4) {
                                                if (pin == confirmPin) {
                                                    isSaving = true
                                                    coroutineScope.launch {
                                                        try {
                                                            val authUser = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
                                                            if (authUser != null) {
                                                                com.example.motolock.data.RiderPinRepository.createPin(confirmPin)
                                                                onComplete()
                                                            } else {
                                                                errorMessage = "Session expired. Please log in again."
                                                                isSaving = false
                                                            }
                                                        } catch (e: Exception) {
                                                            errorMessage = "Could not save PIN: ${e.message}"
                                                            isSaving = false
                                                            isConfirming = false
                                                            pin = ""
                                                            confirmPin = ""
                                                        }
                                                    }
                                                } else {
                                                    errorMessage = "PINs do not match. Try again."
                                                    isConfirming = false
                                                    pin = ""
                                                    confirmPin = ""
                                                }
                                            }
                                        }
                                    } else {
                                        if (pin.length < 4) {
                                            pin += key
                                            if (pin.length == 4) {
                                                isConfirming = true
                                            }
                                        }
                                    }
                                }
                            },
                        contentAlignment = Alignment.Center
                    ) {
                        if (key == "DEL") {
                            Icon(
                                Icons.AutoMirrored.Filled.Backspace,
                                contentDescription = "Delete",
                                modifier = Modifier.size(24.dp),
                                tint = motoBlack
                            )
                        } else if (key.isNotEmpty()) {
                            Text(key, fontSize = 28.sp, fontWeight = FontWeight.Medium, color = motoBlack)
                        }
                    }
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        Spacer(modifier = Modifier.weight(1f))
    }
}
