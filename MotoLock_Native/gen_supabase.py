# coding=utf-8
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/data'
os.makedirs(output_dir, exist_ok=True)

supabase_kt = """package com.example.motolock.data

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.gotrue.GoTrue
import io.github.jan.supabase.gotrue.gotrue
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

// Replace with actual keys
private const val SUPABASE_URL = "https://your-project.supabase.co"
private const val SUPABASE_KEY = "your-anon-key"

object SupabaseManager {
    val client: SupabaseClient = createSupabaseClient(
        supabaseUrl = SUPABASE_URL,
        supabaseKey = SUPABASE_KEY
    ) {
        install(GoTrue)
        install(Postgrest)
    }

    private val _isLoggedIn = MutableStateFlow(false)
    val isLoggedIn: StateFlow<Boolean> = _isLoggedIn.asStateFlow()

    suspend fun login(email: String, pass: String): Boolean {
        return try {
            client.gotrue.loginWith(io.github.jan.supabase.gotrue.providers.builtin.Email) {
                this.email = email
                this.password = pass
            }
            _isLoggedIn.value = true
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    suspend fun logout() {
        try {
            client.gotrue.logout()
        } catch (e: Exception) {}
        _isLoggedIn.value = false
    }
}
"""

with open(os.path.join(output_dir, "SupabaseManager.kt"), "w", encoding="utf-8") as f:
    f.write(supabase_kt)
print("Supabase client created")
