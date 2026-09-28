package com.example.motolock

import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.res.painterResource
import kotlinx.coroutines.launch
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest

val motorcycleData = mapOf(
    "Honda" to listOf("Click 125i", "Click 160", "ADV 160", "PCX 160", "Beat", "Wave RSX", "XRM 125", "Supra GTR 150", "CBR150R", "CB150X", "Other"),
    "Yamaha" to listOf("NMAX", "Aerox 155", "Mio i 125", "Mio Gear", "Mio Soul i 125", "Mio Gravis", "Sniper 155", "MT-15", "XSR 155", "YZF-R15", "Other"),
    "Suzuki" to listOf("Burgman Street", "Skydrive Sport", "Avenis", "Raider R150", "Smash", "Gixxer 250", "GSX-R150", "Other"),
    "Kawasaki" to listOf("Ninja 400", "Z400", "Dominar 400", "Rouser NS200", "Barako II", "W175", "Other"),
    "Vespa" to listOf("Primavera", "Sprint", "GTS 300", "LX 125", "Other"),
    "KTM" to listOf("Duke 200", "Duke 390", "RC 200", "RC 390", "390 Adventure", "Other"),
    "BMW" to listOf("G 310 R", "G 310 GS", "R 1250 GS", "Other"),
    "Ducati" to listOf("Scrambler", "Monster", "Panigale V2", "Other"),
    "Royal Enfield" to listOf("Classic 350", "Meteor 350", "Himalayan", "Interceptor 650", "Other"),
    "Triumph" to listOf("Trident 660", "Street Triple", "Bonneville", "Tiger", "Other"),
    "CFMOTO" to listOf("NK 400", "NK 300", "SR 300", "SR 450", "Other"),
    "Benelli" to listOf("TNT 135", "Motobi 200", "Leoncino 500", "TRK 502", "Other"),
    "Kymco" to listOf("Like 125", "Xciting", "AK 550", "KRV 180", "Other"),
    "SYM" to listOf("Jet 14", "Maxsym", "Cruisym", "Other"),
    "Motorstar" to listOf("Cafe 400", "Xplorer 250", "Zest 110", "Other"),
    "Rusi" to listOf("Classic 250", "Gala 125", "Macho 175", "Other"),
    "Keeway" to listOf("Superlight 200", "Cafe Racer 152", "Other"),
    "Skygo" to listOf("Boss 150", "King 150", "Pony 100", "Other"),
    "Other" to listOf("Other")
)

@Composable
fun MotorcycleConfigScreen(onNext: () -> Unit, onBack: () -> Unit, motoId: String? = null) {
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val inputBg = Color.White.copy(alpha = 0.92f)
    val textGray = Color(0xFF737987)

    val scope = rememberCoroutineScope()
    var errorMessage by remember { mutableStateOf<String?>(null) }
    
    var selectedBrand by remember { mutableStateOf("") }
    var selectedModel by remember { mutableStateOf("") }
    var manualBrand by remember { mutableStateOf("") }
    var manualModel by remember { mutableStateOf("") }
    var plateNumber by remember { mutableStateOf("") }
    
    var isSaving by remember { mutableStateOf(false) }
    var isDataLoaded by remember { mutableStateOf(motoId == null) }

    LaunchedEffect(motoId) {
        if (motoId != null) {
            try {
                val existing = com.example.motolock.network.SupabaseClientManager.client.postgrest["motorcycles"]
                    .select { filter { eq("id", motoId) } }
                    .decodeSingleOrNull<com.example.motolock.models.Motorcycle>()
                if (existing != null) {
                    val dbBrand = existing.brand ?: ""
                    val dbModel = existing.model ?: ""
                    
                    if (motorcycleData.keys.contains(dbBrand)) {
                        selectedBrand = dbBrand
                    } else {
                        selectedBrand = "Other"
                        manualBrand = dbBrand
                    }

                    if (motorcycleData[selectedBrand]?.contains(dbModel) == true) {
                        selectedModel = dbModel
                    } else {
                        selectedModel = "Other"
                        manualModel = dbModel
                    }
                    
                    plateNumber = existing.plateNumber ?: ""
                }
            } catch (e: Exception) { e.printStackTrace() }
            isDataLoaded = true
        }
    }

    val availableModels = if (selectedBrand.isNotEmpty() && motorcycleData.containsKey(selectedBrand)) {
        motorcycleData[selectedBrand]!!
    } else { emptyList() }

    val modelFocusRequester = remember { FocusRequester() }

    Column(
        modifier = Modifier.fillMaxSize().background(Color(0xFFF7F8FA)).verticalScroll(rememberScrollState()).padding(horizontal = 28.dp)
    ) {
        Spacer(modifier = Modifier.height(48.dp))

        Box(
            modifier = Modifier.size(44.dp).background(Color.White.copy(alpha = 0.88f), RoundedCornerShape(14.dp)).border(1.dp, lineCol, RoundedCornerShape(14.dp)).shadow(18.dp, RoundedCornerShape(14.dp), spotColor = Color(0xFF0F172A).copy(alpha = 0.05f)).clickable { onBack() },
            contentAlignment = Alignment.Center
        ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp), tint = motoBlack) }

        Spacer(modifier = Modifier.height(28.dp))

        Column(modifier = Modifier.fillMaxWidth()) {
            Text(if (motoId != null) "Edit Motorcycle" else "Motorcycle Info", fontSize = 26.sp, fontWeight = FontWeight.Black, color = motoBlack, letterSpacing = (-0.5).sp)
            Spacer(modifier = Modifier.height(6.dp))
            Text("Select your motorcycle brand and model to ensure accurate ESP32 configuration.", fontSize = 13.sp, color = textGray, lineHeight = 20.sp)
        }

        Spacer(modifier = Modifier.height(30.dp))

        // Center Motorcycle Icon
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            androidx.compose.foundation.Image(
                painter = androidx.compose.ui.res.painterResource(id = R.drawable.tric),
                contentDescription = null,
                modifier = Modifier.size(80.dp)
            )
        }

        Spacer(modifier = Modifier.height(36.dp))

        if (!isDataLoaded) {
            Box(modifier = Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = motoRed)
            }
        } else {
            SearchableDropdown(
                label = "Brand",
                selected = selectedBrand,
                options = motorcycleData.keys.toList(),
                placeholder = "Select Brand",
                onSelect = { brand ->
                    selectedBrand = brand
                    selectedModel = ""
                    manualBrand = ""
                    manualModel = ""
                    if (brand != "Other") {
                        modelFocusRequester.requestFocus()
                    }
                }
            )

            if (selectedBrand == "Other") {
                Spacer(modifier = Modifier.height(8.dp))
                BasicTextField(
                    value = manualBrand,
                    onValueChange = { manualBrand = it },
                    textStyle = TextStyle(fontSize = 14.sp, color = motoBlack),
                    singleLine = true,
                    decorationBox = { innerTextField ->
                        Box(
                            modifier = Modifier.fillMaxWidth().height(52.dp).background(inputBg, RoundedCornerShape(12.dp)).border(1.dp, lineCol, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp),
                            contentAlignment = Alignment.CenterStart
                        ) {
                            if (manualBrand.isEmpty()) Text("Input here the brand", color = textGray.copy(alpha = 0.5f), fontSize = 14.sp)
                            innerTextField()
                        }
                    }
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            SearchableDropdown(
                label = "Model",
                selected = selectedModel,
                options = availableModels,
                placeholder = "Select Model",
                focusRequester = modelFocusRequester,
                onSelect = { model ->
                    selectedModel = model
                    manualModel = ""
                },
                enabled = selectedBrand.isNotEmpty() && selectedBrand != "Other"
            )

            if (selectedModel == "Other") {
                Spacer(modifier = Modifier.height(8.dp))
                BasicTextField(
                    value = manualModel,
                    onValueChange = { manualModel = it },
                    textStyle = TextStyle(fontSize = 14.sp, color = motoBlack),
                    singleLine = true,
                    decorationBox = { innerTextField ->
                        Box(
                            modifier = Modifier.fillMaxWidth().height(52.dp).background(inputBg, RoundedCornerShape(12.dp)).border(1.dp, lineCol, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp),
                            contentAlignment = Alignment.CenterStart
                        ) {
                            if (manualModel.isEmpty()) Text("Input here the model", color = textGray.copy(alpha = 0.5f), fontSize = 14.sp)
                            innerTextField()
                        }
                    }
                )
            }

            Spacer(modifier = Modifier.height(16.dp))

            Column(modifier = Modifier.fillMaxWidth()) {
                Text("Plate Number (Optional)", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
                Spacer(modifier = Modifier.height(7.dp))
                BasicTextField(
                    value = plateNumber,
                    onValueChange = { plateNumber = it },
                    textStyle = TextStyle(fontSize = 14.sp, color = motoBlack),
                    singleLine = true,
                    decorationBox = { innerTextField ->
                        Box(
                            modifier = Modifier.fillMaxWidth().height(52.dp).background(inputBg, RoundedCornerShape(12.dp)).border(1.dp, lineCol, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp),
                            contentAlignment = Alignment.CenterStart
                        ) {
                            if (plateNumber.isEmpty()) Text("Enter your plate number", color = textGray.copy(alpha = 0.5f), fontSize = 14.sp)
                            innerTextField()
                        }
                    }
                )
            }

            Spacer(modifier = Modifier.height(40.dp))

            if (errorMessage != null) {
                Text(
                    errorMessage!!,
                    color = motoRed,
                    fontSize = 13.sp,
                    modifier = Modifier.fillMaxWidth().background(motoRed.copy(alpha = 0.07f), RoundedCornerShape(10.dp)).padding(12.dp).padding(bottom = 12.dp)
                )
            }

            Button(
                onClick = {
                    errorMessage = null
                    val finalBrand = if (selectedBrand == "Other") manualBrand.trim() else selectedBrand.trim()
                    val finalModel = if (selectedModel == "Other") manualModel.trim() else selectedModel.trim()
                    val finalPlate = if (plateNumber.trim().isNotEmpty()) plateNumber.trim() else "UNKNOWN"

                    if (finalBrand.isEmpty()) { errorMessage = "Please select or enter a brand."; return@Button }
                    if (finalModel.isEmpty()) { errorMessage = "Please select or enter a model."; return@Button }

                    isSaving = true
                    scope.launch {
                        try {
                            val authUser = com.example.motolock.network.SupabaseClientManager.client.auth.currentSessionOrNull()?.user
                            if (authUser != null) {
                                var userProfile = com.example.motolock.network.SupabaseClientManager.client.postgrest["users"].select { filter { eq("id", authUser.id) } }.decodeSingleOrNull<com.example.motolock.models.User>()
                                if (userProfile == null && authUser.email != null) {
                                    userProfile = com.example.motolock.network.SupabaseClientManager.client.postgrest["users"].select { filter { eq("email", authUser.email!!) } }.decodeList<com.example.motolock.models.User>().firstOrNull()
                                }
                                val targetUserId = userProfile?.id ?: authUser.id

                                val moto = com.example.motolock.models.Motorcycle(
                                    userId = targetUserId,
                                    brand = finalBrand,
                                    model = finalModel,
                                    year = 2024,
                                    plateNumber = finalPlate
                                )
                                if (motoId != null) {
                                    com.example.motolock.network.SupabaseClientManager.client.postgrest["motorcycles"].update(moto.copy(id = motoId)) { filter { eq("id", motoId) } }
                                } else {
                                    com.example.motolock.network.SupabaseClientManager.client.postgrest["motorcycles"].insert(moto)
                                }
                                onNext()
                            } else { errorMessage = "You are not logged in." }
                        } catch (e: Exception) {
                            e.printStackTrace()
                            errorMessage = "Failed to save: ${e.message}"
                        } finally {
                            isSaving = false
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth().height(51.dp).shadow(28.dp, RoundedCornerShape(15.dp), spotColor = motoRed.copy(alpha = 0.22f)),
                colors = ButtonDefaults.buttonColors(containerColor = Color.Transparent),
                contentPadding = PaddingValues(0.dp),
                shape = RoundedCornerShape(15.dp)
            ) {
                Box(
                    modifier = Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFFFF3038), motoRed)), RoundedCornerShape(15.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    if (isSaving) { CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp)) } 
                    else { Text(if (motoId != null) "Save Changes" else "Continue", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White) }
                }
            }
            Spacer(modifier = Modifier.height(20.dp))
        }
    }
}

@Composable
fun SearchableDropdown(
    label: String,
    selected: String,
    options: List<String>,
    placeholder: String,
    onSelect: (String) -> Unit,
    enabled: Boolean = true,
    icon: Int? = null,
    focusRequester: FocusRequester? = null
) {
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val inputBg = Color.White.copy(alpha = 0.92f)
    val textGray = Color(0xFF737987)
    val motoRed = Color(0xFFED1C24)
    
    var expanded by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf("") }
    
    LaunchedEffect(selected) { searchQuery = selected }
    
    val filteredOptions = if (searchQuery.isNotEmpty() && searchQuery != selected) {
        options.filter { it.contains(searchQuery, ignoreCase = true) }
    } else {
        options // Always show all options when empty or matches selection
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) {
                androidx.compose.foundation.Image(
                    painter = androidx.compose.ui.res.painterResource(id = icon),
                    contentDescription = null,
                    modifier = Modifier.size(16.dp).padding(end = 4.dp)
                )
            }
            Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = if (enabled) Color(0xFF2A2F38) else Color.LightGray)
        }
        Spacer(modifier = Modifier.height(7.dp))

        Box {
            BasicTextField(
                value = searchQuery,
                onValueChange = { searchQuery = it; expanded = true },
                enabled = enabled,
                textStyle = TextStyle(fontSize = 14.sp, color = if (enabled) motoBlack else Color.Gray),
                singleLine = true,
                modifier = (if (focusRequester != null) Modifier.focusRequester(focusRequester) else Modifier)
                    .onFocusChanged { if (it.isFocused && enabled) expanded = true }
                    .fillMaxWidth(),
                decorationBox = { innerTextField ->
                    Box(
                        modifier = Modifier.fillMaxWidth().height(52.dp).background(if (enabled) inputBg else Color(0xFFF3F4F6), RoundedCornerShape(12.dp)).border(1.dp, lineCol, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                            Box(modifier = Modifier.weight(1f)) {
                                if (searchQuery.isEmpty()) Text(placeholder, color = textGray.copy(alpha = 0.5f), fontSize = 14.sp)
                                innerTextField()
                            }
                            Icon(if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown, contentDescription = null, tint = if (enabled) motoBlack else Color.LightGray)
                        }
                    }
                }
            )
            
            if (expanded && enabled) {
                Box(modifier = Modifier.fillMaxWidth().padding(top = 56.dp).shadow(8.dp, RoundedCornerShape(12.dp)).background(Color.White, RoundedCornerShape(12.dp)).heightIn(max = 200.dp)) {
                    Column(modifier = Modifier.fillMaxWidth().verticalScroll(rememberScrollState())) {
                        if (filteredOptions.isEmpty()) {
                            Text("No results found", fontSize = 13.sp, color = textGray, modifier = Modifier.padding(16.dp))
                        } else {
                            filteredOptions.forEach { option ->
                                Text(
                                    text = option,
                                    fontSize = 14.sp,
                                    color = motoBlack,
                                    modifier = Modifier.fillMaxWidth().clickable { onSelect(option); expanded = false }.padding(16.dp)
                                )
                                if (option != filteredOptions.last()) Divider(color = lineCol, thickness = 0.5.dp)
                            }
                        }
                    }
                }
            }
        }
    }
}

