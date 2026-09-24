# coding=utf-8
with open('app/src/main/java/com/example/motolock/DashboardScreen.kt', 'r', encoding='utf-8') as f:
    code = f.read()

# Add imports
if 'import androidx.compose.ui.window.Dialog' not in code:
    code = code.replace('import androidx.compose.foundation.verticalScroll', 
                        'import androidx.compose.foundation.verticalScroll\nimport androidx.compose.ui.window.Dialog\nimport androidx.compose.material.icons.filled.Warning\nimport androidx.compose.material.icons.filled.CameraAlt\nimport androidx.compose.material.icons.filled.Dialpad\nimport androidx.compose.material.icons.filled.Group\nimport androidx.compose.material.icons.filled.TwoWheeler\nimport androidx.compose.material.icons.filled.Bluetooth')

# Add state variable
state_old = """    var engineStatus by remember { mutableStateOf("Locked") }
    var isLoading by remember { mutableStateOf(true) }"""
state_new = """    var engineStatus by remember { mutableStateOf("Locked") }
    var isLoading by remember { mutableStateOf(true) }
    var showSetupModal by remember { mutableStateOf(false) }"""
code = code.replace(state_old, state_new)

# Modify Start Unlock click
btn_old = """        // Start Unlock Check Button
        Button(
            onClick = onStartUnlock,"""
btn_new = """        // Start Unlock Check Button
        Button(
            onClick = { showSetupModal = true },"""
code = code.replace(btn_old, btn_new)

# Add Modal at the end of Column
modal_code = """
    } // End Column

    if (showSetupModal) {
        Dialog(onDismissRequest = { showSetupModal = false }) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White, RoundedCornerShape(20.dp))
                    .padding(24.dp)
            ) {
                Column {
                    Text("Setup Incomplete", fontSize = 22.sp, fontWeight = FontWeight.Black, color = motoBlack)
                    Spacer(modifier = Modifier.height(8.dp))
                    Text("Please complete the required MotoLock setup before continuing.", fontSize = 13.sp, color = textGray, lineHeight = 18.sp)
                    Spacer(modifier = Modifier.height(20.dp))
                    
                    val items = listOf(
                        "Face ID" to Icons.Default.CameraAlt,
                        "Security PIN" to Icons.Default.Dialpad,
                        "Emergency Contact" to Icons.Default.Group,
                        "Registered Motorcycle" to Icons.Default.TwoWheeler,
                        "MotoLock Device" to Icons.Default.Bluetooth
                    )
                    
                    items.forEach { (title, icon) ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFFF8FAFC), RoundedCornerShape(12.dp))
                                .border(1.dp, lineCol, RoundedCornerShape(12.dp))
                                .padding(14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(icon, contentDescription = null, modifier = Modifier.size(20.dp), tint = motoRed)
                            Spacer(modifier = Modifier.width(12.dp))
                            Text(title, fontSize = 13.sp, fontWeight = FontWeight.Bold, color = motoBlack, modifier = Modifier.weight(1f))
                            Icon(Icons.Default.Warning, contentDescription = "Incomplete", modifier = Modifier.size(18.dp), tint = motoRed)
                        }
                        Spacer(modifier = Modifier.height(10.dp))
                    }
                    
                    Spacer(modifier = Modifier.height(14.dp))
                    
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Button(
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
                        }
                    }
                }
            }
        }
"""
code = code.replace("    }\n}", modal_code + "\n}")

with open('app/src/main/java/com/example/motolock/DashboardScreen.kt', 'w', encoding='utf-8') as f:
    f.write(code)
