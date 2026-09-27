package com.example.motolock
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth

fun testProvider() {
    val user = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
    val provider = user?.appMetadata?.get("provider")
}
