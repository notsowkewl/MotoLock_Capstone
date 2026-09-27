package com.example.motolock

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Dialpad
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch

@Composable
fun SecurityPinScreen(onBack: () -> Unit) {
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    
    var currentPin by remember { mutableStateOf("") }
    var newPin by remember { mutableStateOf("") }
    var confirmPin by remember { mutableStateOf("") }

    var isLoading by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F8FA))
            .padding(24.dp)
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .background(Color.White, RoundedCornerShape(12.dp))
                .border(1.dp, lineCol, RoundedCornerShape(12.dp))
                .clickable { onBack() },
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp), tint = Color(0xFF101217))
        }

        Spacer(modifier = Modifier.height(24.dp))

        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier.size(64.dp).background(motoRed.copy(alpha = 0.05f), RoundedCornerShape(32.dp)).border(1.dp, motoRed.copy(alpha = 0.2f), RoundedCornerShape(32.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Dialpad, contentDescription = null, tint = motoRed, modifier = Modifier.size(28.dp))
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        Text("Security PIN", fontSize = 24.sp, fontWeight = FontWeight.Black, color = motoBlack, modifier = Modifier.align(Alignment.CenterHorizontally))
        Spacer(modifier = Modifier.height(6.dp))
        Text("Update your 4-digit PIN used for fallback verification.", fontSize = 13.sp, color = Color(0xFF737987), modifier = Modifier.align(Alignment.CenterHorizontally))

        Spacer(modifier = Modifier.height(32.dp))

        Text("Current PIN", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = motoBlack)
        Spacer(modifier = Modifier.height(6.dp))
        PinField(value = currentPin, onValueChange = { if (it.length <= 4) currentPin = it }, placeholder = "Enter current PIN")
        
        Spacer(modifier = Modifier.height(16.dp))

        Text("New PIN", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = motoBlack)
        Spacer(modifier = Modifier.height(6.dp))
        PinField(value = newPin, onValueChange = { if (it.length <= 4) newPin = it }, placeholder = "Enter new 4-digit PIN")

        Spacer(modifier = Modifier.height(16.dp))

        Text("Confirm New PIN", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = motoBlack)
        Spacer(modifier = Modifier.height(6.dp))
        PinField(value = confirmPin, onValueChange = { if (it.length <= 4) confirmPin = it }, placeholder = "Confirm new PIN")

        Spacer(modifier = Modifier.height(24.dp))

        if (message != null) {
            Text(message!!, color = if (message!!.contains("Success")) Color(0xFF10B981) else motoRed, fontSize = 13.sp, modifier = Modifier.padding(bottom = 12.dp))
        }

        Button(
            onClick = {
                if (newPin.length != 4 || confirmPin.length != 4) {
                    message = "PIN must be exactly 4 digits."
                    return@Button
                }
                if (newPin != confirmPin) {
                    message = "New PINs do not match."
                    return@Button
                }
                isLoading = true
                scope.launch {
                    try {
                        val session = SupabaseClientManager.client.auth.currentSessionOrNull()
                        val userId = session?.user?.id
                        if (userId != null) {
                            // Fetch existing PIN
                            val existingPins = SupabaseClientManager.client.postgrest["pins"]
                                .select { filter { eq("user_id", userId) } }
                                .decodeList<com.example.motolock.models.Pin>()
                            
                            if (existingPins.isNotEmpty()) {
                                if (existingPins.first().pin != currentPin) {
                                    message = "Current PIN is incorrect."
                                    isLoading = false
                                    return@launch
                                }
                                // Update PIN
                                SupabaseClientManager.client.postgrest["pins"]
                                    .update({ set("pin", newPin) }) { filter { eq("user_id", userId) } }
                            } else {
                                // No PIN exists, just insert
                                val pinObj = com.example.motolock.models.Pin(userId = userId, pin = newPin)
                                SupabaseClientManager.client.postgrest["pins"].insert(pinObj)
                            }
                            message = "Success: PIN updated."
                            currentPin = ""; newPin = ""; confirmPin = ""
                        } else {
                            message = "User not logged in."
                        }
                    } catch (e: Exception) {
                        message = "Error: ${e.message}"
                    } finally {
                        isLoading = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = motoRed),
            shape = RoundedCornerShape(12.dp)
        ) {
            if (isLoading) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
            else Text("Update PIN", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
    }
}

@Composable
fun PinField(value: String, onValueChange: (String) -> Unit, placeholder: String) {
    val lineCol = Color(0xFFE8EBF0)
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        visualTransformation = PasswordVisualTransformation(),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        textStyle = TextStyle(fontSize = 14.sp, color = Color.Black),
        singleLine = true,
        decorationBox = { innerTextField ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .background(Color.White, RoundedCornerShape(12.dp))
                    .border(1.dp, lineCol, RoundedCornerShape(12.dp))
                    .padding(horizontal = 14.dp),
                contentAlignment = Alignment.CenterStart
            ) {
                if (value.isEmpty()) Text(placeholder, color = Color(0xFFB0B5C1), fontSize = 14.sp)
                innerTextField()
            }
        }
    )
}

