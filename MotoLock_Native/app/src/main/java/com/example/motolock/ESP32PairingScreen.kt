package com.example.motolock

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import com.example.motolock.data.BluetoothService
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.core.app.ActivityCompat
import com.example.motolock.models.Device
import com.example.motolock.models.Motorcycle
import com.example.motolock.models.User
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat

private fun isHelmetAvailabilityError(message: String?): Boolean =
    message == "Helmet is not ready. Check helmet power and keep it near the motor." ||
        message == "ERR_HELMET_NOT_READY"

@Composable
fun ESP32PairingScreen(onComplete: () -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    val bluetoothAdapter: BluetoothAdapter? = bluetoothManager.adapter

    val scope = rememberCoroutineScope()
    var connectingMacAddress by remember { mutableStateOf<String?>(null) }
    var isAutoConnecting by remember { mutableStateOf(true) }
    var connectionProgress by remember { mutableStateOf("Connecting to your saved motor...") }
    var bluetoothReady by remember { mutableStateOf(false) }
    var pairingService by remember { mutableStateOf<BluetoothService?>(null) }
    var pairingAddress by remember { mutableStateOf<String?>(null) }
    var pairingComplete by remember { mutableStateOf(false) }
    var hardwareVerified by remember { mutableStateOf(false) }
    var pairingError by remember { mutableStateOf<String?>(null) }
    val disconnected = remember { kotlinx.coroutines.flow.MutableStateFlow(false) }
    val motorConnected by (pairingService?.connectionState ?: disconnected).collectAsState()
    val motorStatus by rememberFreshMotorStatus(pairingService)
    val currentPairingService by rememberUpdatedState(pairingService)
    val helmetStatus = when {
        !motorConnected || motorStatus == null -> "Waiting for Status"
        motorStatus?.helmetConnected == false -> "Not Detected"
        motorStatus?.helmetConnected == true && motorStatus?.helmetDataFresh == true &&
            motorStatus?.testStatus != "HELMET_NOT_FOUND" -> "Connected through Motor"
        motorStatus?.testStatus == "HELMET_NOT_FOUND" -> "Not Detected"
        else -> "Waiting for Status"
    }
    val hardwareReady = hardwareVerified && motorConnected && helmetStatus == "Connected through Motor"
    val hardwareLoading = !hardwareVerified &&
        (connectingMacAddress != null || (isAutoConnecting && pairingService != null))
    LaunchedEffect(motorConnected) {
        if (!motorConnected) hardwareVerified = false
    }
    LaunchedEffect(pairingError, helmetStatus) {
        // Clear only availability errors; identity/authentication failures still require setup recovery.
        if (helmetStatus == "Connected through Motor" && isHelmetAvailabilityError(pairingError)) {
            pairingError = null
        }
    }
    DisposableEffect(Unit) {
        onDispose {
            currentPairingService?.takeIf { it !== SessionState.activeBluetoothService }?.disconnect()
        }
    }
    


    suspend fun registerDevice(address: String) {
        val authUser = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
            ?: error("Please sign in before pairing your hardware.")
        var profile = SupabaseClientManager.client.postgrest["users"]
            .select { filter { eq("id", authUser.id) } }.decodeList<JsonObject>().firstOrNull()

        if (profile == null && authUser.email != null) {
            profile = SupabaseClientManager.client.postgrest["users"]
                .select { filter { eq("email", authUser.email!!) } }.decodeList<JsonObject>().firstOrNull()
        }

        val finalUserId = profile?.get("id")?.jsonPrimitive?.content
            ?: throw Exception("User profile not found in public.users.")

        val motorcycle = SupabaseClientManager.client.postgrest["motorcycles"]
            .select { filter { eq("user_id", finalUserId) } }.decodeList<JsonObject>().firstOrNull()
        val motorcycleId = motorcycle?.get("id")?.jsonPrimitive?.content
            

        try {
            val deviceData = Device(
                userId = finalUserId,
                motorcycleId = motorcycleId,
                macAddress = address
            )
            SupabaseClientManager.client.postgrest["devices"].insert(deviceData)
        } catch (insertEx: Exception) {
            if (insertEx is kotlinx.coroutines.CancellationException) throw insertEx
            // Device may already be registered - not fatal
        }

    }

    fun connectAndSaveDevice(device: BluetoothDevice, savedTarget: Boolean = false) {
        if (connectingMacAddress != null || (!savedTarget && device.name != "MotoLock-Motor")) return
        connectingMacAddress = device.address
        pairingComplete = false
        hardwareVerified = false
        pairingError = null
        connectionProgress = "Connecting to motor..."
        try {
            bluetoothAdapter?.cancelDiscovery()
        } catch (e: SecurityException) {}

        scope.launch {
            var success = false
            var btService: com.example.motolock.data.BluetoothService? = null
            try {
                // Step 1: Connect Bluetooth FIRST - don't proceed if can't connect
                val svc = if (pairingAddress == device.address && pairingService?.isConnected == true) {
                    requireNotNull(pairingService)
                } else {
                    pairingService?.disconnect()
                    BluetoothService(context).also { pairingService = it; pairingAddress = device.address }
                }
                btService = svc
                val btConnected = svc.isConnected || svc.connectToDevice(device.address)
                if (!btConnected) {
                    pairingError = "Could not connect to Motor. Check that it is powered on."
                    withContext(kotlinx.coroutines.Dispatchers.Main) {
                        Toast.makeText(context, "Could not connect to device. Is it on?", Toast.LENGTH_LONG).show()
                    }
                    connectingMacAddress = null
                    return@launch
                }
                btService = svc

                // Complete physical pairing before online database requests.
                val authUser = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
                if (authUser != null) {
                    connectionProgress = "Authenticating motor..."
                    val prefs = context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE)
                    val savedEncrypted = if (prefs.getString("esp32_mac", null) == device.address) prefs.getString("esp32_secret_enc", null) else null
                    val savedSecret = savedEncrypted?.let { com.example.motolock.data.KeystoreHelper.decryptSecret(it) }
                    check(savedEncrypted == null || savedSecret != null) { "Could not read saved motor credentials." }
                    val secret = savedSecret ?: run {
                        val bytes = ByteArray(32).also { java.security.SecureRandom().nextBytes(it) }
                        val generated = com.example.motolock.data.HelmetProtocol.hex(bytes)
                        val encrypted = com.example.motolock.data.KeystoreHelper.encryptSecret(generated)
                        check(prefs.edit().putString("esp32_mac", device.address)
                            .putString("esp32_secret_enc", encrypted).commit()) { "Could not save pairing credentials." }
                        generated
                    }
                    check(prefs.edit().putBoolean("device_registration_pending", true).commit()) { "Could not save registration state." }
                    // Preserve recovery credentials when pairing is interrupted or its reply is lost.
                    svc.establishPairing(secret) { connectionProgress = it }
                    connectionProgress = "Verifying helmet identity..."
                    val actual = svc.readHelmetIdentity()
                    val saved = com.example.motolock.data.HelmetIdentity.load(context)
                    check(saved == null || saved.matches(actual)) { "Helmet identity changed. Re-pair deliberately." }
                    actual.save(context)
                    hardwareVerified = true
                    connectionProgress = "Saving device registration..."
                    registerDevice(device.address)
                    prefs.edit().remove("device_registration_pending").apply()
                    success = true
                } else {
                    error("Please sign in before pairing your hardware.")
                }
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) { btService?.disconnect(); throw e }
                e.printStackTrace()
                // Keep the live motor link for STATUS updates and a setup retry.
                pairingError = e.message ?: "Hardware setup did not finish. Retry when ready."
                if (!isHelmetAvailabilityError(pairingError)) {
                    withContext(kotlinx.coroutines.Dispatchers.Main) {
                        Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            } finally {
                connectingMacAddress = null
            }
            if (success && btService != null) {
                pairingComplete = true
                connectionProgress = "Hardware setup complete."
            }
        }
    }
    var isScanning by remember { mutableStateOf(false) }
    
    var discoveredDevices by remember { mutableStateOf(listOf<BluetoothDevice>()) }
    var hasPermissions by remember { mutableStateOf(false) }

    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val textGray = Color(0xFF737987)

    val bgBrush = Brush.linearGradient(
        colors = listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF))
    )

    // Helper to start scanning
    fun startScan() {
        if (!hasPermissions || isAutoConnecting || connectingMacAddress != null || motorConnected) return
        if (bluetoothAdapter?.isEnabled == false) return
        try {
            discoveredDevices = emptyList()
            bluetoothAdapter?.startDiscovery()
            isScanning = true
        } catch (e: SecurityException) {
            Toast.makeText(context, "Missing permissions to scan", Toast.LENGTH_SHORT).show()
        }
    }

    // Bluetooth Enable Launcher
    val enableBluetoothLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            bluetoothReady = true
            startScan()
        } else {
            isAutoConnecting = false
            Toast.makeText(context, "Bluetooth is required to pair devices", Toast.LENGTH_SHORT).show()
        }
    }

    // Permission Launcher
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        hasPermissions = permissions.entries.all { it.value }
        if (!hasPermissions) isAutoConnecting = false
        if (hasPermissions) {
            if (bluetoothAdapter?.isEnabled == false) {
                enableBluetoothLauncher.launch(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE))
            } else {
                bluetoothReady = true
                startScan()
            }
        }
    }

    LaunchedEffect(Unit) {
        val permissionsToRequest = mutableListOf(
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        )
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            permissionsToRequest.add(Manifest.permission.BLUETOOTH_SCAN)
            permissionsToRequest.add(Manifest.permission.BLUETOOTH_CONNECT)
        }
        
        val allGranted = permissionsToRequest.all {
            ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
        }
        
        if (allGranted) {
            hasPermissions = true
            if (bluetoothAdapter?.isEnabled == false) {
                enableBluetoothLauncher.launch(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE))
            } else {
                bluetoothReady = true
                startScan()
            }
        } else {
            permissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    LaunchedEffect(hasPermissions, bluetoothReady) {
        if (!hasPermissions || !bluetoothReady) return@LaunchedEffect
        val prefs = context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE)
        val mac = prefs.getString("esp32_mac", null)
        val encrypted = prefs.getString("esp32_secret_enc", null)
        if (mac != null && encrypted != null) {
            val service = BluetoothService(context)
            pairingService = service
            pairingAddress = mac
            hardwareVerified = false
            pairingError = null
            try {
                val secret = com.example.motolock.data.KeystoreHelper.decryptSecret(encrypted) ?: error("Missing saved secret")
                if (service.connectToDevice(mac)) {
                    service.establishPairing(secret) { connectionProgress = it }
                    val actual = service.readHelmetIdentity()
                    val saved = com.example.motolock.data.HelmetIdentity.load(context)
                    check(saved == null || saved.matches(actual)) { "Helmet identity changed. Re-pair deliberately." }
                    actual.save(context)
                    hardwareVerified = true
                    if (prefs.getBoolean("device_registration_pending", false)) {
                        connectionProgress = "Saving device registration..."
                        registerDevice(mac)
                        prefs.edit().remove("device_registration_pending").apply()
                    }
                    pairingComplete = true
                    connectionProgress = "Hardware setup complete."
                    isAutoConnecting = false
                    return@LaunchedEffect
                }
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) { service.disconnect(); throw e }
                pairingError = e.message ?: "Hardware setup did not finish. Retry when ready."
            }
            if (!service.isConnected) service.disconnect()
        }
        isAutoConnecting = false
    }


    LaunchedEffect(hasPermissions, bluetoothReady, isAutoConnecting) {
        if (hasPermissions && bluetoothReady && !isAutoConnecting) startScan()
    }

    val receiver = remember {
        object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val action = intent.action
                if (BluetoothDevice.ACTION_FOUND == action) {
                    val device = intent.getParcelableExtra<BluetoothDevice>(BluetoothDevice.EXTRA_DEVICE)
                    // The motor owns the helmet BLE connection.
                    if (device != null && device.name == "MotoLock-Motor" && !discoveredDevices.contains(device)) {
                        discoveredDevices = discoveredDevices + device
                    }
                } else if (BluetoothAdapter.ACTION_DISCOVERY_FINISHED == action) {
                    isScanning = false
                }
            }
        }
    }

    DisposableEffect(Unit) {
        val filter = IntentFilter().apply {
            addAction(BluetoothDevice.ACTION_FOUND)
            addAction(BluetoothAdapter.ACTION_DISCOVERY_FINISHED)
        }
        context.registerReceiver(receiver, filter)
        onDispose {
            try {
                context.unregisterReceiver(receiver)
            } catch (e: Exception) {}
            if (hasPermissions) {
                try { bluetoothAdapter?.cancelDiscovery() } catch (e: SecurityException) {}
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(bgBrush)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 24.dp, vertical = 22.dp)
    ) {
        // Topbar
        Row(
            modifier = Modifier.fillMaxWidth(),
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
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp), tint = motoBlack)
            }
        }

        Spacer(modifier = Modifier.height(22.dp))

    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
            Box(
                modifier = Modifier
                    .size(60.dp)
                    .background(Color(0xFFF4F6F9), RoundedCornerShape(20.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.Bluetooth, contentDescription = null, tint = motoRed, modifier = Modifier.size(30.dp))
            }
            Spacer(modifier = Modifier.height(16.dp))
            Text("Pair MotoLock Hardware", fontSize = 22.sp, fontWeight = FontWeight.Black, color = motoBlack, letterSpacing = (-0.04).sp)

        }

        Spacer(modifier = Modifier.height(30.dp))

        


        Text(if (connectingMacAddress != null || isAutoConnecting || pairingComplete) connectionProgress else "Power on both boards. For first pairing only, hold motor BOOT for 3 seconds and release. Select MotoLock-Motor once and wait. Saved reconnects do not need BOOT.", fontSize = 12.sp, color = textGray)
        Spacer(modifier = Modifier.height(12.dp))
        Column(
            modifier = Modifier.fillMaxWidth()
                .background(Color.White.copy(alpha = 0.92f), RoundedCornerShape(18.dp))
                .border(1.dp, lineCol, RoundedCornerShape(18.dp)).padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Text("MotoLock Hardware", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold,
                    color = motoBlack, modifier = Modifier.weight(1f))
                // Saved reconnects may have no discovery row; keep the indicator visible here too.
                if (discoveredDevices.none { it.address == pairingAddress }) {
                    PairingHardwareIndicator(hardwareReady, hardwareLoading)
                }
            }
            Text("Motor: " + when {
                motorConnected -> "Connected"
                connectingMacAddress != null || (isAutoConnecting && pairingService != null) -> "Connecting..."
                else -> "Disconnected"
            }, fontSize = 13.sp, color = motoBlack)
            Text("Helmet: $helmetStatus", fontSize = 13.sp, color = motoBlack)
            when {
                helmetStatus == "Not Detected" -> Text(
                    "Helmet is not currently detected by the Motor. Turn on the helmet and keep it near the motorcycle.",
                    fontSize = 12.sp, color = motoRed)
                motorConnected && helmetStatus == "Waiting for Status" -> Text(
                    "Waiting for the Motor to report a fresh helmet status.", fontSize = 12.sp, color = textGray)
            }
            if (pairingError != null && !isHelmetAvailabilityError(pairingError)) {
                Text(requireNotNull(pairingError), fontSize = 12.sp, color = motoRed)
            }
            if (!isAutoConnecting && connectingMacAddress == null && pairingAddress != null) {
                if (pairingComplete && motorConnected) {
                    if (helmetStatus == "Connected through Motor") {
                        LaunchedEffect(Unit) {
                            kotlinx.coroutines.delay(1500)
                            val service = pairingService
                            if (service?.isConnected == true) {
                                SessionState.activeBluetoothService?.takeIf { it !== service }?.disconnect()
                                SessionState.activeBluetoothService = service
                                onComplete()
                            }
                        }
                    } else {
                        Button(
                            enabled = false,
                            onClick = { }, 
                            colors = ButtonDefaults.buttonColors(containerColor = motoRed),
                            shape = RoundedCornerShape(15.dp)
                        ) { Text("Waiting for Helmet...") }
                    }
                } else {
                    TextButton(onClick = {
                        bluetoothAdapter?.getRemoteDevice(requireNotNull(pairingAddress))?.let {
                            connectAndSaveDevice(it, savedTarget = true)
                        }
                    }) { Text("Retry hardware setup", color = motoRed) }
                }
            }
        }
        Spacer(modifier = Modifier.height(12.dp))
        if (!motorConnected) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Available Devices", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = motoBlack)
                if (isScanning) {
                    Spacer(modifier = Modifier.width(8.dp))
                    CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp, color = motoRed)
                }
            }
            Spacer(modifier = Modifier.height(12.dp))

            Column(modifier = Modifier.fillMaxWidth()) {
                discoveredDevices.forEach { device ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp)
                            .background(Color.White.copy(alpha = 0.92f), RoundedCornerShape(18.dp))
                            .border(1.dp, lineCol, RoundedCornerShape(18.dp))
                            .clickable(enabled = (connectingMacAddress == null && !isAutoConnecting && !motorConnected)) {
                                connectAndSaveDevice(device)
                            }
                            .padding(14.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(43.dp)
                                .background(Color(0xFFF1F3F6), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Bluetooth, contentDescription = null, tint = motoBlack, modifier = Modifier.size(20.dp))
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(device.name ?: "Unknown Device", fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF2F3440))
                            Spacer(modifier = Modifier.height(3.dp))
                            Text(device.address, fontSize = 11.sp, color = textGray)
                        }
                        
                        if (connectingMacAddress == device.address) {
                            CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp, color = motoRed)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PairingHardwareIndicator(ready: Boolean, loading: Boolean) {
    if (ready) {
        Icon(
            Icons.Default.CheckCircle,
            contentDescription = "Motor and Helmet hardware connection successful",
            tint = Color(0xFF16803C),
            modifier = Modifier.size(36.dp)
        )
    } else if (loading) {
        CircularProgressIndicator(
            modifier = Modifier.size(20.dp),
            color = Color(0xFFED1C24),
            strokeWidth = 2.5.dp
        )
    }
}








