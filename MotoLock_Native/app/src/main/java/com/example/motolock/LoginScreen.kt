package com.example.motolock

import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Icon
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.providers.builtin.Email
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException
import io.github.jan.supabase.gotrue.providers.Google
import io.github.jan.supabase.gotrue.SessionStatus

@Composable
fun LoginScreen(onLoginSuccess: () -> Unit, onSignUpClick: () -> Unit, onForgotClick: () -> Unit) {
        var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var emailError by remember { mutableStateOf<String?>(null) }
    var passwordError by remember { mutableStateOf<String?>(null) }
    var failedAttempts by remember { mutableIntStateOf(0) }
    var lockedOut by remember { mutableStateOf(false) }
    var showEmailSentDialog by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current
    val loginSuccess by rememberUpdatedState(onLoginSuccess)
    LaunchedEffect(Unit) {
                SupabaseClientManager.client.auth.sessionStatus.collect { status ->
            if (status is SessionStatus.Authenticated) {
                val user = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
                if (user != null) {
                    coroutineScope.launch {
                        try {
                            var finalUserId = user.id
                            val profile = SupabaseClientManager.client.postgrest["users"]
                                .select { filter { eq("id", user.id) } }
                                .decodeList<com.example.motolock.models.User>().firstOrNull()
                                ?: (user.email?.let {
                                    SupabaseClientManager.client.postgrest["users"]
                                        .select { filter { eq("email", it) } }
                                        .decodeList<com.example.motolock.models.User>().firstOrNull()
                                })
                            if (profile != null) finalUserId = profile.id
                            
                            val prefs = context.getSharedPreferences("MotoLockPrefs", android.content.Context.MODE_PRIVATE)
                            if (prefs.getBoolean("reset_pin_for_$finalUserId", false)) {
                                SupabaseClientManager.client.postgrest["pins"]
                                    .delete { filter { eq("user_id", finalUserId) } }
                                prefs.edit().remove("reset_pin_for_$finalUserId").apply()
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                        loginSuccess()
                    }
                } else {
                    loginSuccess()
                }
            }
        }
    }

    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val inputBg = Color.White.copy(alpha = 0.92f)

    val bgBrush = Brush.linearGradient(
        colors = listOf(Color(0xFFF8FAFC), Color(0xFFE9EDF5))
    )

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(bgBrush)
    ) {
        Box(
            modifier = Modifier
                .align(Alignment.TopStart)
                .offset(x = (-50).dp, y = (-20).dp)
                .size(250.dp)
                .background(Brush.radialGradient(colors = listOf(Color(0x1AED1C24), Color.Transparent)))
        )
        Box(
            modifier = Modifier
                .align(Alignment.TopEnd)
                .offset(x = 50.dp, y = 20.dp)
                .size(200.dp)
                .background(Brush.radialGradient(colors = listOf(Color(0x14ED1C24), Color.Transparent)))
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 24.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Image(
                painter = painterResource(id = R.drawable.logo),
                contentDescription = "MotoLock Logo",
                modifier = Modifier
                    .size(76.dp)
                    .shadow(32.dp, RoundedCornerShape(21.dp), spotColor = motoRed.copy(alpha = 0.12f))
                    .clip(RoundedCornerShape(21.dp))
            )

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = buildAnnotatedString {
                    withStyle(style = SpanStyle(color = motoBlack, fontWeight = FontWeight.Black)) { append("Moto") }
                    withStyle(style = SpanStyle(color = motoRed, fontWeight = FontWeight.Black)) { append("Lock") }
                },
                fontSize = 24.sp,
                letterSpacing = (-0.08).sp
            )

            Spacer(modifier = Modifier.height(4.dp))
            
            Spacer(modifier = Modifier.height(30.dp))

            Column(modifier = Modifier.fillMaxWidth()) {
                Text("Email", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
                Spacer(modifier = Modifier.height(7.dp))
                BasicTextField(
                    value = email,
                    onValueChange = { 
                        email = it
                        emailError = null
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    textStyle = TextStyle(fontSize = 13.sp, color = motoBlack),
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(47.dp)
                        .background(inputBg, RoundedCornerShape(14.dp))
                        .border(1.dp, if (emailError != null) Color.Red else lineCol, RoundedCornerShape(14.dp)),
                    decorationBox = { innerTextField ->
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(modifier = Modifier.weight(1f)) {
                                innerTextField()
                            }
                            Icon(
                                imageVector = Icons.Filled.Email,
                                contentDescription = "Email",
                                tint = Color.DarkGray,
                                modifier = Modifier.size(20.dp).padding(start = 6.dp)
                            )
                        }
                    }
                )
                if (emailError != null) {
                    Text(emailError!!, color = Color.Red, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
                }
            }

            Spacer(modifier = Modifier.height(13.dp))

            Column(modifier = Modifier.fillMaxWidth()) {
                Text("Password", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
                Spacer(modifier = Modifier.height(7.dp))
                BasicTextField(
                    value = password,
                    onValueChange = { 
                        password = it 
                        passwordError = null
                    },
                    visualTransformation = if (passwordVisible) androidx.compose.ui.text.input.VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    textStyle = TextStyle(fontSize = 13.sp, color = motoBlack),
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(47.dp)
                        .background(inputBg, RoundedCornerShape(14.dp))
                        .border(1.dp, if (passwordError != null) Color.Red else lineCol, RoundedCornerShape(14.dp)),
                    decorationBox = { innerTextField ->
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(modifier = Modifier.weight(1f)) {
                                innerTextField()
                            }
                            Icon(
                                imageVector = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                                contentDescription = "Toggle Password Visibility",
                                tint = Color.DarkGray,
                                modifier = Modifier.size(24.dp).clickable { passwordVisible = !passwordVisible }.padding(start = 4.dp)
                            )
                        }
                    }
                )
                if (passwordError != null) {
                    Text(passwordError!!, color = Color.Red, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
                }
                Spacer(modifier = Modifier.height(10.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    Text(
                        "Forgot Password?", 
                        fontSize = 11.sp, 
                        fontWeight = FontWeight.Black, 
                        color = motoRed,
                        modifier = Modifier.clickable { onForgotClick() }
                    )
                }
            }

            Spacer(modifier = Modifier.height(15.dp))

                        if (lockedOut) {
                Text(
                    text = "Too many failed attempts. Please reset your password.",
                    color = Color.Red,
                    fontSize = 12.sp,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp)
                )
                Button(
                                        onClick = {
                        if (email.isBlank()) { emailError = "Email is required"; return@Button }
                        isLoading = true
                        coroutineScope.launch {
                            try {
                                val userProfile = SupabaseClientManager.client.postgrest["users"]
                                    .select { filter { eq("email", email) } }
                                    .decodeList<com.example.motolock.models.User>()
                                    
                                if (userProfile.isEmpty()) {
                                    emailError = "This email is not registered in MotoLock."
                                } else {
                                    SupabaseClientManager.client.auth.resetPasswordForEmail(email)
                                    showEmailSentDialog = true
                                }
                            } catch (e: Exception) {
                                Toast.makeText(context, "Failed to send reset link", Toast.LENGTH_LONG).show()
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
            } else {
                Button(
                    onClick = {
                        var valid = true
                        if (email.isBlank()) { emailError = "Email is required"; valid = false }
                        if (password.isBlank()) { passwordError = "Password is required"; valid = false }
                        if (!valid) return@Button
                        
                        isLoading = true
                        coroutineScope.launch {
                            try {
                                SupabaseClientManager.client.auth.signInWith(Email) {
                                    this.email = email
                                    this.password = password
                                }
                            } catch (e: Exception) {
                                if (e.message?.contains("credentials") == true || e.message?.contains("invalid") == true) {
                                    failedAttempts++
                                    if (failedAttempts >= 5) {
                                        lockedOut = true
                                        passwordError = "Account locked out. Please reset password."
                                    } else {
                                        emailError = "Invalid email or password"
                                        passwordError = "Invalid email or password"
                                    }
                                } else {
                                    Toast.makeText(context, "Login Failed: ${e.message}", Toast.LENGTH_LONG).show()
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
                            Text("Login", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White)
                        }
                    }
                }
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Or divider
            Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Box(modifier = Modifier.weight(1f).height(1.dp).background(lineCol))
                Text(" OR ", fontSize = 11.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFFA1A8B3), modifier = Modifier.padding(horizontal = 8.dp))
                Box(modifier = Modifier.weight(1f).height(1.dp).background(lineCol))
            }
            
            Spacer(modifier = Modifier.height(12.dp))
            
            // Google Button
            Button(
                enabled = !isLoading,
                onClick = {
                    isLoading = true
                    coroutineScope.launch {
                        try {
                            SupabaseClientManager.client.auth.signInWith(Google)
                        } catch (e: CancellationException) {
                            throw e
                        } catch (e: Exception) {
                            Toast.makeText(context, "Could not start Google sign-in. Please try again.", Toast.LENGTH_LONG).show()
                        } finally {
                            isLoading = false
                        }
                    }
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(51.dp)
                    .shadow(10.dp, RoundedCornerShape(15.dp), spotColor = Color(0xFF0F172A).copy(alpha = 0.06f)),
                colors = ButtonDefaults.buttonColors(containerColor = Color.White),
                border = androidx.compose.foundation.BorderStroke(1.dp, lineCol),
                shape = RoundedCornerShape(15.dp)
            ) {
                Text("Continue with Google", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color(0xFF2F3440))
            }
            
            Spacer(modifier = Modifier.height(20.dp))
            
            Text(
                text = buildAnnotatedString {
                    withStyle(style = SpanStyle(color = Color(0xFF737987))) { append("Don't have an account? ") }
                    withStyle(style = SpanStyle(color = motoRed, fontWeight = FontWeight.Black)) { append("Sign Up") }
                },
                fontSize = 12.sp,
                modifier = Modifier.clickable {
                    // Navigate to Registration Screen
                    onSignUpClick()
                }
            )
        }
    }
    if (showEmailSentDialog) {
        AlertDialog(
            onDismissRequest = { showEmailSentDialog = false },
            title = { Text("Reset Link Sent", fontWeight = FontWeight.Bold) },
            text = { Text("Please check your email ($email) for instructions to reset your password.") },
            confirmButton = {
                TextButton(onClick = { showEmailSentDialog = false }) {
                    Text("OK", color = Color(0xFFED1C24))
                }
            }
        )
    }
}
