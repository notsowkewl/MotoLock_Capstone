package com.example.motolock.network

import io.github.jan.supabase.SupabaseClient
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.gotrue.Auth
import io.github.jan.supabase.postgrest.Postgrest
import kotlinx.serialization.json.Json
import io.github.jan.supabase.serializer.KotlinXSerializer

object SupabaseClientManager {
    val client: SupabaseClient by lazy {
        createSupabaseClient(
            supabaseUrl = "https://bafziqymbvhrytziteuo.supabase.co",
            supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZnppcXltYnZocnl0eml0ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjAzMzUsImV4cCI6MjEwMzk5NjMzNX0.F1KVSKnN_x-8O2gKlh0d8XPydlBWTcsS0GPbCS6CP_c"
        ) {
            defaultSerializer = KotlinXSerializer(Json {
                ignoreUnknownKeys = true
                coerceInputValues = true
            })
            install(Postgrest)
            install(Auth) {
                scheme = "com.example.motolock"
                host = "auth-callback"
                flowType = io.github.jan.supabase.gotrue.FlowType.PKCE
            }
        }
    }
}
