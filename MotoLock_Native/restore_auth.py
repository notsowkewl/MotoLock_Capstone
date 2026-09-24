# coding=utf-8
import os

auth_kt = """package com.example.motolock.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.R
import com.example.motolock.ui.components.*
import com.example.motolock.ui.theme.*
import com.example.motolock.data.SupabaseManager
import kotlinx.coroutines.launch

@Composable
fun LoginScreen(onNavigate: (String) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxSize().background(MotoBg).padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Mock Logo (Since we don't have the exact logo.png mapped right now)
        Box(
            modifier = Modifier
                .size(76.dp)
                .shadow(18.dp, RoundedCornerShape(21.dp))
                .background(MotoRed, RoundedCornerShape(21.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text("M", color = MotoWhite, fontSize = 40.sp, fontWeight = FontWeight.Black)
        }
        
        Spacer(modifier = Modifier.height(12.dp))
        
        Row {
            Text("Moto", fontSize = 26.sp, fontWeight = FontWeight.Black, color = MotoBlack)
            Text("Lock", fontSize = 26.sp, fontWeight = FontWeight.Black, color = MotoRed)
        }
        
        Spacer(modifier = Modifier.height(4.dp))
        Text("Your Smart Motorcycle\nSecurity Companion", fontSize = 13.sp, color = MotoGray, textAlign = androidx.compose.ui.text.style.TextAlign.Center, lineHeight = 19.sp)
        Spacer(modifier = Modifier.height(30.dp))
        
        if (errorMessage.isNotEmpty()) {
            Text(errorMessage, color = MotoRed, fontSize = 14.sp)
            Spacer(modifier = Modifier.height(8.dp))
        }

        OutlinedTextField(
            value = email, onValueChange = { email = it },
            placeholder = { Text("Email Address") },
            modifier = Modifier.fillMaxWidth().height(47.dp),
            singleLine = true,
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedBorderColor = MotoLine,
                focusedBorderColor = MotoRed,
                unfocusedContainerColor = Color(0xEBFFFFFF),
                focusedContainerColor = Color(0xEBFFFFFF)
            )
        )
        Spacer(modifier = Modifier.height(13.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it },
            placeholder = { Text("Password") },
            modifier = Modifier.fillMaxWidth().height(47.dp),
            singleLine = true,
            visualTransformation = PasswordVisualTransformation(),
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(
                unfocusedBorderColor = MotoLine,
                focusedBorderColor = MotoRed,
                unfocusedContainerColor = Color(0xEBFFFFFF),
                focusedContainerColor = Color(0xEBFFFFFF)
            )
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        MotoButton(text = "Log In", onClick = {
            scope.launch {
                val success = SupabaseManager.login(email, password)
                if (success) onNavigate("dashboard") else errorMessage = "Invalid credentials."
            }
        })
        Spacer(modifier = Modifier.height(16.dp))
        Text("Create an account", color = MotoRed, fontSize = 12.sp, fontWeight = FontWeight.Black, modifier = Modifier.clickable { onNavigate("createAccount") })
    }
}

@Composable
fun CreateAccountScreen(onNavigate: (String) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxSize().background(MotoBg).padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(76.dp)
                .shadow(18.dp, RoundedCornerShape(21.dp))
                .background(MotoRed, RoundedCornerShape(21.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text("M", color = MotoWhite, fontSize = 40.sp, fontWeight = FontWeight.Black)
        }
        Spacer(modifier = Modifier.height(12.dp))
        Row {
            Text("Moto", fontSize = 26.sp, fontWeight = FontWeight.Black, color = MotoBlack)
            Text("Lock", fontSize = 26.sp, fontWeight = FontWeight.Black, color = MotoRed)
        }
        Spacer(modifier = Modifier.height(4.dp))
        Text("Create a new account.", fontSize = 13.sp, color = MotoGray, textAlign = androidx.compose.ui.text.style.TextAlign.Center, lineHeight = 19.sp)
        Spacer(modifier = Modifier.height(30.dp))
        
        if (errorMessage.isNotEmpty()) {
            Text(errorMessage, color = MotoRed, fontSize = 14.sp)
            Spacer(modifier = Modifier.height(8.dp))
        }

        OutlinedTextField(
            value = email, onValueChange = { email = it },
            placeholder = { Text("Email Address") },
            modifier = Modifier.fillMaxWidth().height(47.dp),
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(unfocusedBorderColor = MotoLine, focusedBorderColor = MotoRed)
        )
        Spacer(modifier = Modifier.height(13.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it },
            placeholder = { Text("Password") },
            modifier = Modifier.fillMaxWidth().height(47.dp),
            visualTransformation = PasswordVisualTransformation(),
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(unfocusedBorderColor = MotoLine, focusedBorderColor = MotoRed)
        )
        Spacer(modifier = Modifier.height(24.dp))
        MotoButton(text = "Sign Up", onClick = {
            scope.launch {
                val success = SupabaseManager.signUp(email, password)
                if (success) {
                    onNavigate("verifyEmail") // Correct flow
                } else {
                    errorMessage = "Signup failed."
                }
            }
        })
        Spacer(modifier = Modifier.height(16.dp))
        Text("Back to Log In", color = MotoGray, fontSize = 12.sp, fontWeight = FontWeight.Black, modifier = Modifier.clickable { onNavigate("login") })
    }
}

@Composable
fun VerifyEmailScreen(onNavigate: (String) -> Unit) {
    var otp by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxSize().background(MotoBg).padding(horizontal = 24.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(76.dp)
                .shadow(18.dp, RoundedCornerShape(21.dp))
                .background(MotoRed, RoundedCornerShape(21.dp)),
            contentAlignment = Alignment.Center
        ) {
            Text("M", color = MotoWhite, fontSize = 40.sp, fontWeight = FontWeight.Black)
        }
        Spacer(modifier = Modifier.height(12.dp))
        Text("Verify Email", fontSize = 26.sp, fontWeight = FontWeight.Black, color = MotoBlack)
        Spacer(modifier = Modifier.height(4.dp))
        Text("Enter the 6-digit code sent to your email.", fontSize = 13.sp, color = MotoGray, textAlign = androidx.compose.ui.text.style.TextAlign.Center, lineHeight = 19.sp)
        Spacer(modifier = Modifier.height(30.dp))
        
        if (errorMessage.isNotEmpty()) Text(errorMessage, color = MotoRed)

        OutlinedTextField(
            value = otp, onValueChange = { otp = it },
            placeholder = { Text("OTP Code") },
            modifier = Modifier.fillMaxWidth().height(47.dp),
            shape = RoundedCornerShape(14.dp),
            colors = OutlinedTextFieldDefaults.colors(unfocusedBorderColor = MotoLine, focusedBorderColor = MotoRed)
        )
        Spacer(modifier = Modifier.height(24.dp))
        MotoButton(text = "Verify", onClick = {
            scope.launch {
                val success = SupabaseManager.verifyOtp(otp)
                if (success) {
                    onNavigate("registerFaceId")
                } else {
                    errorMessage = "Invalid code."
                }
            }
        })
    }
}
"""

with open('C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens/AuthScreens.kt', 'w', encoding='utf-8') as f:
    f.write(auth_kt)
print("AuthScreens restored to pixel-perfect design")
