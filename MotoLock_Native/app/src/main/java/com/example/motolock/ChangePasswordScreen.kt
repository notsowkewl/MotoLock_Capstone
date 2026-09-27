package com.example.motolock

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import kotlinx.coroutines.launch
import kotlinx.serialization.json.jsonPrimitive

@Composable
fun ChangePasswordScreen(onBack: () -> Unit) {
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    
    var showCurrent by remember { mutableStateOf(false) }
    var showNew by remember { mutableStateOf(false) }
    var showConfirm by remember { mutableStateOf(false) }

    var isLoading by remember { mutableStateOf(true) }
    var isSaving by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var isGoogleAccount by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        try {
            val session = SupabaseClientManager.client.auth.currentSessionOrNull()
            val appMetadata = session?.user?.appMetadata
            // Check if provider is google
            val provider = appMetadata?.get("provider")?.jsonPrimitive?.content
            if (provider == "google") {
                isGoogleAccount = true
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isLoading = false
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F8FA))
            .padding(24.dp)
    ) {
        // Back Button
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

        // Icon Header
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier.size(64.dp).background(motoRed.copy(alpha = 0.05f), RoundedCornerShape(32.dp)).border(1.dp, motoRed.copy(alpha = 0.2f), RoundedCornerShape(32.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Lock, contentDescription = null, tint = motoRed, modifier = Modifier.size(28.dp))
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        Text("Change Password", fontSize = 24.sp, fontWeight = FontWeight.Black, color = motoBlack, modifier = Modifier.align(Alignment.CenterHorizontally))
        Spacer(modifier = Modifier.height(6.dp))
        Text("Enter your current password and create a new one.", fontSize = 13.sp, color = Color(0xFF737987), modifier = Modifier.align(Alignment.CenterHorizontally))

        Spacer(modifier = Modifier.height(32.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = motoRed)
            }
        } else if (isGoogleAccount) {
            Box(modifier = Modifier.fillMaxWidth().background(Color(0xFFF3F4F6), RoundedCornerShape(12.dp)).padding(20.dp), contentAlignment = Alignment.Center) {
                Text(
                    text = "You are currently signed in using your Google Account. Password changes should be managed directly through Google Security Settings.",
                    fontSize = 13.sp,
                    color = Color(0xFF737987),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                    lineHeight = 20.sp
                )
            }
        } else {
            // Inputs
            Text("Current Password", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = motoBlack)
            Spacer(modifier = Modifier.height(6.dp))
            PasswordField(value = currentPassword, onValueChange = { currentPassword = it }, placeholder = "Enter current password", show = showCurrent, onToggle = { showCurrent = !showCurrent })
            
            Spacer(modifier = Modifier.height(8.dp))
            Text("Forgot current password?", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = motoRed, modifier = Modifier.align(Alignment.End).clickable {})

            Spacer(modifier = Modifier.height(16.dp))

            Text("New Password", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = motoBlack)
            Spacer(modifier = Modifier.height(6.dp))
            PasswordField(value = newPassword, onValueChange = { newPassword = it }, placeholder = "Enter new password", show = showNew, onToggle = { showNew = !showNew })

            Spacer(modifier = Modifier.height(16.dp))

            Text("Confirm New Password", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = motoBlack)
            Spacer(modifier = Modifier.height(6.dp))
            PasswordField(value = confirmPassword, onValueChange = { confirmPassword = it }, placeholder = "Confirm new password", show = showConfirm, onToggle = { showConfirm = !showConfirm })

            Spacer(modifier = Modifier.height(24.dp))

            if (message != null) {
                Text(message!!, color = if (message!!.contains("Success")) Color(0xFF10B981) else motoRed, fontSize = 13.sp, modifier = Modifier.padding(bottom = 12.dp))
            }

            Button(
                onClick = {
                    if (newPassword != confirmPassword) {
                        message = "New passwords do not match."
                        return@Button
                    }
                    isSaving = true
                    scope.launch {
                        try {
                            SupabaseClientManager.client.auth.modifyUser {
                                password = newPassword
                            }
                            message = "Success: Password updated."
                            currentPassword = ""; newPassword = ""; confirmPassword = ""
                        } catch (e: Exception) {
                            message = "Error: ${e.message}"
                        } finally {
                            isSaving = false
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().height(52.dp),
                colors = ButtonDefaults.buttonColors(containerColor = motoRed),
                shape = RoundedCornerShape(12.dp)
            ) {
                if (isSaving) CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                else Text("Update Password", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }
}

@Composable
fun PasswordField(value: String, onValueChange: (String) -> Unit, placeholder: String, show: Boolean, onToggle: () -> Unit) {
    val lineCol = Color(0xFFE8EBF0)
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        visualTransformation = if (show) VisualTransformation.None else PasswordVisualTransformation(),
        textStyle = TextStyle(fontSize = 14.sp, color = Color.Black),
        singleLine = true,
        decorationBox = { innerTextField ->
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .background(Color.White, RoundedCornerShape(12.dp))
                    .border(1.dp, lineCol, RoundedCornerShape(12.dp))
                    .padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(modifier = Modifier.weight(1f)) {
                    if (value.isEmpty()) Text(placeholder, color = Color(0xFFB0B5C1), fontSize = 14.sp)
                    innerTextField()
                }
                Icon(
                    imageVector = if (show) Icons.Outlined.Visibility else Icons.Outlined.VisibilityOff,
                    contentDescription = null,
                    tint = Color(0xFFB0B5C1),
                    modifier = Modifier.size(20.dp).clickable { onToggle() }
                )
            }
        }
    )
}

