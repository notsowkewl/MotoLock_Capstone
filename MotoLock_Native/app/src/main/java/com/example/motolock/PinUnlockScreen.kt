package com.example.motolock

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Backspace
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import kotlinx.coroutines.launch

@Composable
fun PinUnlockScreen(onUnlockSuccess: () -> Unit, onLogout: () -> Unit) {
    var pin by remember { mutableStateOf("") }
    var isChecking by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var failedAttempts by remember { mutableIntStateOf(0) }
    var showPinRecovery by remember { mutableStateOf(false) }
    var recoveryEmail by remember { mutableStateOf("") }
    var recoveryCode by remember { mutableStateOf("") }
    var recoveryPin by remember { mutableStateOf("") }
    var recoveryConfirmPin by remember { mutableStateOf("") }
    var recoveryCodeSent by remember { mutableStateOf(false) }
    var recoveryLoading by remember { mutableStateOf(false) }
    var recoveryError by remember { mutableStateOf<String?>(null) }
    
    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val bgBrush = Brush.linearGradient(
        colors = listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF))
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(bgBrush)
            .padding(horizontal = 24.dp, vertical = 60.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("Enter PIN", fontSize = 28.sp, fontWeight = FontWeight.Black, color = motoBlack)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Enter your MotoLock PIN to continue", color = Color(0xFF737987), fontSize = 15.sp)
        
        Spacer(modifier = Modifier.height(40.dp))
        
        Row(
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            for (i in 0 until 4) {
                val isFilled = i < pin.length
                Box(
                    modifier = Modifier
                        .size(18.dp)
                        .clip(CircleShape)
                        .border(2.dp, motoBlack, CircleShape)
                        .background(if (isFilled) motoBlack else Color.Transparent)
                )
            }
        }
        
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
        
        if (isChecking) {
            CircularProgressIndicator(color = motoRed)
            Spacer(modifier = Modifier.weight(1f))
            return@Column
        }
        
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
                            .clickable(enabled = key.isNotEmpty() && !isChecking) {
                                errorMessage = null
                                if (key == "DEL") {
                                    if (pin.isNotEmpty()) pin = pin.dropLast(1)
                                } else {
                                    if (pin.length < 4) {
                                        pin += key
                                        if (pin.length == 4) {
                                            isChecking = true
                                            coroutineScope.launch {
                                                try {
                                                    val authUser = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
                                                    if (authUser != null) {
                                                        val hasPin = com.example.motolock.data.RiderPinRepository.hasPin()
                                                        if (!hasPin) {
                                                            onUnlockSuccess()
                                                        } else if (com.example.motolock.data.RiderPinRepository.verifyPin(pin)) {
                                                            onUnlockSuccess()
                                                        } else {
                                                                failedAttempts++
                                                                if (failedAttempts >= 5) {
                                                                    // Lockout: Save flag to SharedPreferences, then sign out
                                                                    val prefs = context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE)
                                                                    prefs.edit().putBoolean("reset_pin_for_${authUser.id}", true).apply()
                                                                    
                                                                    try {
                                                                        SupabaseClientManager.client.auth.signOut()
                                                                    } catch(e: Exception) {}
                                                                    onLogout()
                                                                } else {
                                                                    errorMessage = "Incorrect PIN."
                                                                    pin = ""
                                                                    isChecking = false
                                                                }
                                                        }
                                                    } else {
                                                        errorMessage = "Session expired."
                                                        isChecking = false
                                                    }
                                                } catch (e: Exception) {
                                                    errorMessage = "Error checking PIN."
                                                    pin = ""
                                                    isChecking = false
                                                }
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
        
        TextButton(onClick = { 
            coroutineScope.launch {
                try {
                    SupabaseClientManager.client.auth.signOut()
                } catch(e: Exception) {}
                onLogout()
            }
        }) {
            Text("Logout", color = motoRed, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        }
        TextButton(onClick = {
            recoveryEmail = SupabaseClientManager.client.auth.currentSessionOrNull()?.user?.email.orEmpty()
            recoveryError = null
            showPinRecovery = true
        }) {
            Text("Forgot PIN? Recover by email", color = Color(0xFF737987), fontSize = 14.sp)
        }
    }

    if (showPinRecovery) {
        AlertDialog(
            onDismissRequest = { if (!recoveryLoading) showPinRecovery = false },
            title = { Text(if (recoveryCodeSent) "Reset rider PIN" else "Recover rider PIN") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("We will send a recovery code if this email belongs to a MotoLock account.", fontSize = 13.sp)
                    OutlinedTextField(
                        value = recoveryEmail,
                        onValueChange = { recoveryEmail = it },
                        label = { Text("Email") },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
                    )
                    if (recoveryCodeSent) {
                        OutlinedTextField(
                            value = recoveryCode,
                            onValueChange = { recoveryCode = it.filter(Char::isDigit).take(6) },
                            label = { Text("6-digit recovery code") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                        )
                        OutlinedTextField(
                            value = recoveryPin,
                            onValueChange = { recoveryPin = it.filter(Char::isDigit).take(4) },
                            label = { Text("New 4-digit PIN") },
                            singleLine = true,
                            visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword)
                        )
                        OutlinedTextField(
                            value = recoveryConfirmPin,
                            onValueChange = { recoveryConfirmPin = it.filter(Char::isDigit).take(4) },
                            label = { Text("Confirm new PIN") },
                            singleLine = true,
                            visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword)
                        )
                    }
                    if (recoveryError != null) Text(recoveryError!!, color = motoRed, fontSize = 12.sp)
                }
            },
            confirmButton = {
                TextButton(enabled = !recoveryLoading, onClick = {
                    if (!recoveryCodeSent && recoveryEmail.isBlank()) {
                        recoveryError = "Enter your email address."
                        return@TextButton
                    }
                    if (recoveryCodeSent) {
                        if (recoveryCode.length != 6 || recoveryPin.length != 4 || recoveryConfirmPin.length != 4) {
                            recoveryError = "Enter the 6-digit code and both 4-digit PIN fields."
                            return@TextButton
                        }
                        if (recoveryPin != recoveryConfirmPin) {
                            recoveryError = "The PINs do not match."
                            return@TextButton
                        }
                    }
                    recoveryLoading = true
                    recoveryError = null
                    coroutineScope.launch {
                        try {
                            if (!recoveryCodeSent) {
                                com.example.motolock.data.PinRecoveryRepository.requestCode(recoveryEmail)
                                recoveryCodeSent = true
                                recoveryError = "If the account is registered, a recovery code has been sent."
                            } else {
                                com.example.motolock.data.PinRecoveryRepository.complete(recoveryEmail, recoveryCode, recoveryPin)
                                showPinRecovery = false
                                recoveryCodeSent = false
                                failedAttempts = 0
                                pin = ""
                                errorMessage = "PIN reset. Sign in with your new PIN."
                            }
                        } catch (e: Exception) {
                            recoveryError = e.message ?: "PIN recovery failed. Request a new code and try again."
                        } finally {
                            recoveryLoading = false
                        }
                    }
                }) {
                    if (recoveryLoading) CircularProgressIndicator(modifier = Modifier.size(18.dp))
                    else Text(if (recoveryCodeSent) "Reset PIN" else "Send Code", color = motoRed)
                }
            },
            dismissButton = {
                TextButton(enabled = !recoveryLoading, onClick = { showPinRecovery = false }) { Text("Cancel") }
            }
        )
    }
}

