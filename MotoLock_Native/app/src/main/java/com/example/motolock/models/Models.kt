package com.example.motolock.models

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class User(
    val id: String,
    val name: String,
    val email: String,
    val role: String = "rider",
    val status: String = "active",
    @SerialName("face_descriptor") val faceDescriptor: kotlinx.serialization.json.JsonElement? = null,
    @SerialName("helmet_descriptor") val helmetDescriptor: kotlinx.serialization.json.JsonElement? = null,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null,
    @SerialName("password_hash") val passwordHash: String = "managed_by_auth"
)

@Serializable
data class Motorcycle(
    val id: String? = null,
    @SerialName("user_id") val userId: String,
    val brand: String? = null,
    
    val model: String? = null,
    val year: Int? = null,
    @SerialName("plate_number") val plateNumber: String? = null,
    val color: String? = null,
    val status: String? = "locked",
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
data class EmergencyContact(
    val id: String? = null,
    @SerialName("user_id") val userId: String,
    val name: String,
    @SerialName("phone_number") val phone: String,
    val relationship: String,
    @SerialName("is_primary") val isPrimary: Boolean = false,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
data class Pin(
    @SerialName("user_id") val userId: String,
    val pin: String,
    @SerialName("created_at") val createdAt: String? = null,
    @SerialName("updated_at") val updatedAt: String? = null
)

@Serializable
data class Device(
    val id: String? = null,
    @SerialName("user_id") val userId: String,
    @SerialName("motorcycle_id") val motorcycleId: String? = null,
    @SerialName("mac_address") val macAddress: String,
    @SerialName("helmet_device_id") val helmetDeviceId: String? = null,
    @SerialName("helmet_visual_id") val helmetVisualId: String? = null,
    val status: String? = "active"
)
