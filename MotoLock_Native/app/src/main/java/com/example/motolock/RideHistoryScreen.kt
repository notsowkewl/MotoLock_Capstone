package com.example.motolock

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.History
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.repeatOnLifecycle
import kotlinx.coroutines.launch
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest
import com.example.motolock.models.RideHistory
import java.text.SimpleDateFormat
import java.util.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun RideHistoryScreen(onBack: () -> Unit) {
    val motoBlack = Color(0xFF101217)
    val textGray = Color(0xFF737987)
    val coroutineScope = rememberCoroutineScope()
    val lifecycleOwner = LocalLifecycleOwner.current
    var rides by remember { mutableStateOf<List<RideHistory>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    
    fun loadRides() {
        coroutineScope.launch {
            isLoading = true
            loadError = null
            try {
                val userId = com.example.motolock.data.RiderAccount.userId()
                    rides = SupabaseClientManager.client.postgrest["ride_history"]
                        .select { filter { eq("user_id", userId) } }
                        .decodeList<RideHistory>()
                        .sortedByDescending { it.startTime }
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                loadError = "Unable to load saved rides. Check your connection and retry."
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(lifecycleOwner) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.RESUMED) {
            loadRides()
            com.example.motolock.data.RideHistoryRepository.updates.collect {
                loadRides()
            }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F8FA))
            .padding(horizontal = 24.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Spacer(modifier = Modifier.height(48.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .background(Color.White, CircleShape)
                    .shadow(12.dp, CircleShape, spotColor = Color(0xFF0F172A).copy(alpha = 0.08f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.History, contentDescription = null, tint = motoBlack, modifier = Modifier.size(20.dp))
            }
            Spacer(modifier = Modifier.width(16.dp))
            Text(
                "Ride History",
                fontSize = 24.sp,
                fontWeight = FontWeight.Black,
                color = motoBlack,
                letterSpacing = (-0.5).sp
            )
        }
        
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            "Review your recent trips and safety logs.",
            fontSize = 13.sp,
            color = textGray,
            lineHeight = 20.sp
        )

        Spacer(modifier = Modifier.height(32.dp))

        if (isLoading) {
            Box(modifier = Modifier.fillMaxWidth().padding(top = 40.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Color(0xFFED1C24))
            }
        } else if (loadError != null) {
            Text(loadError!!, color = Color(0xFFED1C24))
            TextButton(onClick = { loadRides() }) { Text("Retry") }
        } else if (rides.isEmpty()) {
            Box(
                modifier = Modifier.fillMaxWidth().padding(top = 40.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("No ride history available.", color = textGray, fontSize = 14.sp)
            }
        } else {
            rides.forEach { ride ->
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 16.dp)
                        .background(Color.White, RoundedCornerShape(16.dp))
                        .padding(20.dp)
                ) {
                    Column {
                        val statusLabel = when (ride.eventType) {
                            "manual_override" -> "Manual override activated"
                            else -> when (ride.status) {
                            "ongoing", "unlocked" -> "Motorcycle unlocked"
                            "completed" -> "Ride completed"
                            "failed_brac" -> "Alcohol detected"
                            "failed_face" -> "Face verification failed"
                            else -> ride.status.replace('_', ' ').replaceFirstChar { it.uppercase() }
                            }
                        }
                        val statusColor = when {
                            ride.eventType == "manual_override" -> Color(0xFFB45309)
                            ride.status in listOf("ongoing", "unlocked", "completed") -> Color(0xFF10B981)
                            else -> Color(0xFFED1C24)
                        }
                        Text("Status: $statusLabel", color = statusColor, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        Spacer(modifier = Modifier.height(8.dp))
                        Text("Alcohol Level: ${ride.alcoholLevel?.let { "%.3f%%".format(it) } ?: "Not recorded"}", color = motoBlack, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                        Spacer(modifier = Modifier.height(4.dp))
                        Text("Location: ${rideLocationLabel(ride.startLat, ride.startLon)}", color = textGray, fontSize = 13.sp)
                        Spacer(modifier = Modifier.height(4.dp))
                        val dateString = ride.startTime?.let {
                            try { 
                                val normalized = it.replace(Regex("\\.\\d+(?=Z|[+-]\\d{2}:?\\d{2}$)"), "")
                                val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US).parse(normalized)
                                SimpleDateFormat("MMM dd, yyyy - hh:mm a", Locale.US).format(requireNotNull(date))
                            } catch(e:Exception) { it }
                        } ?: "Unknown Date"
                        Text(dateString, color = textGray, fontSize = 12.sp)
                    }
                }
            }
            Spacer(modifier = Modifier.height(40.dp))
        }
    }
}


