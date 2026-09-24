# coding=utf-8
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/data'
os.makedirs(output_dir, exist_ok=True)

ds_kt = """package com.example.motolock.data

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.*
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

val Context.dataStore: DataStore<Preferences> by preferencesDataStore(name = "motolock_prefs")

class MotoLockDataStore(private val context: Context) {
    
    companion object {
        val RIDER_NAME = stringPreferencesKey("rider_name")
        val RIDER_PHONE = stringPreferencesKey("rider_phone")
        val SECURITY_PIN = stringPreferencesKey("security_pin")
        val EMERGENCY_CONTACT = stringPreferencesKey("emergency_contact")
        val MOTORCYCLE_BRAND = stringPreferencesKey("motorcycle_brand")
        val MOTORCYCLE_NAME = stringPreferencesKey("motorcycle_name")
    }

    val riderNameFlow: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[RIDER_NAME] ?: ""
    }
    
    val riderPhoneFlow: Flow<String> = context.dataStore.data.map { preferences ->
        preferences[RIDER_PHONE] ?: ""
    }

    suspend fun saveRiderProfile(name: String, phone: String) {
        context.dataStore.edit { preferences ->
            preferences[RIDER_NAME] = name
            preferences[RIDER_PHONE] = phone
        }
    }
    
    suspend fun saveEmergencyContact(contact: String) {
        context.dataStore.edit { preferences ->
            preferences[EMERGENCY_CONTACT] = contact
        }
    }
    
    suspend fun saveMotorcycle(brand: String, name: String) {
        context.dataStore.edit { preferences ->
            preferences[MOTORCYCLE_BRAND] = brand
            preferences[MOTORCYCLE_NAME] = name
        }
    }
}
"""

with open(os.path.join(output_dir, "MotoLockDataStore.kt"), "w", encoding="utf-8") as f:
    f.write(ds_kt)
print("DataStore created")
