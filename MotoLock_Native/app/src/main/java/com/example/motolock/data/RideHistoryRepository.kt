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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withTimeoutOrNull
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.receiveAsFlow
import kotlin.coroutines.resume

object RideHistoryRepository {
    val updates = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    private val manualOverrideNavigationChannel = Channel<MotorStatus>(Channel.BUFFERED)
    val manualOverrideNavigation = manualOverrideNavigationChannel.receiveAsFlow()
    private val alcoholResultNavigationChannel = Channel<MotorStatus>(Channel.BUFFERED)
    val alcoholResultNavigation = alcoholResultNavigationChannel.receiveAsFlow()
    val manualOverrideWriteError = MutableStateFlow<String?>(null)
    private const val OVERRIDE_EVENT_ID_KEY = "manual_override_event_id"
    private const val OVERRIDE_SAVED_KEY = "manual_override_logged"
    private const val OVERRIDE_PENDING_SINCE_KEY = "manual_override_pending_since"
    private const val OVERRIDE_CLAIM_TIMEOUT_MS = 30_000L

    @Synchronized
    fun claimManualOverride(context: Context): String? {
        val prefs = context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE)
        if (prefs.getBoolean(OVERRIDE_SAVED_KEY, false)) return null
        val pendingSince = prefs.getLong(OVERRIDE_PENDING_SINCE_KEY, 0L)
        val now = System.currentTimeMillis()
        if (pendingSince != 0L && now - pendingSince < OVERRIDE_CLAIM_TIMEOUT_MS) return null

        val eventId = prefs.getString(OVERRIDE_EVENT_ID_KEY, null)
            ?: java.util.UUID.randomUUID().toString()
        val claimed = prefs.edit()
            .putString(OVERRIDE_EVENT_ID_KEY, eventId)
            .putLong(OVERRIDE_PENDING_SINCE_KEY, now)
            .commit()
        return eventId.takeIf { claimed }
    }

    @Synchronized
    fun finishManualOverride(context: Context, eventId: String) {
        val prefs = context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE)
        if (prefs.getString(OVERRIDE_EVENT_ID_KEY, null) != eventId) return
        prefs.edit()
            .putBoolean(OVERRIDE_SAVED_KEY, true)
            .remove(OVERRIDE_PENDING_SINCE_KEY)
            .commit()
    }

    @Synchronized
    fun retryManualOverride(context: Context, eventId: String) {
        val prefs = context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE)
        if (prefs.getString(OVERRIDE_EVENT_ID_KEY, null) != eventId) return
        prefs.edit()
            .putBoolean(OVERRIDE_SAVED_KEY, false)
            .remove(OVERRIDE_PENDING_SINCE_KEY)
            .commit()
    }

    @Synchronized
    fun clearManualOverride(context: Context) {
        context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE).edit()
            .remove(OVERRIDE_EVENT_ID_KEY)
            .remove(OVERRIDE_SAVED_KEY)
            .remove(OVERRIDE_PENDING_SINCE_KEY)
            .commit()
    }

    fun notifyManualOverrideDetected(status: MotorStatus) {
        manualOverrideNavigationChannel.trySend(status)
    }

    fun notifyAlcoholResultDetected(status: MotorStatus) {
        alcoholResultNavigationChannel.trySend(status)
    }

    suspend fun recordUnlock(context: Context, alcoholLevel: Float?) {
        recordResult(context, alcoholLevel, "ongoing")
    }

    suspend fun recordAlcoholDetected(context: Context, alcoholLevel: Float?) {
        recordResult(context, alcoholLevel, "failed_brac")
    }

    suspend fun recordManualOverride(context: Context, alcoholLevel: Float?, eventId: String) {
        // The ride_history schema requires initial_brac_level and accepts ongoing as a status.
        // event_type carries the physical override event without relying on a status enum value.
        try {
            val existing = SupabaseClientManager.client.postgrest["ride_history"]
                .select { filter { eq("event_id", eventId) } }
                .decodeList<RideHistory>()
            if (existing.isNotEmpty()) {
                manualOverrideWriteError.value = null
                updates.tryEmit(Unit)
                return
            }
            recordResult(context, alcoholLevel ?: 0f, "ongoing", "manual_override", eventId)
            manualOverrideWriteError.value = null
        } catch (e: Exception) {
            if (e is CancellationException) throw e
            manualOverrideWriteError.value = "Could not save manual override to Ride History. Check your connection and try again."
            throw e
        }
    }

    private suspend fun recordResult(
        context: Context,
        alcoholLevel: Float?,
        status: String,
        eventType: String? = null,
        eventId: String? = null
    ) {
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
                eventType = eventType,
                eventId = eventId,
                startTime = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", java.util.Locale.US)
                    .format(java.util.Date()),
                startLat = location?.latitude,
                startLon = location?.longitude
            )
        )
        updates.tryEmit(Unit)
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
