package com.example.motolock

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Icon
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
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.models.User
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.providers.builtin.Email
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import java.util.UUID

@Composable
fun CreateAccountScreen(onBack: () -> Unit, onNext: () -> Unit) {
    var fullName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var termsAccepted by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var showTerms by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current

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
            .verticalScroll(rememberScrollState())
    ) {
        // Topbar removed as requested

        Spacer(modifier = Modifier.height(22.dp))

        // Screen Title
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Text("Create Rider Account", fontSize = 22.sp, fontWeight = FontWeight.Black, color = motoBlack, letterSpacing = (-0.04).sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "Create your account first, then complete Face ID, PIN, contacts, motorcycle, and device setup.",
                fontSize = 13.sp, color = textGray, lineHeight = 18.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }

        Spacer(modifier = Modifier.height(30.dp))

        // Form Fields
        CustomTextField("Full Name", "Enter full name", fullName) { fullName = it }
        Spacer(modifier = Modifier.height(13.dp))
        CustomTextField("Email", "Enter email", email, KeyboardType.Email) { email = it }
        Spacer(modifier = Modifier.height(13.dp))
        CustomTextField("Password", "Enter password", password, KeyboardType.Password, true) { password = it }
        Spacer(modifier = Modifier.height(13.dp))
        CustomTextField("Confirm Password", "Confirm password", confirmPassword, KeyboardType.Password, true) { confirmPassword = it }

        Spacer(modifier = Modifier.height(20.dp))

        // Checkbox row
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(
                checked = termsAccepted,
                onCheckedChange = { termsAccepted = it },
                colors = CheckboxDefaults.colors(checkedColor = motoRed)
            )
            Text("I agree to the ", fontSize = 11.sp, color = textGray)
            Text("Terms & Privacy", fontSize = 11.sp, color = motoRed, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { showTerms = true })
        }
        
        if (showTerms) {
            androidx.compose.ui.window.Dialog(onDismissRequest = { showTerms = false }) {
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = Color.White,
                    modifier = Modifier.fillMaxWidth().padding(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Terms & Privacy", fontSize = 20.sp, fontWeight = FontWeight.Black, color = motoBlack)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(

                            "1. Rider Responsibility\nThe rider is responsible for using MotoLock properly and honestly. The system is designed to support rider safety before motorcycle use.\n\n" +
                            "2. Identity Verification\nThe rider must complete Face ID verification before unlocking your motorcycle. MotoLock may require both no-helmet and with-helmet verification to confirm the registered rider.\n\n" +
                            "3. Sobriety Test Requirement\nThe rider must complete the alcohol detection test using the helmet sensor. Motorcycle ignition will only be allowed if the rider passes the sobriety check.\n\n" +
                            "4. Alcohol Detection and Ignition Lock\nIf alcohol is detected above the allowed limit, MotoLock will lock the ignition and prevent the rider from starting the motorcycle for safety reasons.\n\n" +
                            "5. Emergency Alerts\nIn safety-related situations, such as alcohol detection or ignition lock events, MotoLock may send alerts to the rider's registered emergency contacts.\n\n" +
                            "6. Device and Bluetooth Connection\nThe rider must ensure that the MotoLock hardware is properly connected through Bluetooth before using the system. Pairing a new device may replace the current connected hardware.\n\n" +
                            "7. System Limitations\nMotoLock is a safety support system and should not replace responsible riding behavior. The rider should not attempt to bypass verification or ignition lock features.\n\n" +
                            "8. Agreement\nBy using MotoLock, the rider agrees to follow the system's safety process, provide accurate information, and accept the app's identity and sobriety verification requirements.",
                            fontSize = 11.sp, color = textGray, lineHeight = 16.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Start,
                            modifier = Modifier.fillMaxHeight(0.6f).verticalScroll(rememberScrollState())
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(
                            onClick = { 
                                  showTerms = false 
                                  termsAccepted = true
                              },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = motoRed),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("I Accept", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Create Account Button
        Button(
            onClick = {
                if (fullName.isBlank() || email.isBlank() || password.isBlank()) {
                    Toast.makeText(context, "Please fill in all fields", Toast.LENGTH_SHORT).show()
                    return@Button
                }
                if (password != confirmPassword) {
                    Toast.makeText(context, "Passwords do not match", Toast.LENGTH_SHORT).show()
                    return@Button
                }
                if (!termsAccepted) {
                    Toast.makeText(context, "Please accept terms", Toast.LENGTH_SHORT).show()
                    return@Button
                }

                isLoading = true
                coroutineScope.launch {
                    try {
                        SupabaseClientManager.client.auth.signUpWith(Email) {
                            this.email = email
                            this.password = password
                        }
                        
                        val userId = SupabaseClientManager.client.auth.currentSessionOrNull()?.user?.id ?: UUID.randomUUID().toString()
                        
                        // Profile is now automatically created by the Supabase backend trigger on_auth_user_created.
                        // No client-side insertion needed.
                        
                        onNext()
                    } catch (e: Exception) {
                        val errorMsg = e.message?.lowercase() ?: ""
                        if (errorMsg.contains("already registered") || errorMsg.contains("user already exists")) {
                            Toast.makeText(context, "This email is already registered.", Toast.LENGTH_LONG).show()
                        } else {
                            Toast.makeText(context, "Registration Failed. Please try again later.", Toast.LENGTH_LONG).show()
                        }
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
                    Text("Create Account", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White)
                }
            }
        }
        
        Spacer(modifier = Modifier.height(20.dp))
        
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            Text("Already have an account? ", fontSize = 12.sp, color = textGray)
            Text("Login", fontSize = 12.sp, color = motoRed, fontWeight = FontWeight.Black, modifier = Modifier.clickable { onBack() })
        }
    }
}

@Composable
fun CustomTextField(
    label: String, 
    placeholder: String, 
    value: String, 
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false,
    onValueChange: (String) -> Unit
) {
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val inputBg = Color.White.copy(alpha = 0.92f)
    var passwordVisible by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
        Spacer(modifier = Modifier.height(7.dp))
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            visualTransformation = if (isPassword && !passwordVisible) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
            textStyle = TextStyle(fontSize = 13.sp, color = motoBlack),
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .height(47.dp)
                .background(inputBg, RoundedCornerShape(14.dp))
                .border(1.dp, lineCol, RoundedCornerShape(14.dp)),
            decorationBox = { innerTextField ->
                Row(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(modifier = Modifier.weight(1f)) {
                        innerTextField()
                    }
                    if (isPassword) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                            contentDescription = "Toggle Password Visibility",
                            tint = Color(0xFFED1C24),
                            modifier = Modifier.size(24.dp).clickable { passwordVisible = !passwordVisible }.padding(start = 4.dp)
                        )
                    }
                }
            }
        )
    }
}


