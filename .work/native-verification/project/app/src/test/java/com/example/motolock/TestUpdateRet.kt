package com.example.motolock

import kotlinx.coroutines.runBlocking
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import io.github.jan.supabase.gotrue.providers.builtin.Email
import io.github.jan.supabase.postgrest.postgrest

fun main() = runBlocking {
    try {
        SupabaseClientManager.client.auth.signInWith(Email) {
            email = "rider@gmail.com"
            password = "password123!"
        }
        val uid = SupabaseClientManager.client.auth.currentSessionOrNull()?.user?.id
        println("User ID: $uid")
        
        val emb = FloatArray(128) { 0.1f }
        val json = "[" + emb.joinToString(",") + "]"
        
        println("Attempting update...")
        val res = SupabaseClientManager.client.postgrest["users"].update({ 
            set("face_descriptor", json)
        }) { 
            filter { eq("id", uid!!) } 
            select() // return updated rows
        }
        println("Update returned data: ${res.data}")
    } catch(e: Exception) {
        println("Error: ${e.message}")
        e.printStackTrace()
    }
}
