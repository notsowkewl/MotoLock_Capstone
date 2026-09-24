# coding=utf-8
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens'

forgot_pwd_kt = """package com.example.motolock.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.ui.components.*
import com.example.motolock.ui.theme.*

@Composable
fun ForgotResetPasswordScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    var email by remember { mutableStateOf("") }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MotoBg)
            .padding(24.dp)
    ) {
        MotoTopBar(onBack = onBack)
        Spacer(modifier = Modifier.height(20.dp))
        
        Text("Forgot Password", fontSize = 28.sp, fontWeight = FontWeight.Black, color = MotoBlack)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Enter your email address to receive a reset code.", fontSize = 14.sp, color = MotoGray)
        Spacer(modifier = Modifier.height(30.dp))
        
        OutlinedTextField(
            value = email, onValueChange = { email = it },
            label = { Text("Email") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = MotoRed, focusedLabelColor = MotoRed)
        )
        
        Spacer(modifier = Modifier.weight(1f))
        MotoButton(text = "Send Reset Code", onClick = { onNavigate("verifyResetCode") })
    }
}
"""

create_pin_kt = """package com.example.motolock.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.ui.components.*
import com.example.motolock.ui.theme.*

@Composable
fun CreatePinScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MotoBg)
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        MotoTopBar(onBack = onBack)
        Spacer(modifier = Modifier.height(40.dp))
        
        Text("Create PIN", fontSize = 28.sp, fontWeight = FontWeight.Black, color = MotoBlack)
        Spacer(modifier = Modifier.height(8.dp))
        Text("Create a 4-digit PIN for backup access", fontSize = 14.sp, color = MotoGray)
        Spacer(modifier = Modifier.height(40.dp))
        
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            for(i in 0..3) {
                Box(
                    modifier = Modifier
                        .size(60.dp)
                        .background(Color.White, shape = androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
                        .padding(8.dp)
                )
            }
        }
        
        Spacer(modifier = Modifier.weight(1f))
        MotoButton(text = "Next", onClick = { onNavigate("createPinConfirmation") })
    }
}
"""

with open(os.path.join(output_dir, "ForgotResetPasswordScreen.kt"), "w", encoding="utf-8") as f:
    f.write(forgot_pwd_kt)
with open(os.path.join(output_dir, "CreatePinScreen.kt"), "w", encoding="utf-8") as f:
    f.write(create_pin_kt)
print("done2")
