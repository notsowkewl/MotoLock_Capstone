package com.example.motolock.data

import android.content.Context
import java.nio.ByteBuffer
import java.security.KeyFactory
import java.security.spec.X509EncodedKeySpec

data class HelmetIdentity(val deviceId: String, val visualId: String, val publicKey: ByteArray) {
    fun save(context: Context) {
        check(context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE).edit()
            .putString("helmet_device_id", deviceId).putString("helmet_visual_id", visualId)
            .putString("helmet_public_key", HelmetProtocol.hex(publicKey)).commit()) { "Unable to save helmet pairing" }
    }
    fun matches(other: HelmetIdentity) = deviceId == other.deviceId && visualId == other.visualId && publicKey.contentEquals(other.publicKey)
    companion object {
        fun load(context: Context): HelmetIdentity? = runCatching {
            val prefs = context.getSharedPreferences("MotoLockPrefs", Context.MODE_PRIVATE)
            HelmetProtocol.parseIdentity("HELMET_ID:${prefs.getString("helmet_device_id", "")},${prefs.getString("helmet_visual_id", "")},${prefs.getString("helmet_public_key", "")}")
        }.getOrNull()
    }
}

object HelmetProtocol {
    fun hex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it.toInt() and 255) }
    fun unhex(text: String): ByteArray {
        require(text.length % 2 == 0 && text.matches(Regex("[0-9a-fA-F]*"))) { "Invalid hex data" }
        return ByteArray(text.length / 2) { text.substring(it * 2, it * 2 + 2).toInt(16).toByte() }
    }
    fun parseIdentity(line: String): HelmetIdentity {
        require(line.startsWith("HELMET_ID:"))
        val parts = line.substringAfter(':').split(',')
        require(parts.size == 3 && parts[0].matches(Regex("[0-9a-f]{12}")) && parts[1].matches(Regex("MOTO-[0-3][0-9A-F]{4}")))
        val key = unhex(parts[2])
        require(key.size in 64..128)
        val parsed = KeyFactory.getInstance("EC").generatePublic(X509EncodedKeySpec(key)) as java.security.interfaces.ECPublicKey
        require(parsed.params.curve.field.fieldSize == 256)
        return HelmetIdentity(parts[0], parts[1], key)
    }
    fun parseTelemetry(line: String, now: Long = System.currentTimeMillis()): HelmetTelemetry {
        require(line.startsWith("TELEMETRY:"))
        val parts = line.substringAfter(':').split(',')
        require(parts.size == 2)
        val payload = unhex(parts[0])
        val signature = unhex(parts[1])
        require(payload.size == 56 && payload[0].toInt() == 2 && signature.size in 8..72)
        val data = ByteBuffer.wrap(payload)
        val visual = data.getInt(7)
        val sequence = data.getLong(43)
        val flags = payload[51].toInt() and 255
        val raw = data.getShort(52).toInt() and 65535
        val baseline = data.getShort(54).toInt() and 65535
        require(visual in 0..0x3ffff && sequence > 0 && flags and 0xe0 == 0 && raw <= 4095 && baseline <= 4095)
        require(flags and 8 == 0 || (raw in 6..4089 && baseline in 6..4089))
        require(flags and 4 == 0 || (flags and 10 == 10 && flags and 16 == 0))
        return HelmetTelemetry(hex(payload.copyOfRange(1, 7)), flags and 1 != 0, now, sequence, now,
            true, payload.copyOfRange(11, 43), signature, payload, flags, "MOTO-%05X".format(visual))
    }
}
