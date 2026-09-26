package com.example.motolock.data

import java.io.IOException
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Test

class PairingRecoveryTest {
    @Test fun savedMotorDoesNotProvision() = runBlocking {
        PairingRecovery {}.establish({}, { fail("Must not provision saved motor") })
    }

    @Test fun lostProvisionReplyRecoversWithoutSecondProvision() = runBlocking {
        var saved = false
        var provisions = 0
        PairingRecovery {}.establish(
            { if (!saved) throw IOException("ERR_NOT_PROVISIONED") },
            { provisions++; saved = true; throw IOException("Bluetooth command timed out") }
        )
        assertEquals(1, provisions)
    }

    @Test fun waitsForHelmetWithoutAnotherTap() = runBlocking {
        var attempts = 0
        PairingRecovery {}.establish(
            { throw IOException("ERR_NOT_PROVISIONED") },
            { if (++attempts < 4) throw IOException("ERR_HELMET_NOT_READY") }
        )
        assertEquals(4, attempts)
    }

    @Test fun waitsForPhysicalPairingWindow() = runBlocking {
        var attempts = 0
        val messages = mutableListOf<String>()
        PairingRecovery {}.establish(
            { throw IOException("ERR_NOT_PROVISIONED") },
            { if (++attempts < 3) throw IOException("ERR_PROVISIONING_NOT_ACTIVE") },
            { messages.add(it) }
        )
        assertTrue(messages.first().contains("BOOT"))
        assertEquals(3, attempts)
    }

    @Test fun rejectedCredentialsNeverTriggerProvision() = runBlocking {
        try {
            PairingRecovery {}.establish(
                { throw IOException("ERR_AUTH_FAILED") },
                { fail("Must not replace rejected credentials") }
            )
            fail("Must reject")
        } catch (e: IOException) { assertEquals("ERR_AUTH_FAILED", e.message) }
    }

    @Test fun timeoutsAreBounded() = runBlocking {
        var attempts = 0
        try {
            PairingRecovery {}.establish(
                { attempts++; throw IOException("Bluetooth command timed out") }, {}
            )
            fail("Must time out")
        } catch (e: IOException) { assertEquals(3, attempts) }
    }

    @Test fun waitingIsBounded() = runBlocking {
        var attempts = 0
        try {
            PairingRecovery {}.establish(
                { throw IOException("ERR_NOT_PROVISIONED") },
                { attempts++; throw IOException("ERR_HELMET_NOT_READY") }
            )
            fail("Must stop waiting")
        } catch (e: IOException) { assertEquals(60, attempts) }
    }

    @Test fun cancellationStopsImmediately() = runBlocking {
        try {
            PairingRecovery {}.establish({ throw CancellationException("Left screen") }, { fail() })
            fail("Must cancel")
        } catch (e: CancellationException) { assertEquals("Left screen", e.message) }
    }
}
