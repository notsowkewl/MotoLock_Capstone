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
    val signature: ByteArray?,
    val signedPayload: ByteArray? = null,
    val flags: Int = 0,
    val visualId: String? = null
)

interface HelmetTelemetryManager {
    fun getTelemetry(): HelmetTelemetry
    fun initiateChallenge(nonce: ByteArray)
    fun close() {}
}

object HelmetCrypto {
    /**
     * Verifies the ECDSA (SHA256withECDSA) signature of the telemetry payload.
     * V2 payload layout is shared with MotoLockProtocol.h. No unsigned fallback.
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
            
            val payload = telemetry.signedPayload ?: return false
            val decoded = HelmetProtocol.parseTelemetry("TELEMETRY:${HelmetProtocol.hex(payload)},${HelmetProtocol.hex(telemetry.signature)}")
            if (decoded.deviceId != telemetry.deviceId || decoded.visualId != telemetry.visualId ||
                decoded.sequence != telemetry.sequence || decoded.flags != telemetry.flags ||
                decoded.sensorActive != telemetry.sensorActive || !decoded.nonce!!.contentEquals(expectedNonce)) return false
            sig.update(payload)
            
            sig.verify(telemetry.signature)
        } catch (e: Exception) {
            false
        }
    }
}

class RealHelmetTelemetryManager(context: Context) : HelmetTelemetryManager {
    private val service = com.example.motolock.SessionState.activeBluetoothService
    private val scope = kotlinx.coroutines.CoroutineScope(kotlinx.coroutines.SupervisorJob() + Dispatchers.IO)
    @Volatile private var current = HelmetTelemetry(null, false, 0, 0, 0, false, null, null)
    init {
        scope.launch(start = kotlinx.coroutines.CoroutineStart.UNDISPATCHED) {
            service?.readDataStream()?.collect { line ->
                if (line.startsWith("TELEMETRY:")) {
                    runCatching { HelmetProtocol.parseTelemetry(line) }.onSuccess { next ->
                        val old = current
                        // Repeated or older packets must not refresh their receive time.
                        if (old.nonce == null || !old.nonce.contentEquals(next.nonce) || next.sequence > old.sequence) current = next
                    }
                }
            }
        }
    }
    override fun getTelemetry(): HelmetTelemetry = current.copy(isConnected = service?.isConnected == true)
    override fun initiateChallenge(nonce: ByteArray) {
        require(nonce.size == 32)
        runCatching { service?.writeCommand("CHALLENGE:" + HelmetProtocol.hex(nonce) + "\n") }
    }
    override fun close() { scope.coroutineContext[kotlinx.coroutines.Job]?.cancel() }
}
