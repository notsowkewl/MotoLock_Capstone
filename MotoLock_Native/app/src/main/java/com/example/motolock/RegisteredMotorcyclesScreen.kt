package com.example.motolock

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.TwoWheeler
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch

@Composable
fun RegisteredMotorcyclesScreen(onBack: () -> Unit, onAddNew: () -> Unit, onEdit: (String) -> Unit) {
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var motorcycles by remember { mutableStateOf<List<com.example.motolock.models.Motorcycle>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var motoToEdit by remember { mutableStateOf<com.example.motolock.models.Motorcycle?>(null) }

    fun loadMotorcycles() {
        isLoading = true
        loadError = null
        scope.launch {
            try {
                val session = SupabaseClientManager.client.auth.currentSessionOrNull()
                val userId = session?.user?.let { com.example.motolock.data.RiderAccount.userId() }
                if (userId != null) {
                    motorcycles = SupabaseClientManager.client.postgrest["motorcycles"]
                        .select { filter { eq("user_id", userId) } }
                        .decodeList<com.example.motolock.models.Motorcycle>()
                }
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                loadError = "Unable to load saved motorcycles. Check your connection and retry."
            } finally { isLoading = false }
        }
    }

    LaunchedEffect(Unit) { loadMotorcycles() }

    if (false) {
        var editBrand by remember { mutableStateOf(motoToEdit!!.brand ?: "") }
        var editModel by remember { mutableStateOf(motoToEdit!!.model ?: "") }
        var editPlate by remember { mutableStateOf(motoToEdit!!.plateNumber ?: "") }
        var isSaving by remember { mutableStateOf(false) }

        AlertDialog(
            onDismissRequest = { motoToEdit = null },
            title = { Text("Edit Motorcycle", fontWeight = FontWeight.Bold) },
            text = {
                Column {
                    OutlinedTextField(
                        value = editBrand,
                        onValueChange = { editBrand = it },
                        label = { Text("Brand") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = editModel,
                        onValueChange = { editModel = it },
                        label = { Text("Model") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    OutlinedTextField(
                        value = editPlate,
                        onValueChange = { editPlate = it },
                        label = { Text("Plate Number") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        if (editBrand.isBlank() || editModel.isBlank()) {
                            Toast.makeText(context, "Brand and Model cannot be empty", Toast.LENGTH_SHORT).show()
                            return@TextButton
                        }
                        isSaving = true
                        scope.launch {
                            try {
                                val updated = motoToEdit!!.copy(brand = editBrand, model = editModel, plateNumber = editPlate)
                                SupabaseClientManager.client.postgrest["motorcycles"].update(updated) {
                                    filter { eq("id", motoToEdit!!.id ?: "") }
                                }
                                motoToEdit = null
                                loadMotorcycles()
                                Toast.makeText(context, "Motorcycle updated", Toast.LENGTH_SHORT).show()
                            } catch (e: Exception) {
                                Toast.makeText(context, "Update failed", Toast.LENGTH_SHORT).show()
                                isSaving = false
                            }
                        }
                    },
                    enabled = !isSaving
                ) {
                    Text(if (isSaving) "Saving..." else "Save", color = motoRed)
                }
            },
            dismissButton = {
                TextButton(onClick = { motoToEdit = null }, enabled = !isSaving) {
                    Text("Cancel", color = Color.Gray)
                }
            }
        )
    }

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFFF7F8FA)).padding(24.dp)) {
        Box(
            modifier = Modifier.size(36.dp).background(Color.White, RoundedCornerShape(12.dp)).border(1.dp, lineCol, RoundedCornerShape(12.dp)).clickable { onBack() },
            contentAlignment = Alignment.Center
        ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp), tint = Color(0xFF101217)) }

        Spacer(modifier = Modifier.height(24.dp))
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(modifier = Modifier.size(64.dp).background(motoRed.copy(alpha = 0.05f), RoundedCornerShape(32.dp)).border(1.dp, motoRed.copy(alpha = 0.2f), RoundedCornerShape(32.dp)), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.TwoWheeler, contentDescription = null, tint = motoRed, modifier = Modifier.size(28.dp))
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text("Registered Motorcycles", fontSize = 24.sp, fontWeight = FontWeight.Black, color = motoBlack, modifier = Modifier.align(Alignment.CenterHorizontally))
        Spacer(modifier = Modifier.height(6.dp))
        Text("Manage your linked motorcycles.", fontSize = 13.sp, color = Color(0xFF737987), modifier = Modifier.align(Alignment.CenterHorizontally))
        Spacer(modifier = Modifier.height(32.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = motoRed) }
        } else if (loadError != null) {
            Text(loadError!!, color = motoRed)
            TextButton(onClick = { loadMotorcycles() }) { Text("Retry") }
        } else if (motorcycles.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) { Text("No motorcycles registered yet.", color = Color(0xFF737987), fontSize = 14.sp) }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.weight(1f)) {
                items(motorcycles) { moto ->
                    Box(modifier = Modifier.fillMaxWidth().background(Color.White, RoundedCornerShape(16.dp)).border(1.dp, lineCol, RoundedCornerShape(16.dp)).padding(20.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(modifier = Modifier.size(40.dp).background(Color(0xFFF0F2F5), CircleShape), contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.TwoWheeler, contentDescription = null, tint = motoBlack, modifier = Modifier.size(20.dp))
                            }
                            Spacer(modifier = Modifier.width(16.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(text = "${moto.brand} ", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = motoBlack)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(text = "Plate: ${moto.plateNumber ?: "N/A"}", fontSize = 12.sp, color = Color(0xFF737987))
                            }
                            IconButton(onClick = { onEdit(moto.id ?: "") }) {
                                Icon(Icons.Default.Edit, contentDescription = "Edit", tint = Color(0xFF737987), modifier = Modifier.size(20.dp))
                            }
                            IconButton(onClick = {
                                scope.launch {
                                    try {
                                        SupabaseClientManager.client.postgrest["motorcycles"].delete { filter { eq("id", moto.id ?: "") } }
                                        loadMotorcycles()
                                        Toast.makeText(context, "Deleted successfully", Toast.LENGTH_SHORT).show()
                                    } catch (e: Exception) { Toast.makeText(context, "Error deleting", Toast.LENGTH_SHORT).show() }
                                }
                            }) {
                                Icon(Icons.Default.Delete, contentDescription = "Delete", tint = motoRed, modifier = Modifier.size(20.dp))
                            }
                        }
                    }
                }
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
        Button(onClick = { onAddNew() }, modifier = Modifier.fillMaxWidth().height(52.dp), colors = ButtonDefaults.buttonColors(containerColor = motoRed), shape = RoundedCornerShape(12.dp)) {
            Icon(Icons.Default.Add, contentDescription = null, tint = Color.White, modifier = Modifier.size(20.dp))
            Spacer(modifier = Modifier.width(8.dp))
            Text("Add New Motorcycle", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
    }
}



