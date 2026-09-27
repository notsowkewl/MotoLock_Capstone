package com.example.motolock.data

import java.io.IOException
import kotlinx.coroutines.delay

/** Recover enrollment with the SAME saved secret, including a lost provisioning reply. */
internal class PairingRecovery(private val pause: suspend () -> Unit = { delay(500) }) {
    suspend fun establish(
        authenticate: suspend () -> Unit,
        provision: suspend () -> Unit,
        progress: (String) -> Unit = {}
    ) {
        var timeouts = 0
        var helmetNotReady = false
        var legacyFirmwareNeedsButton = false
        repeat(60) {
            try {
                try {
                    authenticate()
                    return
                } catch (e: IOException) {
                    if (e.message != "ERR_NOT_PROVISIONED") throw e
                }
                provision()
                return
            } catch (e: IOException) {
                when (e.message) {
                    "Bluetooth command timed out" -> {
                        if (++timeouts >= 3) throw e
                        progress("Checking whether the motor saved pairing…")
                    }
                    "ERR_ALREADY_PROVISIONED" -> {
                        // Authenticate on the next pass; never replace the saved secret.
                        if (++timeouts >= 3) throw e
                    }
                    "ERR_HELMET_NOT_READY" -> {
                        helmetNotReady = true
                        legacyFirmwareNeedsButton = false
                        progress("Bluetooth connected. Waiting for the motor to detect your helmet…")
                    }
                    "ERR_PROVISIONING_NOT_ACTIVE" -> {
                        helmetNotReady = false
                        legacyFirmwareNeedsButton = true
                        progress("This motor firmware still requires the BOOT button. Update it to the OLED PIN pairing firmware.")
                    }
                    else -> throw e
                }
            }
            pause()
        }
        when {
            legacyFirmwareNeedsButton -> throw IOException(
                "This motor still has the old firmware that requires the BOOT button. Upload the new OLED PIN pairing firmware, then retry in the app."
            )
            helmetNotReady -> throw IOException(
                "Bluetooth connected, but the motor cannot detect the helmet. Turn on the helmet, keep it near the motor, and retry."
            )
            else -> throw IOException("Bluetooth connected, but secure app pairing did not finish. Retry pairing and check the motor and helmet.")
        }
    }
}
