package com.example.motolock

import android.content.Context
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import com.example.motolock.R
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import com.example.motolock.models.EmergencyContact
import com.example.motolock.models.Motorcycle
import com.example.motolock.models.Pin
import com.example.motolock.models.User
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import android.telephony.SmsManager

object SessionState { 
    var isFirstDashboardLoad = true 
    var isMotorUnlocked by mutableStateOf(false)
    var activeBluetoothService by mutableStateOf<com.example.motolock.data.BluetoothService?>(null)
}

// Expiration is display-only and never changes hardware authorization.
@Composable
internal fun rememberFreshMotorStatus(service: com.example.motolock.data.BluetoothService?): State<com.example.motolock.data.MotorStatus?> =
    produceState<com.example.motolock.data.MotorStatus?>(null, service) {
        value = null
        while (true) {
            val report = service?.motorStatus?.value
            value = report?.takeIf {
                service?.isConnected == true && android.os.SystemClock.elapsedRealtime() - it.receivedAt in 0L..3500L
            }
            kotlinx.coroutines.delay(250)
        }
    }

@Composable
fun DashboardScreen(
    onSettingsClick: () -> Unit,
    onStartUnlock: () -> Unit,
    onStartSetup: (String) -> Unit,
    onHistoryClick: () -> Unit
) {
    val context = LocalContext.current
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
        onResult = { /* Optionally handle if they deny */ }
    )

    LaunchedEffect(Unit) {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS) != PackageManager.PERMISSION_GRANTED) {
            permissionLauncher.launch(Manifest.permission.SEND_SMS)
        }
    }
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val motoGreen = Color(0xFF1FA35B)
    val lineCol = Color(0xFFE8EBF0)
    val textGray = Color(0xFF737987)

    val bgBrush = Brush.linearGradient(
        colors = listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF))
    )

    var userName          by remember { mutableStateOf("") }
    var isLoading         by remember { mutableStateOf(true) }
    var showSetupModal    by remember { mutableStateOf(false) }
    var motorcycleInfo    by remember { mutableStateOf<String?>(null) }
    val disconnected = remember { kotlinx.coroutines.flow.MutableStateFlow(false) }
    val activeService = SessionState.activeBluetoothService
    val deviceConnected by (activeService?.connectionState ?: disconnected).collectAsState()
    val motorStatus by rememberFreshMotorStatus(activeService)
    val noStatus = remember { kotlinx.coroutines.flow.MutableStateFlow<com.example.motolock.data.MotorStatus?>(null) }
    val latestMotorStatus by (activeService?.motorStatus ?: noStatus).collectAsState()

    var hasFaceId           by remember { mutableStateOf(false) }
    var hasEmergencyContact by remember { mutableStateOf(false) }
    var hasMotorcycle       by remember { mutableStateOf(false) }
    var hasPin              by remember { mutableStateOf(false) }
    var hasConnectedDevice  by remember { mutableStateOf(false) }

    val isSetupComplete = hasFaceId && hasEmergencyContact && hasMotorcycle && hasPin && hasConnectedDevice

        val lastSmsSent = remember { mutableStateOf(0L) }

    LaunchedEffect(deviceConnected, latestMotorStatus) {
        if (!deviceConnected || latestMotorStatus?.locked == true) SessionState.isMotorUnlocked = false
        
        val status = latestMotorStatus ?: return@LaunchedEffect
        val isDrunkMidRide = status.alcoholDetected == true
        val isTampered = status.helmetConnected == false && SessionState.isMotorUnlocked
        
        if (isDrunkMidRide || isTampered) {
            val now = System.currentTimeMillis()
            if (now - lastSmsSent.value > 3 * 60 * 1000) {
                lastSmsSent.value = now
                try {
                    val authUser = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
                    if (authUser != null) {
                        val contacts = SupabaseClientManager.client.postgrest["emergency_contacts"]
                            .select { filter { eq("user_id", authUser.id) } }
                            .decodeList<EmergencyContact>()
                            
                        val msg = if (isDrunkMidRide) {
                            "MotoLock EMERGENCY ALERT: Rider is operating the motorcycle while intoxicated. Please contact them immediately."
                        } else {
                            "MotoLock TAMPER ALERT: Rider's Smart Helmet disconnected mid-ride. Possible system tampering."
                        }

                        val smsManager = context.getSystemService(SmsManager::class.java)
                        contacts.forEach { contact ->
                            smsManager.sendTextMessage(contact.phone, null, msg, null, null)
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    LaunchedEffect(Unit) {
        try {
            isLoading = true
            val authUser = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
            if (authUser != null) {
                var profile = SupabaseClientManager.client.postgrest["users"]
                    .select { filter { eq("id", authUser.id) } }
                    .decodeSingleOrNull<User>()

                if (profile == null && authUser.email != null) {
                    profile = SupabaseClientManager.client.postgrest["users"]
                        .select { filter { eq("email", authUser.email!!) } }
                        .decodeList<User>().firstOrNull()
                }

                val finalUserId = profile?.id ?: authUser.id

                if (profile != null) {
                    userName = profile.name.split(" ").firstOrNull() ?: ""
                    hasFaceId = profile.faceDescriptor != null && profile.faceDescriptor !is kotlinx.serialization.json.JsonNull
                }

                // Parallel fetch
                coroutineScope {
                    val motoDef = async {
                        SupabaseClientManager.client.postgrest["motorcycles"]
                            .select { filter { eq("user_id", finalUserId) } }
                            .decodeList<JsonObject>().firstOrNull()
                    }
                    val emcDef = async {
                        SupabaseClientManager.client.postgrest["emergency_contacts"]
                            .select { filter { eq("user_id", finalUserId) } }
                            .decodeList<JsonObject>().isNotEmpty()
                    }
                    val pinDef = async {
                        SupabaseClientManager.client.postgrest["pins"]
                            .select { filter { eq("user_id", finalUserId) } }
                            .decodeList<JsonObject>().isNotEmpty()
                    }

                    val moto = motoDef.await()
                    hasEmergencyContact = emcDef.await()
                    hasPin = pinDef.await()

                    if (moto != null) {
                        val brand = moto["brand"]?.jsonPrimitive?.content ?: ""
                        val model = moto["model"]?.jsonPrimitive?.content ?: ""
                        motorcycleInfo = "$brand $model".trim()
                        hasMotorcycle = true
                    }
                }

                val device = SupabaseClientManager.client.postgrest["devices"]
                    .select { filter { eq("user_id", finalUserId) } }
                    .decodeList<JsonObject>().firstOrNull()

                if (device != null) {
                    // A database record means enrolled, not currently connected.
                    hasConnectedDevice = true
                } else {
                    hasConnectedDevice = false
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        } finally {
            isLoading = false
            if (!(hasFaceId && hasEmergencyContact && hasMotorcycle && hasPin && hasConnectedDevice) && SessionState.isFirstDashboardLoad) {
                showSetupModal = true
                SessionState.isFirstDashboardLoad = false
            }
        }
    }

    // Bottom nav selected index (0=Home, 1=History, 2=Settings)
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(bgBrush)
            .padding(horizontal = 24.dp, vertical = 22.dp)
            .verticalScroll(rememberScrollState())
    ) {
            // Topbar
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Spacer(modifier = Modifier.size(36.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        painterResource(id = R.drawable.logo),
                        contentDescription = "Logo",
                        modifier = Modifier.size(24.dp),
                        tint = Color.Unspecified
                    )
                    Spacer(modifier = Modifier.width(6.dp))
                    Text("Moto", fontSize = 18.sp, fontWeight = FontWeight.Black, color = motoBlack)
                    Text("Lock", fontSize = 18.sp, fontWeight = FontWeight.Black, color = motoRed)
                }

                Spacer(modifier = Modifier.size(36.dp))
            }

            Spacer(modifier = Modifier.height(30.dp))

            if (isLoading) {
                // Greeting skeleton
                Box(modifier = Modifier.width(180.dp).height(32.dp).clip(RoundedCornerShape(6.dp)).background(Color(0xFFF0F0F0)))
                Spacer(modifier = Modifier.height(6.dp))
                Box(modifier = Modifier.fillMaxWidth(0.85f).height(18.dp).clip(RoundedCornerShape(6.dp)).background(Color(0xFFF0F0F0)))
                Spacer(modifier = Modifier.height(24.dp))
                Box(modifier = Modifier.fillMaxWidth().height(68.dp).clip(RoundedCornerShape(14.dp)).background(Color(0xFFF0F0F0)))
                Spacer(modifier = Modifier.height(12.dp))
                Box(modifier = Modifier.fillMaxWidth().height(68.dp).clip(RoundedCornerShape(14.dp)).background(Color(0xFFF0F0F0)))
            } else {
                // Greeting
                Text(
                    "Hello, $userName!",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Black,
                    color = motoBlack,
                    letterSpacing = (-0.08).sp
                )
                Spacer(modifier = Modifier.height(6.dp))
                Text(
                    "Your motorcycle is locked by default. Complete the unlock check when you are ready to ride.",
                    fontSize = 13.sp,
                    color = textGray,
                    lineHeight = 18.sp
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Status Banner
                if (!isSetupComplete) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(Color(0xFFFFF8E1))
                            .border(1.dp, Color(0xFFFFD54F), RoundedCornerShape(14.dp))
                            .clickable { showSetupModal = true }
                            .padding(horizontal = 16.dp, vertical = 14.dp)
                    ) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    Icons.Default.Warning,
                                    contentDescription = "Warning",
                                    tint = Color(0xFFF59E0B),
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    "Setup Incomplete",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF92400E)
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                "Tap here to finish your setup so you can ride safely.",
                                fontSize = 12.sp,
                                color = Color(0xFF92400E).copy(alpha = 0.8f)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                } else {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (SessionState.isMotorUnlocked) Color(0xFFECFDF5) else Color(0xFFFFF4F4))
                            .border(1.dp, if (SessionState.isMotorUnlocked) Color(0xFF10B981) else Color(0xFFED1C24), RoundedCornerShape(14.dp))
                            
                            .padding(horizontal = 16.dp, vertical = 14.dp)
                    ) {
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Icon(
                                    if (SessionState.isMotorUnlocked) Icons.Default.LockOpen else Icons.Default.Lock,
                                    contentDescription = "Motor Status",
                                    tint = if (SessionState.isMotorUnlocked) Color(0xFF059669) else Color(0xFFDC2626),
                                    modifier = Modifier.size(20.dp)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text(
                                    if (SessionState.isMotorUnlocked) "Motor is Unlocked" else "Motor is Locked",
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = if (SessionState.isMotorUnlocked) Color(0xFF065F46) else Color(0xFF991B1B)
                                )
                            }
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                if (SessionState.isMotorUnlocked) "You are ready to ride!" else "Use the button below to unlock.",
                                fontSize = 12.sp,
                                color = if (SessionState.isMotorUnlocked) Color(0xFF065F46).copy(alpha = 0.8f) else Color(0xFF991B1B).copy(alpha = 0.8f)
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(16.dp))
                }

                // Info Cards
                InfoCard(
                    icon = Icons.Default.TwoWheeler,
                    iconTint = motoBlack,
                    iconBg = Color(0xFFF1F3F6),
                    label = "Registered Motorcycle",
                    value = motorcycleInfo ?: "No Motorcycle Added"
                )
                Spacer(modifier = Modifier.height(12.dp))
                if (hasConnectedDevice) {
                    InfoCard(
                        icon = Icons.Default.Bluetooth,
                        iconTint = if (deviceConnected) motoGreen else motoRed,
                        iconBg = if (deviceConnected) Color(0xFFE6F4EE) else Color(0xFFFFEDEE),
                        label = "MotoLock Hardware",
                        value = "Motor: ${if (deviceConnected) "Connected" else "Disconnected"}\n" +
                            "Helmet: ${if (deviceConnected) motorStatus?.helmetLabel() ?: "Waiting for status" else "Unknown - motor disconnected"}"
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Only show Unlock button when setup is fully complete
                if (isSetupComplete) {
                    val sharedPrefs = context.getSharedPreferences("MotoLockPrefs", android.content.Context.MODE_PRIVATE)
                    val isPaired = sharedPrefs.getString("esp32_mac", null) != null

                    Button(
                        onClick = { 
                            if (isPaired) {
                                onStartUnlock()
                            } else {
                                onStartSetup("pairing_needed") // Will handle in MainActivity
                            }
                        },
                        modifier = Modifier.fillMaxWidth().height(56.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(motoRed, RoundedCornerShape(14.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                "Unlock Motorcycle",
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Black,
                                color = Color.White
                            )
                        }
                    }
                    Spacer(modifier = Modifier.height(32.dp))
                }
            }
        }

    // Setup Incomplete Modal
    if (showSetupModal && !isLoading) {
        Dialog(onDismissRequest = { showSetupModal = false }) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color.White)
                    .padding(24.dp)
            ) {
                Column {
                    Text(
                        "Setup Incomplete",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Black,
                        color = motoBlack
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        "Please complete the required MotoLock setup before continuing.",
                        fontSize = 13.sp,
                        color = textGray,
                        lineHeight = 18.sp
                    )
                    Spacer(modifier = Modifier.height(20.dp))

                    data class SetupItem(val label: String, val icon: ImageVector, val complete: Boolean)

                    val items = listOf(
                        SetupItem("Face ID",               Icons.Default.CameraAlt,  hasFaceId),
                        SetupItem("Emergency Contact",     Icons.Default.Group,      hasEmergencyContact),
                        SetupItem("Registered Motorcycle", Icons.Default.TwoWheeler, hasMotorcycle),
                        SetupItem("Security PIN",          Icons.Default.Dialpad,    hasPin),
                        SetupItem("MotoLock Device",       Icons.Default.Bluetooth,  hasConnectedDevice)
                    )

                    items.forEach { item ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 6.dp)
                                .clip(RoundedCornerShape(12.dp))
                                .background(Color(0xFFF8F8F8))
                                .padding(horizontal = 14.dp, vertical = 12.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .background(
                                        if (item.complete) Color(0xFFE6F4EE) else Color(0xFFFFEDEE),
                                        CircleShape
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = item.icon,
                                    contentDescription = item.label,
                                    tint = if (item.complete) motoGreen else motoRed,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Spacer(modifier = Modifier.width(14.dp))
                            Text(
                                text = item.label,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = motoBlack,
                                modifier = Modifier.weight(1f)
                            )
                            if (item.complete) {
                                Icon(
                                    Icons.Default.CheckCircle,
                                    contentDescription = "Done",
                                    tint = motoGreen,
                                    modifier = Modifier.size(20.dp)
                                )
                            } else {
                                Icon(
                                    Icons.Default.Warning,
                                    contentDescription = "Incomplete",
                                    tint = motoRed,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(20.dp))

                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Button(
                            onClick = {
                                showSetupModal = false
                                onStartSetup("setup_router")
                            },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = motoRed),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(
                                "Continue Setup",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp
                            )
                        }

                        OutlinedButton(
                            onClick = { showSetupModal = false },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = motoBlack),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text(
                                "Close",
                                fontWeight = FontWeight.Bold,
                                fontSize = 15.sp
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun InfoCard(
    icon: ImageVector,
    iconTint: Color,
    iconBg: Color,
    label: String,
    value: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(Color.White)
            .border(1.dp, Color(0xFFE8EBF0), RoundedCornerShape(14.dp))
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier.size(40.dp).background(iconBg, CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = label, tint = iconTint, modifier = Modifier.size(20.dp))
        }
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Color(0xFF101217))
            Spacer(modifier = Modifier.height(2.dp))
            Text(value, fontSize = 12.sp, color = Color(0xFF64748B), lineHeight = 16.sp)
        }
    }
}




