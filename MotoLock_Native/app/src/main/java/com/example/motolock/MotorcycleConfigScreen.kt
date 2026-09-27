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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SearchableDropdown(
    label: String,
    selected: String,
    options: List<String>,
    placeholder: String,
    onSelect: (String) -> Unit,
    enabled: Boolean = true
) {
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val inputBg = Color.White.copy(alpha = 0.92f)
    val textGray = Color(0xFF737987)
    
    var expanded by remember { mutableStateOf(false) }
    var searchQuery by remember { mutableStateOf(selected) }
    
    // Sync searchQuery when selected changes from outside (e.g., brand changes -> model resets)
    LaunchedEffect(selected) {
        searchQuery = selected
    }
    
    LaunchedEffect(options) { expanded = false }

    val filteredOptions = if (searchQuery.isNotEmpty() && searchQuery != selected) {
        options.filter { it.contains(searchQuery, ignoreCase = true) }
    } else {
        options
    }

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
        Spacer(modifier = Modifier.height(7.dp))

        ExposedDropdownMenuBox(
            expanded = expanded,
            onExpandedChange = { if (enabled) expanded = !expanded }
        ) {
            BasicTextField(
                value = searchQuery,
                onValueChange = { 
                    searchQuery = it
                    expanded = true
                },
                enabled = enabled,
                textStyle = TextStyle(fontSize = 14.sp, color = motoBlack),
                singleLine = true,
                modifier = Modifier.menuAnchor(),
                decorationBox = { innerTextField ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .background(inputBg, RoundedCornerShape(12.dp))
                            .border(1.dp, if (expanded) motoBlack else lineCol, RoundedCornerShape(12.dp))
                            .padding(horizontal = 14.dp),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(modifier = Modifier.weight(1f)) {
                                if (searchQuery.isEmpty()) {
                                    Text(placeholder, color = textGray.copy(alpha = 0.5f), fontSize = 14.sp)
                                }
                                innerTextField()
                            }
                            Icon(
                                imageVector = if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                contentDescription = null,
                                tint = textGray,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                    }
                }
            )

            ExposedDropdownMenu(
                expanded = expanded && filteredOptions.isNotEmpty(),
                onDismissRequest = { 
                    expanded = false
                    searchQuery = selected // Reset if no selection
                },
                modifier = Modifier
                    .background(Color.White)
                    .heightIn(max = 240.dp)
            ) {
                filteredOptions.forEach { option ->
                    DropdownMenuItem(
                        text = { 
                            Text(
                                text = option,
                                fontSize = 14.sp,
                                color = if (option == selected) motoBlack else Color(0xFF3A3F4A),
                                fontWeight = if (option == selected) FontWeight.SemiBold else FontWeight.Normal
                            )
                        },
                        onClick = {
                            searchQuery = option
                            onSelect(option)
                            expanded = false
                        },
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
                    )
                }
            }
        }
    }
}@Composable
fun MotorcycleConfigScreen(onNext: () -> Unit, onBack: () -> Unit) {
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val inputBg = Color.White.copy(alpha = 0.92f)
    val textGray = Color(0xFF737987)

    val bgBrush = Brush.linearGradient(
        colors = listOf(Color(0xFFFFFFFF), Color(0xFFFBFCFF))
    )

    var selectedBrand by remember { mutableStateOf("") }
    var selectedModel by remember { mutableStateOf("") }
    var manualBrand by remember { mutableStateOf("") }
    var manualModel by remember { mutableStateOf("") }
    var plateNumber by remember { mutableStateOf("") }

    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isSaving by remember { mutableStateOf(false) }

    val scope = rememberCoroutineScope()
    val scrollState = rememberScrollState()

    val availableBrands = motorcycleData.keys.toList()
    val availableModels = motorcycleData[selectedBrand] ?: listOf("Other")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(bgBrush)
            .imePadding()
            .verticalScroll(scrollState)
            .padding(horizontal = 24.dp, vertical = 22.dp)
    ) {
        // Back button
        Row(modifier = Modifier.fillMaxWidth()) {
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

        Spacer(modifier = Modifier.height(24.dp))

        Text(
            text = "Register Your Motorcycle",
            fontSize = 24.sp,
            fontWeight = FontWeight.Black,
            color = motoBlack,
            letterSpacing = (-0.04).sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis
        )
        Spacer(modifier = Modifier.height(6.dp))
        Text(
            "Add your motorcycle details so MotoLock knows what you're riding.",
            fontSize = 13.sp, color = textGray, lineHeight = 18.sp
        )

        Spacer(modifier = Modifier.height(20.dp))

        Image(
            painter = painterResource(id = R.drawable.tric),
            contentDescription = "Motorcycle",
            modifier = Modifier.fillMaxWidth().height(140.dp),
            contentScale = ContentScale.Fit
        )

        Spacer(modifier = Modifier.height(28.dp))

        SearchableDropdown(
            label = "Brand",
            selected = selectedBrand,
            options = availableBrands,
            placeholder = "Select Brand",
            onSelect = { brand ->
                selectedBrand = brand
                selectedModel = ""
                manualBrand = ""
                manualModel = ""
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
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .background(inputBg, RoundedCornerShape(12.dp))
                            .border(1.dp, lineCol, RoundedCornerShape(12.dp))
                            .padding(horizontal = 14.dp),
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
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .background(inputBg, RoundedCornerShape(12.dp))
                            .border(1.dp, lineCol, RoundedCornerShape(12.dp))
                            .padding(horizontal = 14.dp),
                        contentAlignment = Alignment.CenterStart
                    ) {
                        if (manualModel.isEmpty()) Text("Input here the model", color = textGray.copy(alpha = 0.5f), fontSize = 14.sp)
                        innerTextField()
                    }
                }
            )
        }

        Spacer(modifier = Modifier.height(16.dp))

        // Optional Plate Number
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
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(52.dp)
                            .background(inputBg, RoundedCornerShape(12.dp))
                            .border(1.dp, lineCol, RoundedCornerShape(12.dp))
                            .padding(horizontal = 14.dp),
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
                modifier = Modifier
                    .fillMaxWidth()
                    .background(motoRed.copy(alpha = 0.07f), RoundedCornerShape(10.dp))
                    .padding(12.dp)
                    .padding(bottom = 12.dp)
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
                            var userProfile = com.example.motolock.network.SupabaseClientManager.client.postgrest["users"]
                                .select { filter { eq("id", authUser.id) } }
                                .decodeSingleOrNull<com.example.motolock.models.User>()

                            if (userProfile == null && authUser.email != null) {
                                userProfile = com.example.motolock.network.SupabaseClientManager.client.postgrest["users"]
                                    .select { filter { eq("email", authUser.email!!) } }
                                    .decodeList<com.example.motolock.models.User>().firstOrNull()
                            }

                            val targetUserId = userProfile?.id ?: authUser.id

                            val moto = com.example.motolock.models.Motorcycle(
                                userId = targetUserId,
                                brand = finalBrand,
                                model = finalModel,
                                year = 2024,
                                plateNumber = finalPlate
                            )
                            com.example.motolock.network.SupabaseClientManager.client.postgrest["motorcycles"].insert(moto)
                            onNext()
                        } else {
                            errorMessage = "You are not logged in."
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                        errorMessage = "Failed to save: ${e.message}"
                    } finally {
                        isSaving = false
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
                if (isSaving) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                } else {
                    Text("Continue", fontSize = 13.sp, fontWeight = FontWeight.Black, color = Color.White)
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))
    }
}


