package com.example.motolock

import android.location.Geocoder
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Locale

@Composable
internal fun rideLocationLabel(latitude: Double?, longitude: Double?): String {
    val context = LocalContext.current.applicationContext
    val label by produceState(
        initialValue = if (latitude == null || longitude == null) "Location not recorded" else "Loading location…",
        key1 = latitude, key2 = longitude
    ) {
        if (latitude == null || longitude == null) {
            value = "Location not recorded"
            return@produceState
        }
        value = "Loading location…"
        value = withContext(Dispatchers.IO) {
            try {
                @Suppress("DEPRECATION")
                val address = if (Geocoder.isPresent())
                    Geocoder(context, Locale.getDefault()).getFromLocation(latitude, longitude, 1)?.firstOrNull()
                    else null
                address?.getAddressLine(0)?.takeIf { it.isNotBlank() }
                    ?: "Location name unavailable"
            } catch (e: Exception) {
                if (e is kotlinx.coroutines.CancellationException) throw e
                "Location name unavailable"
            }
        }
    }
    return label
}
