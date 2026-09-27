package com.example.motolock
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth

fun test() {
    val user = SupabaseClientManager.client.auth.currentSessionOrNull()?.user
    val ne = user?.newEmail
}
