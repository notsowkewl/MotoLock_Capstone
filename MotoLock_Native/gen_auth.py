# coding=utf-8
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens'

auth_kt = """package com.example.motolock.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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
        modifier = Modifier.fillMaxSize().background(MotoBg).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("MotoLock", fontSize = 40.sp, fontWeight = FontWeight.Black, color = MotoBlack)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Log In", fontSize = 16.sp, color = MotoGray)
        Spacer(modifier = Modifier.height(40.dp))
        
        if (errorMessage.isNotEmpty()) {
            Text(errorMessage, color = MotoRed, fontSize = 14.sp)
            Spacer(modifier = Modifier.height(8.dp))
        }

        OutlinedTextField(
            value = email, onValueChange = { email = it },
            label = { Text("Email") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true
        )
        Spacer(modifier = Modifier.height(16.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it },
            label = { Text("Password") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            visualTransformation = PasswordVisualTransformation()
        )
        
        Spacer(modifier = Modifier.height(24.dp))
        MotoButton(text = "Log In", onClick = {
            scope.launch {
                val success = SupabaseManager.login(email, password)
                if (success) onNavigate("dashboard") else errorMessage = "Invalid credentials."
            }
        })
        Spacer(modifier = Modifier.height(16.dp))
        Text("Create an account", color = MotoRed, modifier = Modifier.clickable { onNavigate("createAccount") })
    }
}

@Composable
fun CreateAccountScreen(onNavigate: (String) -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxSize().background(MotoBg).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Join MotoLock", fontSize = 32.sp, fontWeight = FontWeight.Black, color = MotoBlack)
        Spacer(modifier = Modifier.height(40.dp))
        
        if (errorMessage.isNotEmpty()) {
            Text(errorMessage, color = MotoRed, fontSize = 14.sp)
            Spacer(modifier = Modifier.height(8.dp))
        }

        OutlinedTextField(
            value = email, onValueChange = { email = it },
            label = { Text("Email") },
            modifier = Modifier.fillMaxWidth()
        )
        Spacer(modifier = Modifier.height(16.dp))
        OutlinedTextField(
            value = password, onValueChange = { password = it },
            label = { Text("Password") },
            modifier = Modifier.fillMaxWidth(),
            visualTransformation = PasswordVisualTransformation()
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
        Text("Back to Log In", color = MotoGray, modifier = Modifier.clickable { onNavigate("login") })
    }
}

@Composable
fun VerifyEmailScreen(onNavigate: (String) -> Unit) {
    var otp by remember { mutableStateOf("") }
    var errorMessage by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    Column(
        modifier = Modifier.fillMaxSize().background(MotoBg).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("Verify Email", fontSize = 32.sp, fontWeight = FontWeight.Black, color = MotoBlack)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Enter the 6-digit code sent to your email.", color = MotoGray)
        Spacer(modifier = Modifier.height(40.dp))
        
        if (errorMessage.isNotEmpty()) Text(errorMessage, color = MotoRed)

        OutlinedTextField(
            value = otp, onValueChange = { otp = it },
            label = { Text("OTP Code") },
            modifier = Modifier.fillMaxWidth()
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

with open(os.path.join(output_dir, "AuthScreens.kt"), "w", encoding="utf-8") as f:
    f.write(auth_kt)
print("Auth Screens rewritten to support OTP verification flow")
