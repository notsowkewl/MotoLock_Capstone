package com.example.motolock

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import kotlinx.coroutines.launch

@Composable
fun ForgotPasswordScreen(onBack: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var sent by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }

    val coroutineScope = rememberCoroutineScope()

    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val inputBg = Color.White.copy(alpha = 0.92f)
    val textGray = Color(0xFF737987)

    val bgBrush = Brush.linearGradient(
        colors = listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF))
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(bgBrush)
            .padding(horizontal = 24.dp, vertical = 22.dp)
    ) {
        // Topbar
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(Color.White.copy(alpha = 0.88f), RoundedCornerShape(14.dp))
                    .border(1.dp, lineCol, RoundedCornerShape(14.dp))
                    .shadow(18.dp, RoundedCornerShape(14.dp), spotColor = Color(0xFF0F172A).copy(alpha = 0.05f))
                    .clickable { onBack() },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp), tint = motoBlack)
            }
        }

        Spacer(modifier = Modifier.height(30.dp))

        // Screen Title
        Column(modifier = Modifier.fillMaxWidth()) {
            Text("Reset Password", fontSize = 28.sp, fontWeight = FontWeight.Black, color = motoBlack, letterSpacing = (-0.04).sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                if (sent) "If an account can be recovered, a secure reset link has been sent. Open it on this device to choose a new password." else "Enter your email and we'll send you a link to reset your password.",
                fontSize = 13.sp, color = textGray, lineHeight = 18.sp
            )
        }

        Spacer(modifier = Modifier.height(40.dp))

        Column(modifier = Modifier.fillMaxWidth()) {
            Text("Email Address", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
            Spacer(modifier = Modifier.height(7.dp))
            BasicTextField(
                value = email,
                onValueChange = { email = it },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                textStyle = TextStyle(fontSize = 13.sp, color = motoBlack),
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(47.dp)
                    .background(inputBg, RoundedCornerShape(14.dp))
                    .border(1.dp, lineCol, RoundedCornerShape(14.dp))
                    .padding(horizontal = 14.dp, vertical = 14.dp)
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        if (message != null) Text(message!!, color = motoRed, fontSize = 12.sp)

        Button(
            enabled = !isLoading && !sent,
            onClick = {
                if (email.isBlank()) {
                    message = "Please enter your email."
                    return@Button
                }
                isLoading = true
                coroutineScope.launch {
                    try {
                        SupabaseClientManager.client.auth.resetPasswordForEmail(email)
                        sent = true
                    } catch (e: Exception) {
                        message = e.message?.take(180) ?: "Could not send reset link. Try again."
                    } finally {
                        isLoading = false
                    }
                }
            },
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
                if (isLoading) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                } else {
                    Text("Send Reset Link", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White)
                }
            }
        }
        if (sent) {
            Spacer(modifier = Modifier.height(16.dp))
            Text("Open the link from your email on this phone. The app will open the password recovery screen.", color = textGray, fontSize = 13.sp)
        }
    }
}
