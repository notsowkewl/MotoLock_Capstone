package com.example.motolock

import com.example.motolock.models.RideHistory
import com.example.motolock.models.Motorcycle
import com.example.motolock.models.EmergencyContact
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class SupabaseDataMappingTest {
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    @Test fun setupModelsContainOnlyExistingColumnsEvenWhenDefaultsAreEncoded() {
        val fullJson = Json { encodeDefaults = true }
        val motorcycle = fullJson.parseToJsonElement(fullJson.encodeToString(Motorcycle(userId = "rider-1"))).jsonObject
        val contact = fullJson.parseToJsonElement(fullJson.encodeToString(EmergencyContact(
            userId = "rider-1", name = "Contact", phone = "09000000000", relationship = "Friend"
        ))).jsonObject
        assertFalse(motorcycle.containsKey("status"))
        assertFalse(contact.containsKey("updated_at"))
        assertEquals("09000000000", contact["phone_number"]?.jsonPrimitive?.content)
    }

    @Test fun decodesExistingRideColumnsIncludingNullableReadings() {
        val ride = json.decodeFromString<RideHistory>("""{
            "id":"ride-1","user_id":"rider-1","device_id":"device-1",
            "initial_brac_level":0.025,"final_brac_level":null,
            "gps_start_lat":14.601,"gps_start_lng":121.001,
            "gps_end_lat":null,"gps_end_lng":null,"status":"completed",
            "start_time":"2026-09-01T08:00:00+08:00","end_time":null
        }""")
        assertEquals(0.025f, ride.alcoholLevel!!, 0.000001f)
        assertEquals(121.001, ride.startLon!!, 0.000001)
        assertEquals("device-1", ride.deviceId)
        assertEquals("2026-09-01T08:00:00+08:00", ride.startTime)
        assertNull(ride.finalAlcoholLevel)
        val missing = json.decodeFromString<RideHistory>("""{"user_id":"rider-1","initial_brac_level":null}""")
        assertNull(missing.alcoholLevel)
    }

    @Test fun writesOnlySupabaseRideColumnsAndLeavesGeneratedIdOmitted() {
        val payload = json.parseToJsonElement(json.encodeToString(RideHistory(
            userId = "rider-1", deviceId = "device-1", alcoholLevel = 0.025f, status = "ongoing",
            startLat = 14.601, startLon = 121.001, startTime = "2026-09-01T08:00:00+08:00"
        ))).jsonObject
        assertEquals(setOf("user_id", "device_id", "initial_brac_level", "gps_start_lat", "gps_start_lng", "start_time", "status"), payload.keys)
    }
}
