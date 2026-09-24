import os
import re

dashboard_path = r"C:\Users\OEM\Downloads\MotoLock_Native\app\src\main\java\com\example\motolock\DashboardScreen.kt"

with open(dashboard_path, "r", encoding="utf-8") as f:
    dashboard_code = f.read()

# Replace the state and fetching logic
state_old = """    var userName by remember { mutableStateOf("Rider") }
    var engineStatus by remember { mutableStateOf("Locked") }
    var isLoading by remember { mutableStateOf(true) }
    var showSetupModal by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()
    
    LaunchedEffect(Unit) {
        try {
            val user = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
            if (user != null) {
                val profile = SupabaseClientManager.client.postgrest["users"]
                    .select { filter { eq("id", user.id) } }
                    .decodeSingleOrNull<User>()
                
                if (profile != null) {
                    userName = profile.name.split(" ")[0]
                }
            }
        } catch (e: Exception) {
            // Silently fail fetching profile and use default
        } finally {
            isLoading = false
        }
    }"""

state_new = """    var userName by remember { mutableStateOf("Rider") }
    var engineStatus by remember { mutableStateOf("Locked") }
    var isLoading by remember { mutableStateOf(true) }
    var showSetupModal by remember { mutableStateOf(false) }
    var isSetupComplete by remember { mutableStateOf(true) }
    var motorcycleName by remember { mutableStateOf("Abc13 - yamaha") }

    val coroutineScope = rememberCoroutineScope()
    
    LaunchedEffect(Unit) {
        try {
            val user = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
            if (user != null) {
                val profile = SupabaseClientManager.client.postgrest["users"]
                    .select { filter { eq("id", user.id) } }
                    .decodeSingleOrNull<User>()
                
                if (profile != null) {
                    val fullName = profile.name ?: "Rider"
                    userName = fullName.split(" ")[0]
                }
                
                // Fetch setup completion
                var complete = true
                val motos = SupabaseClientManager.client.postgrest["motorcycles"]
                    .select { filter { eq("user_id", user.id) } }
                    .decodeList<Map<String, Any>>()
                if (motos.isEmpty()) complete = false
                else {
                    val moto = motos[0]
                    motorcycleName = "${moto["plate_number"] ?: "Unknown"} - ${moto["brand"] ?: "Motorcycle"}"
                }
                
                val contacts = SupabaseClientManager.client.postgrest["emergency_contacts"]
                    .select { filter { eq("user_id", user.id) } }
                    .decodeList<Map<String, Any>>()
                if (contacts.isEmpty()) complete = false
                
                isSetupComplete = complete
            }
        } catch (e: Exception) {
            e.printStackTrace()
            // Silently fail fetching profile and use default
        } finally {
            isLoading = false
        }
    }"""

dashboard_code = dashboard_code.replace(state_old, state_new)

# Re-write the UI portion inside Column
ui_old = """        // Greeting
        Text("Hello, ${userName}!", fontSize = 28.sp, fontWeight = FontWeight.Black, color = motoBlack, letterSpacing = (-0.08).sp)
        Spacer(modifier = Modifier.height(6.dp))
        Text("Your motorcycle is locked by default. Complete the unlock check when you are ready to ride.", fontSize = 13.sp, color = textGray, lineHeight = 18.sp)

        Spacer(modifier = Modifier.height(24.dp))

        // Status Card
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White.copy(alpha = 0.92f), RoundedCornerShape(18.dp))
                .border(1.dp, lineCol, RoundedCornerShape(18.dp))
                .padding(20.dp)
        ) {
            Column {
                Text(if (engineStatus == "Locked") "Motorcycle Locked" else "Motorcycle Unlocked", fontSize = 16.sp, fontWeight = FontWeight.Black, color = if (engineStatus == "Locked") motoRed else motoGreen)
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    if (engineStatus == "Locked") "Your motorcycle is locked by default. Complete the safety check to unlock ignition access."
                    else "Ignition is unlocked! Drive safely and ensure you continue wearing your helmet.",
                    fontSize = 12.sp, color = textGray, lineHeight = 16.sp
                )
            }
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Start Unlock Check Button
        Button(
            onClick = { showSetupModal = true },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .shadow(28.dp, RoundedCornerShape(16.dp), spotColor = motoRed.copy(alpha = 0.22f)),
            colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
            contentPadding = PaddingValues(0.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(Brush.verticalGradient(listOf(Color(0xFFFF3038), motoRed)), RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                Text("Start Unlock Check", fontSize = 14.sp, fontWeight = FontWeight.Black, color = Color.White)
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Device Status Card
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White.copy(alpha = 0.92f), RoundedCornerShape(18.dp))
                .border(1.dp, lineCol, RoundedCornerShape(18.dp))
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(43.dp)
                    .background(Color(0xFFF4F6F9), RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center
            ) {
                // Simplified icon for device
                Text("dY??,?", fontSize = 20.sp)
            }
            Spacer(modifier = Modifier.width(12.dp))
            Column {
                Text("Device Status", fontSize = 13.sp, fontWeight = FontWeight.ExtraBold, color = Color(0xFF2F3440))
                Spacer(modifier = Modifier.height(3.dp))
                Text("Connected ?" MotoLock_12A3B4", fontSize = 11.sp, color = textGray)
            }
        }"""

ui_new = """        // Greeting
        Text("Hello, ${userName}!", fontSize = 28.sp, fontWeight = FontWeight.Black, color = motoBlack, letterSpacing = (-0.08).sp)
        Spacer(modifier = Modifier.height(6.dp))
        Text("Your motorcycle is locked by default. Complete the unlock check when you are ready to ride.", fontSize = 13.sp, color = textGray, lineHeight = 18.sp)

        Spacer(modifier = Modifier.height(24.dp))

        // Setup Required Card
        if (!isSetupComplete) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFFFFFBF5), RoundedCornerShape(20.dp))
                    .border(1.dp, Color(0xFFFDBA74), RoundedCornerShape(20.dp))
                    .padding(20.dp)
            ) {
                Column {
                    Text("Setup Required", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B))
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Complete Face ID, PIN, emergency contact, motorcycle, and device setup before requesting ignition unlock.", fontSize = 13.sp, color = Color(0xFF64748B), lineHeight = 18.sp)
                }
            }
            Spacer(modifier = Modifier.height(16.dp))
        }

        // Device Status Card
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White, RoundedCornerShape(20.dp))
                .border(1.dp, lineCol, RoundedCornerShape(20.dp))
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(44.dp).background(Color(0xFFF1F5F9), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.VerifiedUser, contentDescription = "Device", tint = motoGreen, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text("Device Status", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color(0xFF0F172A))
                Text("Connected · MotoLock_12A3B4", fontSize = 12.sp, color = Color(0xFF64748B))
            }
        }
        
        Spacer(modifier = Modifier.height(12.dp))

        // My Motorcycle
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White, RoundedCornerShape(20.dp))
                .border(1.dp, lineCol, RoundedCornerShape(20.dp))
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(44.dp).background(Color(0xFFF1F5F9), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.TwoWheeler, contentDescription = "Motorcycle", tint = motoRed, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text("My Motorcycle", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color(0xFF0F172A))
                Text(motorcycleName, fontSize = 12.sp, color = Color(0xFF64748B))
            }
        }
        
        Spacer(modifier = Modifier.height(12.dp))

        // Ride History
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White, RoundedCornerShape(20.dp))
                .border(1.dp, lineCol, RoundedCornerShape(20.dp))
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier.size(44.dp).background(Color(0xFFF1F5F9), RoundedCornerShape(14.dp)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.History, contentDescription = "History", tint = motoRed, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.width(16.dp))
            Column {
                Text("Ride History", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color(0xFF0F172A))
                Text("Latest check: Ignition unlock granted after safety verification.", fontSize = 12.sp, color = Color(0xFF64748B))
            }
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Unlock Motorcycle Button
        Button(
            onClick = { 
                if (!isSetupComplete) showSetupModal = true 
                else onStartUnlock() 
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp)
                .shadow(28.dp, RoundedCornerShape(16.dp), spotColor = motoRed.copy(alpha = 0.22f)),
            colors = ButtonDefaults.buttonColors(containerColor = motoRed),
            contentPadding = PaddingValues(0.dp),
            shape = RoundedCornerShape(16.dp)
        ) {
            Text("Unlock Motorcycle", fontSize = 16.sp, fontWeight = FontWeight.Black, color = Color.White)
        }"""
        
dashboard_code = dashboard_code.replace(ui_old, ui_new)

# Setup modal buttons fix
modal_btn_old = """                        Button(
                            onClick = { showSetupModal = false },
                            modifier = Modifier.weight(1f).height(48.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = motoRed),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text("Close", fontWeight = FontWeight.Bold)
                        }
                        Button(
                            onClick = { 
                                showSetupModal = false
                                onStartUnlock() 
                            },
                            modifier = Modifier.weight(1f).height(48.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = motoRed),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text("Continue Setup", fontWeight = FontWeight.Bold)
                        }"""

modal_btn_new = """                        Button(
                            onClick = { showSetupModal = false },
                            modifier = Modifier.weight(1f).height(48.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = motoRed),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text("Close", fontWeight = FontWeight.Bold, color = Color.White)
                        }
                        Button(
                            onClick = { 
                                showSetupModal = false
                                onStartUnlock() 
                            },
                            modifier = Modifier.weight(1f).height(48.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = motoRed),
                            shape = RoundedCornerShape(14.dp)
                        ) {
                            Text("Continue", fontWeight = FontWeight.Bold, color = Color.White)
                        }"""
dashboard_code = dashboard_code.replace(modal_btn_old, modal_btn_new)

with open(dashboard_path, "w", encoding="utf-8") as f:
    f.write(dashboard_code)

print("Dashboard updated.")
