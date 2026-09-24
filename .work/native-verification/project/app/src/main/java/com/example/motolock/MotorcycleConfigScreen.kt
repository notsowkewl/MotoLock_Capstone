package com.example.motolock

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.expandVertically
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
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

private val motorcycleData = mapOf(
    "Honda" to listOf("Click 125i", "Beat", "Wave", "TMX", "ADV 160", "PCX 160", "XRM", "Other"),
    "Yamaha" to listOf("Mio", "NMAX", "Aerox", "XMAX", "Sniper", "MT-15", "R15", "Other"),
    "Suzuki" to listOf("Smash", "Raider", "Burgman", "Skydrive", "Gixxer", "Other"),
    "Kawasaki" to listOf("Barako", "Rouser", "Ninja", "Dominar", "Z400", "Other"),
    "KTM" to listOf("Duke 200", "Duke 390", "RC 200", "RC 390", "Other"),
    "Vespa" to listOf("Primavera", "Sprint", "GTS", "S 125", "Other"),
    "BMW Motorrad" to listOf("G 310 R", "G 310 GS", "R 1250 GS", "S 1000 RR", "Other"),
    "Ducati" to listOf("Monster", "Panigale", "Scrambler", "Multistrada", "Other"),
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
private fun InlineDropdown(
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

    // When options change (brand switch), collapse
    LaunchedEffect(options) { expanded = false }

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
        Spacer(modifier = Modifier.height(7.dp))

        // The dropdown trigger row
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp)
                .background(inputBg, RoundedCornerShape(12.dp))
                .border(
                    1.dp,
                    if (expanded) motoBlack else lineCol,
                    if (expanded) RoundedCornerShape(12.dp, 12.dp, 0.dp, 0.dp) else RoundedCornerShape(12.dp)
                )
                .clip(if (expanded) RoundedCornerShape(12.dp, 12.dp, 0.dp, 0.dp) else RoundedCornerShape(12.dp))
                .clickable(enabled = enabled) { expanded = !expanded }
                .padding(horizontal = 14.dp),
            contentAlignment = Alignment.CenterStart
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = if (selected.isEmpty()) placeholder else selected,
                    color = if (selected.isEmpty()) textGray.copy(alpha = 0.5f) else motoBlack,
                    fontSize = 14.sp,
                    modifier = Modifier.weight(1f)
                )
                Icon(
                    imageVector = if (expanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                    contentDescription = null,
                    tint = textGray,
                    modifier = Modifier.size(20.dp)
                )
            }
        }

        // Inline dropdown list — appears directly below
        AnimatedVisibility(
            visible = expanded,
            enter = expandVertically(),
            exit = shrinkVertically()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color.White, RoundedCornerShape(0.dp, 0.dp, 12.dp, 12.dp))
                    .border(1.dp, motoBlack, RoundedCornerShape(0.dp, 0.dp, 12.dp, 12.dp))
                    .clip(RoundedCornerShape(0.dp, 0.dp, 12.dp, 12.dp))
            ) {
                options.forEachIndexed { index, option ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onSelect(option)
                                expanded = false
                            }
                            .background(
                                if (option == selected) motoBlack.copy(alpha = 0.05f) else Color.Transparent
                            )
                            .padding(horizontal = 16.dp, vertical = 14.dp)
                    ) {
                        Text(
                            text = option,
                            fontSize = 14.sp,
                            color = if (option == selected) motoBlack else Color(0xFF3A3F4A),
                            fontWeight = if (option == selected) FontWeight.SemiBold else FontWeight.Normal
                        )
                    }
                    if (index < options.size - 1) {
                        Divider(color = Color(0xFFE8EBF0), thickness = 0.5.dp)
                    }
                }
            }
        }
    }
}

@Composable
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
    var modelDropdownOpen by remember { mutableStateOf(false) }

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

        // Title
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

        // Image
        Image(
            painter = painterResource(id = R.drawable.tric),
            contentDescription = "Motorcycle",
            modifier = Modifier.fillMaxWidth().height(140.dp),
            contentScale = ContentScale.Fit
        )

        Spacer(modifier = Modifier.height(28.dp))

        // Brand Dropdown
        InlineDropdown(
            label = "Brand",
            selected = selectedBrand,
            options = availableBrands,
            placeholder = "Select Brand",
            onSelect = { brand ->
                selectedBrand = brand
                selectedModel = ""
                manualBrand = ""
                manualModel = ""
                // Auto-open model dropdown after brand select
                if (brand != "Other") {
                    modelDropdownOpen = true
                }
            }
        )

        // Manual brand input when Other
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

        // Model Dropdown — uses a key so the expanded state resets when brand changes
        key(selectedBrand) {
            var modelExpanded by remember { mutableStateOf(modelDropdownOpen) }

            LaunchedEffect(modelDropdownOpen) {
                if (modelDropdownOpen) {
                    modelExpanded = true
                    modelDropdownOpen = false
                }
            }

            Column(modifier = Modifier.fillMaxWidth()) {
                Text("Model", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
                Spacer(modifier = Modifier.height(7.dp))

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(52.dp)
                        .background(inputBg, RoundedCornerShape(12.dp))
                        .border(
                            1.dp,
                            if (modelExpanded) motoBlack else lineCol,
                            if (modelExpanded) RoundedCornerShape(12.dp, 12.dp, 0.dp, 0.dp) else RoundedCornerShape(12.dp)
                        )
                        .clip(if (modelExpanded) RoundedCornerShape(12.dp, 12.dp, 0.dp, 0.dp) else RoundedCornerShape(12.dp))
                        .clickable(enabled = selectedBrand.isNotEmpty()) { modelExpanded = !modelExpanded }
                        .padding(horizontal = 14.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = if (selectedModel.isEmpty()) "Select Model" else selectedModel,
                            color = if (selectedModel.isEmpty()) textGray.copy(alpha = 0.5f) else motoBlack,
                            fontSize = 14.sp,
                            modifier = Modifier.weight(1f)
                        )
                        Icon(
                            imageVector = if (modelExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                            contentDescription = null,
                            tint = textGray,
                            modifier = Modifier.size(20.dp)
                        )
                    }
                }

                AnimatedVisibility(
                    visible = modelExpanded,
                    enter = expandVertically(),
                    exit = shrinkVertically()
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White, RoundedCornerShape(0.dp, 0.dp, 12.dp, 12.dp))
                            .border(1.dp, motoBlack, RoundedCornerShape(0.dp, 0.dp, 12.dp, 12.dp))
                            .clip(RoundedCornerShape(0.dp, 0.dp, 12.dp, 12.dp))
                    ) {
                        availableModels.forEachIndexed { index, m ->
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable {
                                        selectedModel = m
                                        modelExpanded = false
                                    }
                                    .background(if (m == selectedModel) motoBlack.copy(alpha = 0.05f) else Color.Transparent)
                                    .padding(horizontal = 16.dp, vertical = 14.dp)
                            ) {
                                Text(
                                    text = m,
                                    fontSize = 14.sp,
                                    color = if (m == selectedModel) motoBlack else Color(0xFF3A3F4A),
                                    fontWeight = if (m == selectedModel) FontWeight.SemiBold else FontWeight.Normal
                                )
                            }
                            if (index < availableModels.size - 1) {
                                Divider(color = Color(0xFFE8EBF0), thickness = 0.5.dp)
                            }
                        }
                    }
                }
            }
        }

        // Manual model input when Other
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
                                plateNumber = "UNKNOWN"
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