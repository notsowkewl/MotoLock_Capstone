package com.example.motolock

import kotlinx.coroutines.runBlocking
import com.example.motolock.network.SupabaseClientManager
import com.example.motolock.models.*
import io.github.jan.supabase.postgrest.postgrest

fun main() = runBlocking {
    try {
        println("Testing Emergency Contacts decode...")
        val emergencyContacts = SupabaseClientManager.client.postgrest["emergency_contacts"]
            .select().decodeList<EmergencyContact>()
        println("Success: " + emergencyContacts.size)
    } catch(e: Exception) {
        println("Error fetching emergency_contacts: ${e.message}")
        e.printStackTrace()
    }
}
