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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Bluetooth
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

@Composable
fun ESP32PairingScreen(onComplete: () -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
    val bluetoothAdapter: BluetoothAdapter? = bluetoothManager.adapter

    val scope = rememberCoroutineScope()
    var connectingMacAddress by remember { mutableStateOf<String?>(null) }
    var isAutoConnecting by remember { mutableStateOf(true) }
    
    LaunchedEffect(Unit) {
        val sharedPrefs = context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE)
        val macAddress = sharedPrefs.getString("esp32_mac", null)
        if (macAddress != null) {
            val service = BluetoothService(context)
            val connected = service.connectToDevice(macAddress)
            if (connected) {
                onComplete()
                return@LaunchedEffect
            }
        }
        isAutoConnecting = false
    }


    fun connectAndSaveDevice(device: BluetoothDevice) {
        if (connectingMacAddress != null) return
        connectingMacAddress = device.address
        try {
            bluetoothAdapter?.cancelDiscovery()
        } catch (e: SecurityException) {}

        scope.launch {
            var success = false
            var btService: com.example.motolock.data.BluetoothService? = null
            try {
                // Step 1: Connect Bluetooth FIRST - don't proceed if can't connect
                val svc = com.example.motolock.data.BluetoothService(context)
                val btConnected = svc.connectToDevice(device.address)
                if (!btConnected) {
                    withContext(kotlinx.coroutines.Dispatchers.Main) {
                        Toast.makeText(context, "Could not connect to device. Is it on?", Toast.LENGTH_LONG).show()
                    }
                    connectingMacAddress = null
                    return@launch
                }
                btService = svc

                // Step 2: Save to DB and SharedPrefs
                val authUser = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
                if (authUser != null) {
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
                        ?: throw Exception("No motorcycle found for user_id=$finalUserId")

                    try {
                        val deviceData = Device(
                            userId = finalUserId,
                            motorcycleId = motorcycleId,
                            macAddress = device.address
                        )
                        SupabaseClientManager.client.postgrest["devices"].insert(deviceData)
                    } catch (insertEx: Exception) {
                        // Device may already be registered - not fatal
                    }

                    // 1. Generate random hardware secret using SecureRandom
                    val secureRandom = java.security.SecureRandom()
                    val secretBytes = ByteArray(32) // 256 bits of entropy
                    secureRandom.nextBytes(secretBytes)
                    val rawSecret = secretBytes.joinToString("") { "%02x".format(it) }
                    
                    // 2. Send provisioning command to ESP32
                    val provisionResult = btService.sendProvisionCommand(rawSecret)
                    if (!provisionResult.first) {
                        throw Exception(provisionResult.second)
                    }

                    // 3. Encrypt and save locally
                    val encryptedSecret = com.example.motolock.data.KeystoreHelper.encryptSecret(rawSecret)
                    val sharedPrefs = context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE)
                    sharedPrefs.edit()
                        .putString("esp32_mac", device.address)
                        .putString("esp32_secret_enc", encryptedSecret)
                        .apply()
                        
                    success = true
                }
            } catch (e: Exception) {
                e.printStackTrace()
                btService?.disconnect()
                withContext(kotlinx.coroutines.Dispatchers.Main) {
                    Toast.makeText(context, "Error: ${e.message}", Toast.LENGTH_LONG).show()
                }
            } finally {
                connectingMacAddress = null
            }
            if (success && btService != null) {
                // Store the active BT connection so UnlockScreen can use it directly
                SessionState.activeBluetoothService = btService
                onComplete()
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
        if (!hasPermissions) return
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
            startScan()
        } else {
            Toast.makeText(context, "Bluetooth is required to pair devices", Toast.LENGTH_SHORT).show()
        }
    }

    // Permission Launcher
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        hasPermissions = permissions.entries.all { it.value }
        if (hasPermissions) {
            if (bluetoothAdapter?.isEnabled == false) {
                enableBluetoothLauncher.launch(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE))
            } else {
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
                startScan()
            }
        } else {
            permissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }

    val receiver = remember {
        object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val action = intent.action
                if (BluetoothDevice.ACTION_FOUND == action) {
                    val device = intent.getParcelableExtra<BluetoothDevice>(BluetoothDevice.EXTRA_DEVICE)
                    // Auto-filter removed to allow connecting to actual available Bluetooth hardware
                    if (device != null && device.name != null && !discoveredDevices.contains(device)) {
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

        if (isAutoConnecting) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = motoRed)
        }
        return@Column
    }
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

        // Scan Button (Manual Refresh)
        Button(
            onClick = {
                if (!hasPermissions) {
                    Toast.makeText(context, "Bluetooth permissions are required", Toast.LENGTH_SHORT).show()
                    return@Button
                }
                if (bluetoothAdapter?.isEnabled == false) {
                    enableBluetoothLauncher.launch(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE))
                    return@Button
                }
                startScan()
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(51.dp)
                .shadow(10.dp, RoundedCornerShape(15.dp), spotColor = Color(0xFF0F172A).copy(alpha = 0.06f)),
            colors = ButtonDefaults.buttonColors(containerColor = Color.White),
            border = androidx.compose.foundation.BorderStroke(1.dp, lineCol),
            shape = RoundedCornerShape(15.dp)
        ) {
            Text(if (isScanning) "Scanning..." else "Rescan for Devices", fontSize = 13.sp, fontWeight = FontWeight.Black, color = motoBlack)
        }
        Spacer(modifier = Modifier.height(20.dp))


        Text("Available Devices", fontSize = 14.sp, fontWeight = FontWeight.ExtraBold, color = motoBlack)
        if (isScanning) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), color = motoRed)
        }
        Spacer(modifier = Modifier.height(12.dp))

        LazyColumn(modifier = Modifier.weight(1f)) {
            items(discoveredDevices) { device ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 12.dp)
                        .background(Color.White.copy(alpha = 0.92f), RoundedCornerShape(18.dp))
                        .border(1.dp, lineCol, RoundedCornerShape(18.dp))
                        .clickable(enabled = (connectingMacAddress == null)) {
                            connectAndSaveDevice(device)
                        }
                        .padding(14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(43.dp)
                            .background(Color(0xFFF4F6F9), RoundedCornerShape(16.dp)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Bluetooth, contentDescription = null, tint = Color(0xFF737987), modifier = Modifier.size(22.dp))
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(device.name ?: "Unknown Device", fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF2F3440))
                        Spacer(modifier = Modifier.height(3.dp))
                        Text(device.address, fontSize = 11.sp, color = textGray)
                    }
                    if (connectingMacAddress == device.address) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = motoRed,
                            strokeWidth = 2.5.dp
                        )
                    }
                }
            }
        }
    }
}