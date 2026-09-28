package com.example.motolock

import com.example.motolock.data.CameraDecision
import com.example.motolock.data.FaceData
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class CameraFlowTest {
    private val keys = java.security.KeyPairGenerator.getInstance("EC").apply { initialize(256) }.generateKeyPair()
    private val nonce = ByteArray(32) { it.toByte() }

    private fun telemetry(): com.example.motolock.data.HelmetTelemetry {
        val payload = java.nio.ByteBuffer.allocate(56)
        payload.put(2.toByte())
        payload.put(byteArrayOf(1, 2, 3, 4, 5, 6))
        payload.putInt(123)
        payload.put(nonce)
        payload.putLong(1L)
        payload.put(15.toByte())
        payload.putShort(1000.toShort())
        payload.putShort(1000.toShort())
        val signer = java.security.Signature.getInstance("SHA256withECDSA")
        signer.initSign(keys.private)
        signer.update(payload.array())
        return com.example.motolock.data.HelmetProtocol.parseTelemetry("TELEMETRY:" +
            com.example.motolock.data.HelmetProtocol.hex(payload.array()) + "," +
            com.example.motolock.data.HelmetProtocol.hex(signer.sign()))
    }

    private fun evaluate(
        faceCount: Int = 1, matches: Boolean = true, helmet: Boolean = true,
        data: com.example.motolock.data.HelmetTelemetry = telemetry(),
        deviceId: String? = "010203040506", visualId: String? = "MOTO-0007B",
        key: ByteArray? = keys.public.encoded, logo: String? = "MOTO-0007B",
        sequenceValid: Boolean = true, challenge: ByteArray? = nonce,
        associated: Boolean = false
    ) = CameraDecision.evaluate(faceCount, matches, helmet, data, deviceId, visualId,
        challenge, key, logo, sequenceValid, associated)

    @Test fun signedHelmetAndRecognizedRiderPass() {
        assertTrue(evaluate().finalAuthenticationState)
    }

    @Test fun identityPrecedesHelmetPrompt() {
        assertEquals("Face ID not recognized.", evaluate(matches = false, helmet = false).message)
        assertTrue(evaluate(helmet = false).message.contains("Helmet sensor is ON"))
        assertEquals("Lift your visor.", evaluate(faceCount = 0, associated = true).message)
    }

    @Test fun multipleAndMissingFacesInvalidatePreviousPass() {
        for (count in listOf(0, 2, 3)) assertFalse(evaluate(faceCount = count).finalAuthenticationState)
        assertFalse(evaluate(matches = false).finalAuthenticationState)
        assertFalse(evaluate(helmet = false).finalAuthenticationState)
    }

    @Test fun missingOrMismatchedPairingNeverPasses() {
        assertFalse(evaluate(deviceId = null).finalAuthenticationState)
        assertFalse(evaluate(visualId = null).finalAuthenticationState)
        assertFalse(evaluate(key = null).finalAuthenticationState)
        assertFalse(evaluate(key = byteArrayOf()).finalAuthenticationState)
        assertFalse(evaluate(deviceId = "other").finalAuthenticationState)
        assertFalse(evaluate(logo = "other").finalAuthenticationState)
        assertFalse(evaluate(logo = null).finalAuthenticationState)
    }

    @Test fun invalidStaleAndReplayedTelemetryNeverPasses() {
        val signed = telemetry()
        assertFalse(evaluate(data = signed.copy(isConnected = false)).finalAuthenticationState)
        assertFalse(evaluate(data = signed.copy(receivedAt = System.currentTimeMillis() - 2000)).finalAuthenticationState)
        assertFalse(evaluate(data = signed.copy(receivedAt = System.currentTimeMillis() + 60000)).finalAuthenticationState)
        assertFalse(evaluate(data = signed.copy(signature = byteArrayOf(1))).finalAuthenticationState)
        assertFalse(evaluate(data = signed.copy(signature = null)).finalAuthenticationState)
        assertFalse(evaluate(data = signed.copy(sequence = 2)).finalAuthenticationState)
        assertFalse(evaluate(data = signed.copy(sensorActive = false)).finalAuthenticationState)
        assertFalse(evaluate(sequenceValid = false).finalAuthenticationState)
        assertFalse(evaluate(challenge = ByteArray(32) { 99 }).finalAuthenticationState)
        assertFalse(evaluate(challenge = null).finalAuthenticationState)
    }

    @Test fun changingAnySignedByteRejectsThePacket() {
        val original = telemetry()
        for (index in 0 until 56) {
            val payload = original.signedPayload!!.copyOf()
            payload[index] = (payload[index].toInt() xor 1).toByte()
            assertFalse("tamper offset $index", evaluate(data = original.copy(signedPayload = payload)).finalAuthenticationState)
        }
    }

    @Test fun wrongPublicKeyCannotVerifyHelmet() {
        val other = java.security.KeyPairGenerator.getInstance("EC").apply { initialize(256) }.generateKeyPair()
        assertFalse(evaluate(key = other.public.encoded).finalAuthenticationState)
    }

    @Test fun malformedWireDataAndOldUnsignedTelemetryAreRejected() {
        val invalid = listOf("TELEMETRY:helmet-1,1,1,abcd,abcd", "TELEMETRY:00,00", "TELEMETRY:zz,11", "STATUS:{}")
        for (line in invalid) assertTrue(runCatching { com.example.motolock.data.HelmetProtocol.parseTelemetry(line) }.isFailure)
    }

    @Test fun identityRoundTripPreservesThePinnedPublicKey() {
        val protocol = com.example.motolock.data.HelmetProtocol
        val identity = protocol.parseIdentity("HELMET_ID:010203040506,MOTO-0007B," + protocol.hex(keys.public.encoded))
        assertEquals("MOTO-0007B", identity.visualId)
        assertArrayEquals(keys.public.encoded, identity.publicKey)
        assertTrue(runCatching { protocol.parseIdentity("HELMET_ID:010203040506,MOTO-FFFFF,00") }.isFailure)
    }

    @Test fun savedArraysAndLegacyStringsDecodeIdentically() {
        val array = JsonArray(List(192) { JsonPrimitive((it - 96) / 192f) })
        assertArrayEquals(FaceData.decode(array), FaceData.decode(JsonPrimitive(array.toString())), 0f)
        val saved = FaceData.decode(array)
        assertTrue(FaceData.matches(saved, FloatArray(192) { saved[it] * 3 }))
        assertFalse(FaceData.matches(saved, FloatArray(192) { -saved[it] }))
    }

    @Test fun placeholdersMalformedAndWrongModelVectorsAreRejected() {
        val bad = listOf<JsonElement?>(null, JsonNull, JsonPrimitive("broken"),
            JsonArray(List(128) { JsonPrimitive(0.1f) }),
            JsonArray(List(192) { JsonPrimitive(0.1f) }),
            JsonArray(List(192) { JsonPrimitive(if (it == 0) "NaN" else "1") }))
        for (value in bad) assertTrue(runCatching { FaceData.decode(value) }.isFailure)
    }
}
