package com.example.motolock.data

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import androidx.core.content.ContextCompat
import com.example.motolock.models.Device
import com.example.motolock.models.RideHistory
import com.example.motolock.network.SupabaseClientManager
import com.google.android.gms.location.LocationServices
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlin.coroutines.resume

object RideHistoryRepository {
    suspend fun recordUnlock(context: Context, alcoholLevel: Float?) {
        recordResult(context, alcoholLevel, "ongoing")
    }

    suspend fun recordAlcoholDetected(context: Context, alcoholLevel: Float?) {
        recordResult(context, alcoholLevel, "failed_brac")
    }

    private suspend fun recordResult(context: Context, alcoholLevel: Float?, status: String) {
        val userId = RiderAccount.userId()
        val mac = context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE)
            .getString("esp32_mac", null)
        val device = if (mac == null) null else SupabaseClientManager.client.postgrest["devices"]
            .select { filter { eq("user_id", userId); eq("mac_address", mac) } }
            .decodeList<Device>().singleOrNull()
        // Location is optional: no permission, fix, or GPS response must not drop the ride.
        val location = lastLocation(context)
        SupabaseClientManager.client.postgrest["ride_history"].insert(
            RideHistory(
                userId = userId,
                deviceId = device?.id,
                alcoholLevel = alcoholLevel,
                status = status,
                startTime = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", java.util.Locale.US)
                    .format(java.util.Date()),
                startLat = location?.latitude,
                startLon = location?.longitude
            )
        )
    }

    @android.annotation.SuppressLint("MissingPermission")
    private suspend fun lastLocation(context: Context): Location? {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) return null
        return try {
            withTimeoutOrNull(2000) {
                suspendCancellableCoroutine { continuation ->
                    LocationServices.getFusedLocationProviderClient(context).lastLocation.addOnCompleteListener { task ->
                        if (continuation.isActive) continuation.resume(if (task.isSuccessful) task.result else null)
                    }
                }
            }
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            null
        }
    }
}
