package com.example.motolock.data

import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.rpc

/** PIN values are handled only by authenticated Postgres RPCs; the client never reads PIN rows. */
object RiderPinRepository {
    private val postgrest get() = SupabaseClientManager.client.postgrest

    suspend fun hasPin(): Boolean =
        postgrest.rpc("has_rider_security_pin").data.trim().equals("true", ignoreCase = true)

    suspend fun createPin(pin: String) {
        postgrest.rpc("set_rider_security_pin", mapOf("pin" to pin))
    }

    suspend fun verifyPin(pin: String): Boolean =
        postgrest.rpc("verify_rider_security_pin", mapOf("pin" to pin))
            .data.trim().equals("true", ignoreCase = true)

    suspend fun changePin(currentPin: String, newPin: String): Boolean =
        postgrest.rpc("change_rider_security_pin", mapOf("current_pin" to currentPin, "new_pin" to newPin))
            .data.trim().equals("true", ignoreCase = true)
}
