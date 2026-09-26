package com.example.motolock

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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.models.Pin
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch

@Composable
fun PinUnlockScreen(onUnlockSuccess: () -> Unit, onLogout: () -> Unit) {
    var pin by remember { mutableStateOf("") }
    var isChecking by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    
    val coroutineScope = rememberCoroutineScope()
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
                                                        var finalUserId = authUser.id
                                                        var userProfile = SupabaseClientManager.client.postgrest["users"]
                                                            .select { filter { eq("id", authUser.id) } }
                                                            .decodeSingleOrNull<com.example.motolock.models.User>()

                                                        if (userProfile == null && authUser.email != null) {
                                                            userProfile = SupabaseClientManager.client.postgrest["users"]
                                                                .select { filter { eq("email", authUser.email!!) } }
                                                                .decodeList<com.example.motolock.models.User>().firstOrNull()
                                                        }
                                                        if (userProfile != null) {
                                                            finalUserId = userProfile.id
                                                        }
                                                        
                                                        val savedPins = SupabaseClientManager.client.postgrest["pins"]
                                                            .select { filter { eq("user_id", finalUserId) } }
                                                            .decodeList<Pin>()
                                                            
                                                        if (savedPins.isEmpty()) {
                                                            // No PIN saved at all, let them through to dashboard where they can finish setup
                                                            // Or they could be prompted to create one, but for now we'll pass them to the app.
                                                            onUnlockSuccess()
                                                        } else {
                                                            if (savedPins.any { it.pin == pin }) {
                                                                onUnlockSuccess()
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
            Text("Logout", color = motoRed)
        }
    }
}
