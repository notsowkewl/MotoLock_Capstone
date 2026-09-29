package com.example.motolock

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch

@Composable
fun RiderProfileScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("motolock_prefs", Context.MODE_PRIVATE) }
    
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    
    var username by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var isEmailEditable by remember { mutableStateOf(false) }

    var pendingEmail by remember { mutableStateOf<String?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var isSaving by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        try {
            // Force refresh session to get latest email in case they verified it outside
            SupabaseClientManager.client.auth.refreshCurrentSession()
            val session = SupabaseClientManager.client.auth.currentSessionOrNull()
            val userId = session?.user?.id
            val currentEmail = session?.user?.email ?: ""
            email = currentEmail
            
            if (userId != null) {
                // Check if there's a pending email
                val savedPending = prefs.getString("pending_email_$userId", null)
                if (savedPending != null) {
                    if (savedPending == currentEmail) {
                        // Email was verified! Clear pending
                        prefs.edit().remove("pending_email_$userId").apply()
                        pendingEmail = null
                    } else {
                        pendingEmail = savedPending
                    }
                }
            
                val userProfile = com.example.motolock.data.RiderAccount.profile()
                
                if (userProfile != null) {
                    username = userProfile.name
                }
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

        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(
                modifier = Modifier.size(64.dp).background(motoRed.copy(alpha = 0.05f), RoundedCornerShape(32.dp)).border(1.dp, motoRed.copy(alpha = 0.2f), RoundedCornerShape(32.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Person, contentDescription = null, tint = motoRed, modifier = Modifier.size(28.dp))
            }
        }
        
        Spacer(modifier = Modifier.height(16.dp))
        Text("Rider Profile", fontSize = 24.sp, fontWeight = FontWeight.Black, color = motoBlack, modifier = Modifier.align(Alignment.CenterHorizontally))
        Spacer(modifier = Modifier.height(6.dp))
        Text("View and update your personal information.", fontSize = 13.sp, color = Color(0xFF737987), modifier = Modifier.align(Alignment.CenterHorizontally))

        Spacer(modifier = Modifier.height(32.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = motoRed)
            }
        } else {
            Text("Name", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = motoBlack)
            Spacer(modifier = Modifier.height(6.dp))
            ProfileField(value = username, onValueChange = { username = it }, placeholder = "Enter name")

            Spacer(modifier = Modifier.height(16.dp))

            Text("Email Address", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = motoBlack)
            Spacer(modifier = Modifier.height(6.dp))
            ProfileField(value = email, onValueChange = { email = it }, placeholder = "Enter email", enabled = isEmailEditable)
            
            if (pendingEmail != null && !isEmailEditable) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Pending verification for $pendingEmail. Click to resend link.", 
                    fontSize = 12.sp, 
                    fontWeight = FontWeight.Bold, 
                    color = Color(0xFFF59E0B), 
                    modifier = Modifier.clickable {
                        scope.launch {
                            try {
                                SupabaseClientManager.client.auth.modifyUser {
                                    this.email = pendingEmail!!
                                }
                                message = "Verification link resent to $pendingEmail."
                            } catch (e: Exception) {
                                message = "Error resending link."
                            }
                        }
                    }
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Cancel email change", 
                    fontSize = 12.sp, 
                    fontWeight = FontWeight.Bold, 
                    color = motoRed, 
                    modifier = Modifier.clickable {
                        val session = SupabaseClientManager.client.auth.currentSessionOrNull()
                        val userId = session?.user?.id
                        if (userId != null) {
                            prefs.edit().remove("pending_email_$userId").apply()
                        }
                        pendingEmail = null
                        message = "Email change cancelled."
                    }
                )
            } else if (!isEmailEditable) {
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Change email address?", 
                    fontSize = 12.sp, 
                    fontWeight = FontWeight.Bold, 
                    color = motoRed, 
                    modifier = Modifier.align(Alignment.End).clickable { isEmailEditable = true; email = "" }
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            if (message != null) {
                Text(message!!, color = if (message!!.contains("Success") || message!!.contains("resent")) Color(0xFF10B981) else motoRed, fontSize = 13.sp, modifier = Modifier.padding(bottom = 12.dp))
            }

            Button(
                onClick = {
                    isSaving = true
                    scope.launch {
                        try {
                            val session = SupabaseClientManager.client.auth.currentSessionOrNull()
                            val userId = session?.user?.id
                            if (userId != null) {
                                val currentSessionEmail = session.user?.email
                                
                                // Update username
                                val profileId = userId
                                SupabaseClientManager.client.postgrest["users"]
                                    .update({
                                        set("name", username)
                                    }) { filter { eq("id", profileId) } }
                                val refreshedProfile = SupabaseClientManager.client.postgrest["users"]
                                    .select { filter { eq("id", profileId) } }
                                    .decodeSingleOrNull<com.example.motolock.models.User>()
                                    ?: error("Profile could not be reloaded after saving.")
                                username = refreshedProfile.name
                                
                                // Handle email change
                                if (isEmailEditable && email.isNotBlank() && email != currentSessionEmail) {
                                    val currentNewEmail = email
                                    SupabaseClientManager.client.auth.modifyUser {
                                        this.email = currentNewEmail
                                    }
                                    // Save pending state
                                    prefs.edit().putString("pending_email_$userId", currentNewEmail).apply()
                                    pendingEmail = currentNewEmail
                                    
                                    message = "Verification email sent. Please check your inbox."
                                    
                                    // Revert the text field to show current actual email
                                    email = currentSessionEmail ?: ""
                                } else {
                                    message = "Success: Profile updated."
                                }
                                
                                isEmailEditable = false
                            }
                        } catch (e: Exception) {
                            message = if (e.message?.contains("Error sending email change email") == true) "Error: Supabase limit reached. Cannot send email change confirmation at this time." else "Error: ${e.message}"
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
                else Text("Save Changes", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
            }
        }
    }
}

@Composable
fun ProfileField(value: String, onValueChange: (String) -> Unit, placeholder: String, enabled: Boolean = true) {
    val lineCol = Color(0xFFE8EBF0)
    val bgColor = if (enabled) Color.White else Color(0xFFF0F2F5)
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        enabled = enabled,
        textStyle = TextStyle(fontSize = 14.sp, color = if (enabled) Color.Black else Color(0xFF737987)),
        singleLine = true,
        decorationBox = { innerTextField ->
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(52.dp)
                    .background(bgColor, RoundedCornerShape(12.dp))
                    .border(1.dp, lineCol, RoundedCornerShape(12.dp))
                    .padding(horizontal = 14.dp),
                contentAlignment = Alignment.CenterStart
            ) {
                if (value.isEmpty()) Text(placeholder, color = Color(0xFFB0B5C1), fontSize = 14.sp)
                innerTextField()
            }
        }
    )
}


