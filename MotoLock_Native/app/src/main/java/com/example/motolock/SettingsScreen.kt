package com.example.motolock

import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import kotlinx.coroutines.launch

@Composable
fun SettingsScreen(
    onNavigateToFaceId: () -> Unit, 
    onNavigateToProfile: () -> Unit,
    onNavigateToChangePassword: () -> Unit,
    onNavigateToPin: () -> Unit,
    onNavigateToContacts: () -> Unit,
    onNavigateToMotorcycle: () -> Unit, 
    onNavigateToPrivacy: () -> Unit, 
    onNavigateToTerms: () -> Unit, 
    onNavigateToAbout: () -> Unit,
    onLogout: () -> Unit,
    onNavigateToPairDevice: () -> Unit,
    onBack: () -> Unit
) {
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val textGray = Color(0xFF737987)
    val bgGray = Color(0xFFF7F8FA)

    val disconnectedFlow = remember { kotlinx.coroutines.flow.MutableStateFlow(false) }
    val activeService = SessionState.activeBluetoothService
    val connectionStateFlow = activeService?.connectionState ?: disconnectedFlow
    val isConnected by connectionStateFlow.collectAsState()
    
    val deviceStatusText = if (isConnected) "MotoLock Hardware • Connected" else "No device connected"

    val coroutineScope = rememberCoroutineScope()
    var alertsEnabled by remember { mutableStateOf(true) }

    Column(
        modifier = Modifier.fillMaxSize().background(bgGray).verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 24.dp)
    ) {
        SettingsSectionTitle("Account")
        SettingsCard {
            SettingsRow(icon = Icons.Outlined.Person, title = "Rider Profile", subtitle = "View and update your rider information.", onClick = { onNavigateToProfile() })
            Divider(color = Color(0xFFF0F2F5), thickness = 1.dp)
            SettingsRow(icon = Icons.Outlined.Lock, title = "Change Password", subtitle = "Update your account password.", onClick = { onNavigateToChangePassword() })
            Divider(color = Color(0xFFF0F2F5), thickness = 1.dp)
            SettingsRow(icon = Icons.Outlined.PhotoCamera, title = "Face ID", subtitle = "Re-register or manage your Face ID.", onClick = { onNavigateToFaceId() })
            Divider(color = Color(0xFFF0F2F5), thickness = 1.dp)
            SettingsRow(icon = Icons.Outlined.Dialpad, title = "Security PIN", subtitle = "Change your 4-digit verification PIN.", onClick = { onNavigateToPin() })
        }

        Spacer(modifier = Modifier.height(24.dp))

        SettingsSectionTitle("MotoLock System")
        SettingsCard {
            SettingsRow(icon = Icons.Outlined.Bluetooth, title = "Connected Device", subtitle = deviceStatusText, onClick = { if (!isConnected) onNavigateToPairDevice() })
            Divider(color = Color(0xFFF0F2F5), thickness = 1.dp)
            SettingsRow(icon = Icons.Outlined.TwoWheeler, title = "Registered Motorcycle/s", subtitle = "View, add, edit, or delete motorcycles.", onClick = onNavigateToMotorcycle)
            Divider(color = Color(0xFFF0F2F5), thickness = 1.dp)
            SettingsRow(icon = Icons.Outlined.Group, title = "Emergency Contacts", subtitle = "Primary and secondary contacts.", onClick = onNavigateToContacts)
        }

        Spacer(modifier = Modifier.height(24.dp))

        SettingsSectionTitle("App")
        SettingsCard {
            
            SettingsRow(icon = Icons.Outlined.PrivacyTip, title = "Privacy Policy", subtitle = "Read how MotoLock protects user data.", onClick = { onNavigateToPrivacy() })
            Divider(color = Color(0xFFF0F2F5), thickness = 1.dp)
            SettingsRow(icon = Icons.Outlined.History, title = "Terms and Conditions", subtitle = "View app usage rules and safety agreements.", onClick = { onNavigateToTerms() })
            Divider(color = Color(0xFFF0F2F5), thickness = 1.dp)
            SettingsRow(icon = Icons.Outlined.Settings, title = "About MotoLock", subtitle = "App version and project information.", onClick = { onNavigateToAbout() })
        }

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = {
                coroutineScope.launch {
                    try { SupabaseClientManager.client.auth.signOut() } catch (e: Exception) {}
                    onLogout()
                }
            },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, motoRed),
            shape = RoundedCornerShape(16.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.ExitToApp, contentDescription = "Log Out", tint = motoRed, modifier = Modifier.size(20.dp))
                Spacer(modifier = Modifier.width(8.dp))
                Text("Log Out", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = motoRed)
            }
        }
        
        Spacer(modifier = Modifier.height(30.dp))
    }
}

@Composable
fun SettingsSectionTitle(title: String) {
    Text(text = title, fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF3B4353), modifier = Modifier.padding(bottom = 10.dp, start = 4.dp))
}

@Composable
fun SettingsCard(content: @Composable ColumnScope.() -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().background(Color.White, RoundedCornerShape(16.dp)).border(1.dp, Color(0xFFF0F2F5), RoundedCornerShape(16.dp)).clip(RoundedCornerShape(16.dp))) {
        content()
    }
}

@Composable
fun SettingsRow(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit, trailing: @Composable (() -> Unit)? = null) {
    Row(modifier = Modifier.fillMaxWidth().clickable { onClick() }.padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(modifier = Modifier.size(40.dp).background(Color(0xFFF8F9FA), RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
            Icon(icon, contentDescription = null, tint = Color(0xFFED1C24), modifier = Modifier.size(20.dp))
        }
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFF101217))
            Spacer(modifier = Modifier.height(2.dp))
            Text(subtitle, fontSize = 11.sp, color = Color(0xFF737987), lineHeight = 15.sp)
        }
        Spacer(modifier = Modifier.width(10.dp))
        if (trailing != null) trailing() else Icon(Icons.Default.KeyboardArrowRight, contentDescription = null, tint = Color(0xFFB0B5C1), modifier = Modifier.size(20.dp))
    }
}


