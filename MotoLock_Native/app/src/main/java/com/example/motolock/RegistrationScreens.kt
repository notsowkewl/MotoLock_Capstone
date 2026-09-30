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
import androidx.compose.material.icons.filled.Close
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
    var privacyAccepted by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var showTerms by remember { mutableStateOf(false) }
    var showPrivacy by remember { mutableStateOf(false) }
    
    var fullNameError by remember { mutableStateOf<String?>(null) }
    var emailError by remember { mutableStateOf<String?>(null) }
    var passwordError by remember { mutableStateOf<String?>(null) }
    var confirmPasswordError by remember { mutableStateOf<String?>(null) }
    var termsError by remember { mutableStateOf<String?>(null) }
    var authError by remember { mutableStateOf<String?>(null) }

    val coroutineScope = rememberCoroutineScope()

    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val inputBg = Color.White.copy(alpha = 0.92f)
    val textGray = Color(0xFF737987)

    Column(
        modifier = Modifier.fillMaxSize().background(Color(0xFFF7F8FA)).padding(horizontal = 28.dp).verticalScroll(rememberScrollState())
    ) {
        Spacer(modifier = Modifier.height(48.dp))

        Box(
            modifier = Modifier.size(44.dp).background(Color.White.copy(alpha = 0.88f), RoundedCornerShape(14.dp)).border(1.dp, lineCol, RoundedCornerShape(14.dp)).clickable { onBack() },
            contentAlignment = Alignment.Center
        ) { Icon(Icons.Default.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp), tint = motoBlack) }

        Spacer(modifier = Modifier.height(32.dp))

        Text("Create Account", fontSize = 28.sp, fontWeight = FontWeight.Black, color = motoBlack, letterSpacing = (-0.5).sp)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Join MotoLock to secure your ride and ensure safety.", fontSize = 13.sp, color = textGray, lineHeight = 20.sp)

        Spacer(modifier = Modifier.height(36.dp))

        CustomTextField(
            label = "Full Name", 
            placeholder = "Enter your full name", 
            value = fullName, 
            error = fullNameError,
            onValueChange = { fullName = it; fullNameError = null }
        )
        Spacer(modifier = Modifier.height(16.dp))
        
        CustomTextField(
            label = "Email Address", 
            placeholder = "name@example.com", 
            value = email, 
            keyboardType = KeyboardType.Email,
            error = emailError,
            onValueChange = { email = it; emailError = null }
        )
        Spacer(modifier = Modifier.height(16.dp))
        
        CustomTextField(
            label = "Password", 
            placeholder = "Create a strong password", 
            value = password, 
            isPassword = true,
            error = passwordError,
            onValueChange = { password = it; passwordError = null }
        )
        Spacer(modifier = Modifier.height(16.dp))
        
        CustomTextField(
            label = "Confirm Password", 
            placeholder = "Repeat your password", 
            value = confirmPassword, 
            isPassword = true,
            error = confirmPasswordError,
            onValueChange = { confirmPassword = it; confirmPasswordError = null }
        )

        Spacer(modifier = Modifier.height(20.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(
                checked = termsAccepted,
                onCheckedChange = { termsAccepted = it; termsError = null },
                colors = CheckboxDefaults.colors(checkedColor = motoRed)
            )
            Text("I agree to the ", fontSize = 11.sp, color = textGray)
            Text("Terms and Conditions", fontSize = 11.sp, color = motoRed, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { showTerms = true })
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(
                checked = privacyAccepted,
                onCheckedChange = { privacyAccepted = it; termsError = null },
                colors = CheckboxDefaults.colors(checkedColor = motoRed)
            )
            Text("I consent to the ", fontSize = 11.sp, color = textGray)
            Text("Privacy Policy", fontSize = 11.sp, color = motoRed, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { showPrivacy = true })
        }
        if (termsError != null) {
            Text(termsError!!, color = motoRed, fontSize = 11.sp, modifier = Modifier.padding(start = 12.dp))
        }

        if (showTerms) {
            androidx.compose.ui.window.Dialog(onDismissRequest = { showTerms = false }) {
                Surface(shape = RoundedCornerShape(18.dp), color = Color.White, modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    Column(modifier = Modifier.padding(24.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Terms and Conditions", fontSize = 20.sp, fontWeight = FontWeight.Black, color = motoBlack)
                            Icon(Icons.Default.Close, contentDescription = "Close", modifier = Modifier.clickable { showTerms = false }, tint = motoBlack)
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            "Read the rules and safety agreement for using MotoLock.\n\n" +
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
                        Button(onClick = { showTerms = false; termsAccepted = true }, modifier = Modifier.fillMaxWidth().height(48.dp), colors = ButtonDefaults.buttonColors(containerColor = motoRed), shape = RoundedCornerShape(12.dp)) {
                            Text("I Accept", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
        
        if (showPrivacy) {
            androidx.compose.ui.window.Dialog(onDismissRequest = { showPrivacy = false }) {
                Surface(shape = RoundedCornerShape(18.dp), color = Color.White, modifier = Modifier.fillMaxWidth().padding(16.dp)) {
                    Column(modifier = Modifier.padding(24.dp)) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                            Text("Privacy Policy", fontSize = 20.sp, fontWeight = FontWeight.Black, color = motoBlack)
                            Icon(Icons.Default.Close, contentDescription = "Close", modifier = Modifier.clickable { showPrivacy = false }, tint = motoBlack)
                        }
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            "Learn how MotoLock handles rider data, device information, and safety records.\n\n" +
                            "1. Information We Collect\nMotoLock may collect rider account details such as full name, email address, phone number, motorcycle information, emergency contacts, Face ID registration data, Bluetooth device status, and ride safety logs.\n\n" +
                            "2. How We Use Your Data\nThe collected information is used to verify rider identity, connect the MotoLock hardware, manage emergency contacts, monitor safety checks, and record ride history for security and accountability.\n\n" +
                            "3. Face ID and Verification\nFace ID is used only for rider identity verification before unlocking your motorcycle. It helps confirm that the registered rider is the one attempting to access the motorcycle.\n\n" +
                            "4. Emergency Contacts\nEmergency contact details are used only when safety alerts are triggered, such as alcohol detection, ignition lock events, or emergency notifications.\n\n" +
                            "5. Ride and Safety Logs\nMotoLock stores ride history, Face ID verification results, helmet verification, BrAC readings, ignition status, and emergency alert records to support safety monitoring.\n\n" +
                            "6. Data Protection\nMotoLock aims to protect user data and only uses collected information for system security, rider safety, and emergency response purposes.",
                            fontSize = 11.sp, color = textGray, lineHeight = 16.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Start,
                            modifier = Modifier.fillMaxHeight(0.6f).verticalScroll(rememberScrollState())
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(onClick = { showPrivacy = false; privacyAccepted = true }, modifier = Modifier.fillMaxWidth().height(48.dp), colors = ButtonDefaults.buttonColors(containerColor = motoRed), shape = RoundedCornerShape(12.dp)) {
                            Text("I Accept", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        if (authError != null) {
            Text(authError!!, color = motoRed, fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
        }

        Button(
            onClick = {
                var hasError = false
                if (fullName.isBlank()) { fullNameError = "Please fill in this field"; hasError = true }
                if (email.isBlank()) { emailError = "Please fill in this field"; hasError = true }
                if (password.isBlank()) { passwordError = "Please fill in this field"; hasError = true }
                if (confirmPassword.isBlank()) { confirmPasswordError = "Please fill in this field"; hasError = true }
                if (password != confirmPassword && password.isNotBlank() && confirmPassword.isNotBlank()) {
                    confirmPasswordError = "Passwords do not match"
                    hasError = true
                }
                if (!termsAccepted || !privacyAccepted) {
                    termsError = "Please accept the Terms and Privacy Policy"
                    hasError = true
                }

                if (hasError) return@Button

                isLoading = true
                coroutineScope.launch {
                    try {
                        SupabaseClientManager.client.auth.signUpWith(Email) {
                            this.email = email
                            this.password = password
                        }
                        onNext()
                    } catch (e: Exception) {
                        val errorMsg = e.message?.lowercase() ?: ""
                        if (errorMsg.contains("already registered") || errorMsg.contains("user already exists")) {
                            authError = "This email is already registered."
                        } else {
                            authError = "Registration Failed. Please try again later."
                        }
                    } finally {
                        isLoading = false
                    }
                }
            },
            modifier = Modifier.fillMaxWidth().height(51.dp).shadow(28.dp, RoundedCornerShape(15.dp), spotColor = motoRed.copy(alpha = 0.22f)),
            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
            contentPadding = PaddingValues(0.dp),
            shape = RoundedCornerShape(15.dp)
        ) {
            Box(
                modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFFFF3038), motoRed)), RoundedCornerShape(15.dp)),
                contentAlignment = Alignment.Center
            ) {
                if (isLoading) { CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp)) } 
                else { Text("Create Account", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White) }
            }
        }
        
        Spacer(modifier = Modifier.height(20.dp))
        
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Center) {
            Text("Already have an account? ", fontSize = 12.sp, color = textGray)
            Text("Login", fontSize = 12.sp, color = motoRed, fontWeight = FontWeight.Black, modifier = Modifier.clickable { onBack() })
        }
        Spacer(modifier = Modifier.height(40.dp))
    }
}@Composable
fun CustomTextField(
    label: String, 
    placeholder: String, 
    value: String, 
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false,
    error: String? = null,
    onValueChange: (String) -> Unit
) {
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val inputBg = Color.White.copy(alpha = 0.92f)
    val motoRed = Color(0xFFED1C24)
    var passwordVisible by remember { mutableStateOf(false) }
    val borderColor = if (error != null) motoRed else lineCol

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
                .border(1.dp, borderColor, RoundedCornerShape(14.dp)),
            decorationBox = { innerTextField ->
                Row(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(modifier = Modifier.weight(1f)) {
                        if (value.isEmpty()) Text(placeholder, color = Color(0xFF737987).copy(alpha = 0.5f), fontSize = 13.sp)
                        innerTextField()
                    }
                    if (isPassword) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                            contentDescription = "Toggle Password Visibility",
                            tint = Color(0xFF737987),
                            modifier = Modifier.size(20.dp).clickable { passwordVisible = !passwordVisible }.padding(start = 4.dp)
                        )
                    }
                }
            }
        )
        if (error != null) {
            Text(error, color = motoRed, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp, start = 4.dp))
        }
    }
}

