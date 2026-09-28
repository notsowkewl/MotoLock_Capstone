package com.example.motolock.data

import com.example.motolock.models.User
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.postgrest.postgrest

/** Use the same profile ownership lookup as enrollment and setup. RLS still applies. */
object RiderAccount {
    suspend fun profile(): User? {
        val user = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
            ?: error("Sign in to load your saved data.")
        val byId = SupabaseClientManager.client.postgrest["users"]
            .select { filter { eq("id", user.id) } }.decodeSingleOrNull<User>()
        if (byId != null) return byId
        val email = user.email ?: return null
        return SupabaseClientManager.client.postgrest["users"]
            .select { filter { eq("email", email) } }.decodeList<User>().singleOrNull()
    }

    suspend fun requireProfile(): User = profile() ?: throw ProfileUnavailableException()

    // An authenticated UUID is not proof that a corresponding app profile is readable.
    // Falling back to it made a hidden/missing profile look like an empty account.
    suspend fun userId(): String = requireProfile().id
}

class ProfileUnavailableException : IllegalStateException(
    "Your login is valid, but your saved account data is unavailable. Retry loading your account; do not repeat setup."
)
