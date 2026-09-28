package com.example.motolock

import android.content.Intent
import android.provider.ContactsContract
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Contacts
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.models.EmergencyContact
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject

fun formatAndValidatePhilippinePhone(input: String): String? {
    // Strip all non-digit characters except leading +
    val clean = input.filter { it.isDigit() || it == '+' }
    
    // Normalize to 09XXXXXXXXX
    val normalized = when {
        clean.startsWith("+639") && clean.length == 13 -> "0" + clean.substring(3)
        clean.startsWith("639") && clean.length == 12 -> "0" + clean.substring(2)
        clean.startsWith("09") && clean.length == 11 -> clean
        else -> return null
    }
    
    return if (normalized.length == 11 && normalized.startsWith("09")) normalized else null
}

@Composable
fun EmergencyContactsScreen(onBack: () -> Unit) {
    var selectedContactName by remember { mutableStateOf("") }
    var selectedContactPhone by remember { mutableStateOf("") }
    var isPhoneError by remember { mutableStateOf(false) }
    var relationship by remember { mutableStateOf("Friend") }
    var isLoading by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()
    val context = LocalContext.current

    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val textGray = Color(0xFF737987)

    val bgBrush = Brush.linearGradient(
        colors = listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF))
    )

    val contactPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == android.app.Activity.RESULT_OK) {
            val contactUri = result.data?.data ?: return@rememberLauncherForActivityResult
            val projection = arrayOf(
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
                ContactsContract.CommonDataKinds.Phone.NUMBER
            )
            
            context.contentResolver.query(contactUri, projection, null, null, null)?.use { cursor ->
                if (cursor.moveToFirst()) {
                    val nameIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                    val numberIndex = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                    
                    if (nameIndex != -1) selectedContactName = cursor.getString(nameIndex)
                    if (numberIndex != -1) {
                        val rawPhone = cursor.getString(numberIndex)
                        selectedContactPhone = formatAndValidatePhilippinePhone(rawPhone) ?: rawPhone
                        if (isPhoneError && formatAndValidatePhilippinePhone(selectedContactPhone) != null) isPhoneError = false
                    }
                }
            }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            // Permission granted
        }
    }

    LaunchedEffect(Unit) {
        permissionLauncher.launch(android.Manifest.permission.READ_CONTACTS)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(bgBrush)
            .padding(horizontal = 24.dp, vertical = 22.dp)
    ) {
        // Topbar
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
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
            Spacer(modifier = Modifier.size(36.dp))
        }

        Spacer(modifier = Modifier.height(22.dp))

        // Title
        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Text("Emergency Contacts", fontSize = 22.sp, fontWeight = FontWeight.Black, color = motoBlack, letterSpacing = (-0.04).sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                "These contacts will be instantly notified with your GPS location if MotoLock detects an accident.",
                fontSize = 13.sp, color = textGray, lineHeight = 18.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }

        Spacer(modifier = Modifier.height(30.dp))
        
        // Profile Icon
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .background(Color(0xFFF4F6F9), CircleShape)
                    .border(2.dp, motoRed, CircleShape),
                contentAlignment = Alignment.Center
            ) {
                androidx.compose.foundation.Image(
                    painter = androidx.compose.ui.res.painterResource(id = R.drawable.front),
                    contentDescription = null,
                    modifier = Modifier.size(40.dp)
                )
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
        
        // Form Fields
        Column(modifier = Modifier.fillMaxWidth()) {
            Text("Full Name", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
            Spacer(modifier = Modifier.height(7.dp))
            BasicTextField(
                value = selectedContactName,
                onValueChange = { selectedContactName = it },
                textStyle = TextStyle(fontSize = 13.sp, color = motoBlack),
                singleLine = true,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(47.dp)
                    .background(Color.White, RoundedCornerShape(14.dp))
                    .border(1.dp, lineCol, RoundedCornerShape(14.dp))
                    .padding(horizontal = 14.dp, vertical = 14.dp)
            )
            
            Spacer(modifier = Modifier.height(13.dp))
            
            Text("Phone Number", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
            Spacer(modifier = Modifier.height(7.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(47.dp)
                    .background(Color.White, RoundedCornerShape(14.dp))
                    .border(1.dp, if (isPhoneError) motoRed else lineCol, RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.CenterStart
            ) {
                BasicTextField(
                    value = selectedContactPhone,
                    onValueChange = { 
                        selectedContactPhone = it
                        if (isPhoneError && formatAndValidatePhilippinePhone(it) != null) isPhoneError = false
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    textStyle = TextStyle(fontSize = 13.sp, color = motoBlack),
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(start = 14.dp, end = 48.dp)
                )
                
                IconButton(
                    onClick = {
                        val intent = Intent(Intent.ACTION_PICK, ContactsContract.CommonDataKinds.Phone.CONTENT_URI)
                        contactPickerLauncher.launch(intent)
                    },
                    modifier = Modifier.align(Alignment.CenterEnd).padding(end = 4.dp)
                ) {
                    Icon(Icons.Default.Contacts, contentDescription = "Pick Contact", tint = motoRed, modifier = Modifier.size(24.dp))
                }
            }
            if (isPhoneError) {
                Text("Invalid Philippine Mobile Number", color = motoRed, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp, start = 4.dp))
            }
        }

        Spacer(modifier = Modifier.height(24.dp))
        
        // Relationship Radios
        Text("Relationship", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
        Spacer(modifier = Modifier.height(8.dp))
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            val options = listOf("Family", "Friend", "Partner")
            options.forEach { opt ->
                val isSelected = relationship == opt
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .height(40.dp)
                        .background(if (isSelected) motoRed.copy(alpha = 0.1f) else Color.White, RoundedCornerShape(10.dp))
                        .border(1.dp, if (isSelected) motoRed else lineCol, RoundedCornerShape(10.dp))
                        .clickable { relationship = opt },
                    contentAlignment = Alignment.Center
                ) {
                    Text(opt, fontSize = 12.sp, fontWeight = FontWeight.Bold, color = if (isSelected) motoRed else motoBlack)
                }
            }
        }

        Spacer(modifier = Modifier.weight(1f))

        // Save Button
        Button(
            onClick = {
                if (selectedContactName.isBlank() || selectedContactPhone.isBlank()) {
                    Toast.makeText(context, "Please fill in all fields", Toast.LENGTH_SHORT).show()
                    return@Button
                }
                val validatedPhone = formatAndValidatePhilippinePhone(selectedContactPhone)
                if (validatedPhone == null) {
                    isPhoneError = true
                    return@Button
                }
                
                isLoading = true
                coroutineScope.launch {
                    try {
                        val user = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
                        if (user != null) {
                            // Ensure public.users record exists to prevent Foreign Key constraint errors
                            var userProfile = SupabaseClientManager.client.postgrest["users"]
                                .select { filter { eq("id", user.id) } }
                                .decodeSingleOrNull<com.example.motolock.models.User>()

                            if (userProfile == null && user.email != null) {
                                userProfile = SupabaseClientManager.client.postgrest["users"]
                                    .select { filter { eq("email", user.email!!) } }
                                    .decodeList<com.example.motolock.models.User>().firstOrNull()
                            }

                            val finalUserId = userProfile?.id ?: user.id

                            if (userProfile == null) {
                                val newUser = com.example.motolock.models.User(
                                    id = finalUserId,
                                    name = user.userMetadata?.get("full_name")?.toString()?.replace("\"", "") ?: "Rider",
                                    email = user.email ?: ""
                                )
                                SupabaseClientManager.client.postgrest["users"].insert(newUser)
                            }

                            val existing = SupabaseClientManager.client.postgrest["emergency_contacts"]
                                .select { filter { eq("user_id", finalUserId) } }
                                .decodeList<JsonObject>()
                            
                            val isPrimary = existing.isEmpty()
                            
                            val contact = EmergencyContact(
                                userId = finalUserId,
                                name = selectedContactName,
                                phone = validatedPhone,
                                relationship = relationship,
                                isPrimary = isPrimary
                            )
                            SupabaseClientManager.client.postgrest["emergency_contacts"].insert(contact)
                            
                            onBack()
                        } else {
                            Toast.makeText(context, "Error: Not logged in", Toast.LENGTH_SHORT).show()
                        }
                    } catch (e: Exception) {
                        Toast.makeText(context, "Failed to save: ${e.message}", Toast.LENGTH_LONG).show()
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
                    Text("Save Emergency Contact", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White)
                }
            }
        }
    }
}
