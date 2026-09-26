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
                    "ERR_HELMET_NOT_READY" -> progress("Waiting for the motor to verify your helmet…")
                    "ERR_PROVISIONING_NOT_ACTIVE" -> progress("First pairing: hold motor BOOT for 3 seconds, then release. Keep this screen open.")
                    else -> throw e
                }
            }
            pause()
        }
        throw IOException("Pairing did not finish. Check helmet power and the motor pairing window, then retry.")
    }
}
