package com.example.motolock.data

import android.content.Context
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import java.security.KeyFactory
import java.security.PublicKey
import java.security.Signature
import java.security.spec.X509EncodedKeySpec

data class HelmetTelemetry(
    val deviceId: String?,
    val sensorActive: Boolean,
    val timestamp: Long,
    val sequence: Long,
    val receivedAt: Long,
    val isConnected: Boolean,
    val nonce: ByteArray?,
    val signature: ByteArray?
)

interface HelmetTelemetryManager {
    fun getTelemetry(): HelmetTelemetry
    fun initiateChallenge(nonce: ByteArray)
}

object HelmetCrypto {
    /**
     * Verifies the ECDSA (SHA256withECDSA) signature of the telemetry payload.
     * Payload structure: Nonce (32 bytes) || Sequence (8 bytes) || SensorActive (1 byte)
     */
    fun verifySignature(telemetry: HelmetTelemetry, expectedNonce: ByteArray, publicKeyBytes: ByteArray): Boolean {
        if (telemetry.nonce == null || telemetry.signature == null || !telemetry.nonce.contentEquals(expectedNonce)) {
            return false
        }
        
        return try {
            val keySpec = X509EncodedKeySpec(publicKeyBytes)
            val keyFactory = KeyFactory.getInstance("EC")
            val publicKey: PublicKey = keyFactory.generatePublic(keySpec)
            
            val sig = Signature.getInstance("SHA256withECDSA")
            sig.initVerify(publicKey)
            
            sig.update(telemetry.nonce)
            
            val seqBytes = ByteArray(8)
            var seq = telemetry.sequence
            for (i in 7 downTo 0) {
                seqBytes[i] = (seq and 0xFF).toByte()
                seq = seq shr 8
            }
            sig.update(seqBytes)
            
            val sensorByte: Byte = if (telemetry.sensorActive) 1 else 0
            sig.update(sensorByte)
            
            sig.verify(telemetry.signature)
        } catch (e: Exception) {
            false
        }
    }
}

class RealHelmetTelemetryManager(private val context: Context) : HelmetTelemetryManager {
    
    private var currentTelemetry = HelmetTelemetry(
        deviceId = null,
        sensorActive = false,
        timestamp = System.currentTimeMillis(),
        sequence = 0L,
        receivedAt = System.currentTimeMillis(),
        isConnected = false,
        nonce = null,
        signature = null
    )
    
    private var isListening = false
    
    private fun startListening() {
        if (isListening) return
        val btService = com.example.motolock.SessionState.activeBluetoothService ?: return
        isListening = true
        
        kotlinx.coroutines.GlobalScope.launch(kotlinx.coroutines.Dispatchers.IO) {
            btService.readDataStream().collect { line ->
                if (line.startsWith("TELEMETRY:")) {
                    try {
                        // Format: TELEMETRY:<deviceId>,<sensorActive(1/0)>,<sequence>,<nonceHex>,<signatureHex>
                        val parts = line.substringAfter("TELEMETRY:").split(",")
                        if (parts.size >= 5) {
                            currentTelemetry = HelmetTelemetry(
                                deviceId = parts[0],
                                sensorActive = parts[1] == "1",
                                timestamp = System.currentTimeMillis(),
                                sequence = parts[2].toLong(),
                                receivedAt = System.currentTimeMillis(),
                                isConnected = true,
                                nonce = parts[3].chunked(2).map { it.toInt(16).toByte() }.toByteArray(),
                                signature = parts[4].chunked(2).map { it.toInt(16).toByte() }.toByteArray()
                            )
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }
        }
    }

    override fun getTelemetry(): HelmetTelemetry {
        if (!isListening && com.example.motolock.SessionState.activeBluetoothService != null) {
            startListening()
        }
        return currentTelemetry
    }

    override fun initiateChallenge(nonce: ByteArray) {
        val btService = com.example.motolock.SessionState.activeBluetoothService ?: return
        val nonceHex = nonce.joinToString("") { "%02x".format(it) }
        btService.writeCommand("CHALLENGE:$nonceHex\n")
    }
}


