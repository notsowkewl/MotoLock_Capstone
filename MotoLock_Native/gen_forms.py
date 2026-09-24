# coding=utf-8
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens'

motorcycle_config_kt = """package com.example.motolock.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.ui.components.*
import com.example.motolock.ui.theme.*
import com.example.motolock.data.MotoLockDataStore
import kotlinx.coroutines.launch

@Composable
fun MotorcycleConfigScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    val context = LocalContext.current
    val dataStore = remember { MotoLockDataStore(context) }
    val scope = rememberCoroutineScope()
    
    val savedBrand by dataStore.riderNameFlow.collectAsState(initial = "") // Will update flow name if needed
    val savedName by dataStore.riderNameFlow.collectAsState(initial = "")

    var brand by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MotoBg)
            .padding(24.dp)
    ) {
        MotoTopBar(title = "Motorcycles", onBack = onBack)
        Spacer(modifier = Modifier.height(20.dp))
        
        Text("Your Garage", fontSize = 24.sp, fontWeight = FontWeight.Black, color = MotoBlack)
        Spacer(modifier = Modifier.height(20.dp))
        
        MotoCard(title = "Add Motorcycle", subtitle = "Register a new bike for MotoLock", icon = Icons.Default.Build)
        Spacer(modifier = Modifier.height(20.dp))
        
        OutlinedTextField(
            value = brand, onValueChange = { brand = it },
            label = { Text("Brand (e.g., Yamaha)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = MotoRed)
        )
        Spacer(modifier = Modifier.height(12.dp))
        
        OutlinedTextField(
            value = name, onValueChange = { name = it },
            label = { Text("Model (e.g., MT-07)") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = MotoRed)
        )
        
        Spacer(modifier = Modifier.weight(1f))
        MotoButton(text = "Save Motorcycle", onClick = {
            scope.launch {
                dataStore.saveMotorcycle(brand, name)
                onBack()
            }
        })
    }
}
"""

emergency_contacts_kt = """package com.example.motolock.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.ui.components.*
import com.example.motolock.ui.theme.*
import com.example.motolock.data.MotoLockDataStore
import kotlinx.coroutines.launch

@Composable
fun EmergencyContactsScreen(onBack: () -> Unit, onNavigate: (String) -> Unit) {
    val context = LocalContext.current
    val dataStore = remember { MotoLockDataStore(context) }
    val scope = rememberCoroutineScope()

    var contact by remember { mutableStateOf("") }
    
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MotoBg)
            .padding(24.dp)
    ) {
        MotoTopBar(title = "Emergency Contacts", onBack = onBack)
        Spacer(modifier = Modifier.height(20.dp))
        
        Text("SOS Contacts", fontSize = 24.sp, fontWeight = FontWeight.Black, color = MotoBlack)
        Spacer(modifier = Modifier.height(8.dp))
        Text("These numbers will be texted if the bike detects a crash.", fontSize = 14.sp, color = MotoGray)
        Spacer(modifier = Modifier.height(20.dp))
        
        MotoCard(title = "Primary Contact", subtitle = contact.ifEmpty { "Not set" }, icon = Icons.Default.Warning)
        Spacer(modifier = Modifier.height(20.dp))
        
        OutlinedTextField(
            value = contact, onValueChange = { contact = it },
            label = { Text("Phone Number") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            colors = OutlinedTextFieldDefaults.colors(focusedBorderColor = MotoRed)
        )
        
        Spacer(modifier = Modifier.weight(1f))
        MotoButton(text = "Save Contact", onClick = {
            scope.launch {
                dataStore.saveEmergencyContact(contact)
                onBack()
            }
        })
    }
}
"""

with open(os.path.join(output_dir, "MotorcycleConfigScreen.kt"), "w", encoding="utf-8") as f:
    f.write(motorcycle_config_kt)
with open(os.path.join(output_dir, "EmergencyContactsScreen.kt"), "w", encoding="utf-8") as f:
    f.write(emergency_contacts_kt)
print("Forms created")
