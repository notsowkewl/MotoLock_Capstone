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
    var manualOverrideActive by mutableStateOf(false)
    var showManualOverrideConfirmation by mutableStateOf(false)
    var alcoholResultActive by mutableStateOf(false)
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
    var loadError by remember { mutableStateOf<String?>(null) }
    var reloadData by remember { mutableStateOf(0) }
    var showSetupModal    by remember { mutableStateOf(false) }
    var motorcycleInfo    by remember { mutableStateOf<String?>(null) }
    val disconnected = remember { kotlinx.coroutines.flow.MutableStateFlow(false) }
    val activeService = SessionState.activeBluetoothService
    val deviceConnected by (activeService?.connectionState ?: disconnected).collectAsState()
    val motorStatus by rememberFreshMotorStatus(activeService)
    val hasSavedHardwarePairing = context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE)
        .getString("esp32_secret_enc", null) != null
    val pairedHardwareReady = deviceConnected && motorStatus?.helmetConnected == true &&
        motorStatus?.helmetDataFresh == true && motorStatus?.testStatus != "HELMET_NOT_FOUND"
    val noStatus = remember { kotlinx.coroutines.flow.MutableStateFlow<com.example.motolock.data.MotorStatus?>(null) }
    val latestMotorStatus by (activeService?.motorStatus ?: noStatus).collectAsState()
    val manualOverrideWriteError by com.example.motolock.data.RideHistoryRepository.manualOverrideWriteError.collectAsState()

    LaunchedEffect(activeService, hasSavedHardwarePairing) {
        if (activeService?.isConnected == true || !hasSavedHardwarePairing) return@LaunchedEffect
        val prefs = context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE)
        val mac = prefs.getString("esp32_mac", null) ?: return@LaunchedEffect
        val encryptedSecret = prefs.getString("esp32_secret_enc", null) ?: return@LaunchedEffect
        val secret = com.example.motolock.data.KeystoreHelper.decryptSecret(encryptedSecret)
            ?: return@LaunchedEffect
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) {
            return@LaunchedEffect
        }

        while (SessionState.activeBluetoothService?.isConnected != true) {
            val service = com.example.motolock.data.BluetoothService(context)
            val connectedAndAuthenticated = try {
                service.connectToDevice(mac) && service.authenticateSession(secret)
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                false
            }
            if (connectedAndAuthenticated) {
                val current = SessionState.activeBluetoothService
                if (current == null || !current.isConnected) {
                    SessionState.activeBluetoothService = service
                    return@LaunchedEffect
                }
            }
            service.disconnect()
            kotlinx.coroutines.delay(5000)
        }
    }

    var hasFaceId           by remember { mutableStateOf(false) }
    var hasEmergencyContact by remember { mutableStateOf(false) }
    var hasMotorcycle       by remember { mutableStateOf(false) }
    var hasPin              by remember { mutableStateOf(false) }
    var hasConnectedDevice  by remember { mutableStateOf(false) }

    val isSetupComplete = hasFaceId && hasEmergencyContact && hasMotorcycle && hasPin && hasConnectedDevice

        val lastSmsSent = remember { mutableStateOf(0L) }

    LaunchedEffect(deviceConnected, latestMotorStatus) {
        val status = latestMotorStatus
        if (status?.overrideActive == true) {
            SessionState.manualOverrideActive = true
            SessionState.isMotorUnlocked = true
        } else {
            if (status?.overrideStatusAvailable == true) {
                SessionState.manualOverrideActive = false
            }
            if (status?.locked == true) {
                SessionState.isMotorUnlocked = false
            } else if (status?.locked == false) {
                SessionState.isMotorUnlocked = true
            } else if (!deviceConnected && !SessionState.manualOverrideActive) {
                SessionState.isMotorUnlocked = false
            }
        }
        
        status ?: return@LaunchedEffect
        val isDrunkMidRide = status.alcoholDetected == true
        val isTampered = status.helmetConnected == false && SessionState.isMotorUnlocked
        
        if (isDrunkMidRide || isTampered) {
            val now = System.currentTimeMillis()
            if (now - lastSmsSent.value > 3 * 60 * 1000) {
                lastSmsSent.value = now
                try {
                    val authUser = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
                    if (authUser != null) {
                        val userId = com.example.motolock.data.RiderAccount.userId()
                        val contacts = SupabaseClientManager.client.postgrest["emergency_contacts"]
                            .select { filter { eq("user_id", userId) } }
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

    LaunchedEffect(reloadData) {
        try {
            isLoading = true
            loadError = null
            val authUser = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
            if (authUser != null) {
                val profile = com.example.motolock.data.RiderAccount.requireProfile()
                val finalUserId = profile.id
                userName = profile.name.split(" ").firstOrNull() ?: ""
                hasFaceId = profile.faceDescriptor != null && profile.faceDescriptor !is kotlinx.serialization.json.JsonNull

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
                        com.example.motolock.data.RiderPinRepository.hasPin()
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
            if (e is kotlinx.coroutines.CancellationException) throw e
            loadError = if (e is com.example.motolock.data.ProfileUnavailableException) e.message
                else "Unable to load saved setup. Check your connection and retry."
            e.printStackTrace()
        } finally {
            isLoading = false
            if (loadError == null && !(hasFaceId && hasEmergencyContact && hasMotorcycle && hasPin && hasConnectedDevice) && SessionState.isFirstDashboardLoad) {
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

            if (loadError != null) {
                Text(loadError!!, color = motoRed)
                TextButton(onClick = { reloadData++ }) { Text("Retry") }
            } else if (isLoading) {
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
                if (hasConnectedDevice && hasSavedHardwarePairing && pairedHardwareReady) {
                    InfoCard(
                        icon = Icons.Default.Bluetooth,
                        iconTint = motoGreen,
                        iconBg = Color(0xFFE6F4EE),
                        label = "MotoLock Hardware",
                        value = "Motor: Connected\nHelmet: Connected through Motor\nWear sensor: ${latestMotorStatus?.helmetWearLabel() ?: "Unknown"}"
                    )
                }

                if (SessionState.alcoholResultActive) {
                    Spacer(modifier = Modifier.height(12.dp))
                    InfoCard(
                        icon = Icons.Default.Warning,
                        iconTint = Color(0xFFB91C1C),
                        iconBg = Color(0xFFFEE2E2),
                        label = "Alcohol Detected",
                        value = "Unlock stopped and the motor was locked. Wait for the sensor result to clear before starting another check."
                    )
                }

                if (SessionState.manualOverrideActive || latestMotorStatus?.overrideActive == true) {
                    Spacer(modifier = Modifier.height(12.dp))
                    InfoCard(
                        icon = Icons.Default.Warning,
                        iconTint = Color(0xFFB45309),
                        iconBg = Color(0xFFFFF4D6),
                        label = "Manual Override Activated",
                        value = "Motor was enabled using the physical override. Turn off override on the motor when safe."
                    )
                }

                if (manualOverrideWriteError != null) {
                    Spacer(modifier = Modifier.height(12.dp))
                    InfoCard(
                        icon = Icons.Default.History,
                        iconTint = Color(0xFFB91C1C),
                        iconBg = Color(0xFFFEE2E2),
                        label = "Ride History Sync",
                        value = manualOverrideWriteError!!
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Only show Unlock button when setup is fully complete and motor is not already unlocked
                if (isSetupComplete && !SessionState.isMotorUnlocked) {
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

    if (SessionState.showManualOverrideConfirmation) {
        AlertDialog(
            onDismissRequest = { SessionState.showManualOverrideConfirmation = false },
            title = { Text("Manual Override Activated", fontWeight = FontWeight.Bold) },
            text = { Text("The motorcycle engine was enabled using the physical override. You are back at the Dashboard.") },
            confirmButton = {
                TextButton(onClick = { SessionState.showManualOverrideConfirmation = false }) {
                    Text("Return to Dashboard", color = motoRed)
                }
            }
        )
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

