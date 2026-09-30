package com.example.motolock

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.example.motolock.data.ProfileUnavailableException
import com.example.motolock.data.RiderAccount
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.CancellationException
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject

@Composable
fun SetupRouterScreen(navController: NavController) {
    var loadError by remember { mutableStateOf<String?>(null) }
    var attempt by remember { mutableStateOf(0) }

    Box(
        modifier = Modifier.fillMaxSize().background(Color.White),
        contentAlignment = Alignment.Center
    ) {
        if (loadError == null) {
            CircularProgressIndicator(color = Color(0xFFED1C24))
        } else {
            Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(loadError!!)
                TextButton(onClick = { attempt++ }) { Text("Retry") }
                TextButton(onClick = {
                    navController.navigate("dashboard") { popUpTo(0) }
                }) { Text("Back to dashboard") }
            }
        }
    }

    LaunchedEffect(attempt) {
        loadError = null
        try {
            SupabaseClientManager.client.auth.awaitInitialization()
            if (SupabaseClientManager.client.auth.currentSessionOrNull()?.user == null) {
                navController.navigate("login") { popUpTo(0) }
                return@LaunchedEffect
            }
            val profile = RiderAccount.requireProfile()
            suspend fun hasRows(table: String): Boolean = SupabaseClientManager.client.postgrest[table]
                .select { filter { eq("user_id", profile.id) } }.decodeList<JsonObject>().isNotEmpty()

            // Route to enrollment only after a successful read confirms something is absent.
            // A request failure or inaccessible profile must never mean "start setup again".
            val route = when {
                profile.faceDescriptor == null || profile.faceDescriptor is JsonNull ||
                    profile.faceDescriptor.toString() == "[]" -> "camera"
                !hasRows("emergency_contacts") -> "contacts"
                !hasRows("motorcycles") -> "motorcycle_config"
                !hasRows("pins") -> "pin_setup"
                !hasRows("devices") -> "esp32_pairing"
                else -> "dashboard"
            }
            navController.navigate(route) { popUpTo(0) }
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            loadError = if (e is ProfileUnavailableException) e.message
                else "Unable to load your saved setup. Check your connection and retry."
        }
    }
}
