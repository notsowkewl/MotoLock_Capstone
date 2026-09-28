package com.example.motolock

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
import androidx.compose.material.icons.filled.Contacts
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.motolock.models.EmergencyContact
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.launch

@Composable
fun ManageContactsScreen(onBack: () -> Unit, onAddNew: () -> Unit) {
    val scope = rememberCoroutineScope()
    val motoRed = Color(0xFFED1C24)
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val inputBg = Color.White.copy(alpha = 0.92f)
    val textGray = Color(0xFF737987)

    var contacts by remember { mutableStateOf<List<EmergencyContact>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var contactToEdit by remember { mutableStateOf<EmergencyContact?>(null) }
    var contactToDelete by remember { mutableStateOf<EmergencyContact?>(null) }
    var popupMessage by remember { mutableStateOf<String?>(null) }
    var deletingContact by remember { mutableStateOf(false) }

    popupMessage?.let { message ->
        AlertDialog(
            onDismissRequest = { popupMessage = null },
            title = { Text("Emergency Contacts", fontWeight = FontWeight.Bold) },
            text = { Text(message) },
            confirmButton = { TextButton(onClick = { popupMessage = null }) { Text("OK", color = motoRed) } }
        )
    }

    contactToDelete?.let { contact ->
        AlertDialog(
            onDismissRequest = { if (!deletingContact) contactToDelete = null },
            title = { Text("Delete contact?", fontWeight = FontWeight.Bold) },
            text = { Text("Remove ${contact.name} from your emergency contacts?") },
            confirmButton = {
                TextButton(enabled = !deletingContact, onClick = {
                    val contactId = contact.id
                    if (contactId.isNullOrBlank()) {
                        popupMessage = "This contact has no saved ID and cannot be deleted. Refresh the list and try again."
                        contactToDelete = null
                        return@TextButton
                    }
                    deletingContact = true
                    scope.launch {
                        try {
                            val userId = com.example.motolock.data.RiderAccount.userId()
                            val deleted = SupabaseClientManager.client.postgrest["emergency_contacts"].delete {
                                filter { eq("id", contactId); eq("user_id", userId) }
                                select()
                            }
                            val remaining = SupabaseClientManager.client.postgrest["emergency_contacts"]
                                .select { filter { eq("user_id", userId) } }
                                .decodeList<EmergencyContact>()
                            contacts = remaining
                            popupMessage = if (deleted.data.isBlank() || deleted.data == "[]" || remaining.any { it.id == contactId })
                                "The contact was not deleted. Check your account permissions and try again."
                            else "Contact deleted successfully."
                            contactToDelete = null
                        } catch (e: Exception) {
                            if (e is kotlinx.coroutines.CancellationException) throw e
                            popupMessage = "Could not delete contact. Check your connection and try again."
                        } finally { deletingContact = false }
                    }
                }) { Text(if (deletingContact) "Deleting…" else "Delete", color = motoRed) }
            },
            dismissButton = { TextButton(enabled = !deletingContact, onClick = { contactToDelete = null }) { Text("Cancel") } }
        )
    }

    fun loadContacts() {
        scope.launch {
            isLoading = true
            loadError = null
            try {
                val user = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
                if (user != null) {
                    val userId = com.example.motolock.data.RiderAccount.userId()
                    contacts = SupabaseClientManager.client.postgrest["emergency_contacts"]
                        .select { filter { eq("user_id", userId) } }
                        .decodeList<EmergencyContact>()
                }
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                loadError = "Unable to load saved contacts. Check your connection and retry."
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(Unit) { loadContacts() }

    if (contactToEdit != null) {
        var editName by remember { mutableStateOf(contactToEdit!!.name) }
        var editPhone by remember { mutableStateOf(contactToEdit!!.phone) }
        var isSaving by remember { mutableStateOf(false) }

        androidx.compose.ui.window.Dialog(onDismissRequest = { contactToEdit = null }) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = Color.White,
                modifier = Modifier.fillMaxWidth().padding(16.dp)
            ) {
                Column(
                    modifier = Modifier.padding(24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text("Edit Contact", fontSize = 18.sp, fontWeight = FontWeight.Black, color = motoBlack)
                    Spacer(modifier = Modifier.height(20.dp))
                    
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text("Name", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
                        Spacer(modifier = Modifier.height(7.dp))
                        androidx.compose.foundation.text.BasicTextField(
                            value = editName,
                            onValueChange = { editName = it },
                            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp, color = motoBlack),
                            singleLine = true,
                            decorationBox = { innerTextField ->
                                Box(
                                    modifier = Modifier.fillMaxWidth().height(52.dp).background(inputBg, RoundedCornerShape(12.dp)).border(1.dp, lineCol, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp),
                                    contentAlignment = Alignment.CenterStart
                                ) {
                                    if (editName.isEmpty()) Text("Contact Name", color = textGray.copy(alpha = 0.5f), fontSize = 14.sp)
                                    innerTextField()
                                }
                            }
                        )
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text("Phone Number", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
                        Spacer(modifier = Modifier.height(7.dp))
                        androidx.compose.foundation.text.BasicTextField(
                            value = editPhone,
                            onValueChange = { if (it.length <= 11 && it.all { char -> char.isDigit() }) editPhone = it },
                            textStyle = androidx.compose.ui.text.TextStyle(fontSize = 14.sp, color = motoBlack),
                            singleLine = true,
                            decorationBox = { innerTextField ->
                                Box(
                                    modifier = Modifier.fillMaxWidth().height(52.dp).background(inputBg, RoundedCornerShape(12.dp)).border(1.dp, lineCol, RoundedCornerShape(12.dp)).padding(horizontal = 14.dp),
                                    contentAlignment = Alignment.CenterStart
                                ) {
                                    if (editPhone.isEmpty()) Text("09XXXXXXXXX", color = textGray.copy(alpha = 0.5f), fontSize = 14.sp)
                                    innerTextField()
                                }
                            }
                        )
                    }

                    Spacer(modifier = Modifier.height(24.dp))

                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Button(
                            onClick = { contactToEdit = null },
                            modifier = Modifier.weight(1f).height(48.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF0F2F5)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("Cancel", color = textGray, fontWeight = FontWeight.Bold)
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Button(
                            onClick = {
                                if (editName.isBlank() || editPhone.isBlank()) {
                                    popupMessage = "Name and phone number cannot be empty."
                                    return@Button
                                }
                                isSaving = true
                                scope.launch {
                                    try {
                                        val updated = contactToEdit!!.copy(name = editName, phone = editPhone)
                                        com.example.motolock.network.SupabaseClientManager.client.postgrest["emergency_contacts"].update(updated) {
                                            filter { eq("id", contactToEdit!!.id ?: "") }
                                        }
                                        contacts = contacts.map { if (it.id == updated.id) updated else it }
                                        contactToEdit = null
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                        popupMessage = "Could not update contact. Check your connection and try again."
                                    } finally {
                                        isSaving = false
                                    }
                                }
                            },
                            modifier = Modifier.weight(1f).height(48.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = motoRed),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            if (isSaving) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                            } else {
                                Text("Save", color = Color.White, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().background(Color(0xFFF7F8FA)).padding(24.dp)
    ) {
        Box(
            modifier = Modifier.size(36.dp).background(Color.White, RoundedCornerShape(12.dp)).border(1.dp, lineCol, RoundedCornerShape(12.dp)).clickable { onBack() },
            contentAlignment = Alignment.Center
        ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp), tint = Color(0xFF101217)) }

        Spacer(modifier = Modifier.height(24.dp))
        Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
            Box(modifier = Modifier.size(64.dp).background(motoRed.copy(alpha = 0.05f), RoundedCornerShape(32.dp)).border(1.dp, motoRed.copy(alpha = 0.2f), RoundedCornerShape(32.dp)), contentAlignment = Alignment.Center) {
                Icon(Icons.Default.Contacts, contentDescription = null, tint = motoRed, modifier = Modifier.size(28.dp))
            }
        }
        Spacer(modifier = Modifier.height(16.dp))
        Text("Emergency Contacts", fontSize = 24.sp, fontWeight = FontWeight.Black, color = motoBlack, modifier = Modifier.align(Alignment.CenterHorizontally))
        Spacer(modifier = Modifier.height(6.dp))
        Text("People to notify during emergencies.", fontSize = 13.sp, color = Color(0xFF737987), modifier = Modifier.align(Alignment.CenterHorizontally))
        Spacer(modifier = Modifier.height(32.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = motoRed) }
        } else if (loadError != null) {
            Text(loadError!!, color = motoRed)
            TextButton(onClick = { loadContacts() }) { Text("Retry") }
        } else if (contacts.isEmpty()) {
            Box(modifier = Modifier.fillMaxWidth().padding(16.dp), contentAlignment = Alignment.Center) { Text("No emergency contacts saved.", color = Color(0xFF737987), fontSize = 14.sp) }
        } else {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.weight(1f)) {
                items(contacts) { contact ->
                    Box(modifier = Modifier.fillMaxWidth().background(Color.White, RoundedCornerShape(16.dp)).border(1.dp, lineCol, RoundedCornerShape(16.dp)).padding(20.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(modifier = Modifier.size(40.dp).background(Color(0xFFF0F2F5), CircleShape), contentAlignment = Alignment.Center) {
                                Icon(Icons.Default.Person, contentDescription = null, tint = motoBlack, modifier = Modifier.size(20.dp))
                            }
                            Spacer(modifier = Modifier.width(16.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(text = contact.name, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = motoBlack)
                                Spacer(modifier = Modifier.height(4.dp))
                                Text(text = contact.phone, fontSize = 12.sp, color = Color(0xFF737987))
                            }
                            IconButton(onClick = { contactToEdit = contact }) {
                                Icon(Icons.Default.Edit, contentDescription = "Edit", tint = Color(0xFF737987), modifier = Modifier.size(20.dp))
                            }
                            IconButton(onClick = { contactToDelete = contact }) {
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
            Text("Add New Contact", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color.White)
        }
    }
}

