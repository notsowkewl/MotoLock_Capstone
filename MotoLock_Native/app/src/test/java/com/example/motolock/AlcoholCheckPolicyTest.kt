package com.example.motolock

import com.example.motolock.data.AlcoholCheckPolicy
import com.example.motolock.data.AlcoholCheckPolicy.State
import com.example.motolock.data.MotorStatus
import org.junit.Assert.assertEquals
import org.junit.Test

class AlcoholCheckPolicyTest {
    @Test fun acceptsFirmwareAuthorizationFlagWithoutAcceptingUnknownBits() {
        val payload = java.nio.ByteBuffer.allocate(56)
        payload.put(0, 2.toByte())
        payload.putLong(43, 1L)
        payload.put(51, 47.toByte()) // worn, warmed, clear, sensor OK, app authorized
        payload.putShort(52, 1000.toShort())
        payload.putShort(54, 1000.toShort())
        val protocol = com.example.motolock.data.HelmetProtocol
        fun line() = "TELEMETRY:" + protocol.hex(payload.array()) + "," + protocol.hex(ByteArray(8))
        assertEquals(47, protocol.parseTelemetry(line(), 1000).flags)
        payload.put(51, 79.toByte()) // unknown bit 6
        org.junit.Assert.assertThrows(IllegalArgumentException::class.java) { protocol.parseTelemetry(line(), 1000) }
    }

    private val ready = MotorStatus(true, true, "RESULT_PASS", true, false, true, 1000,
        true, false, 1000, 1000)

    @Test fun waitsUntilSensorReadyAndStable() {
        assertEquals(State.WARMING, AlcoholCheckPolicy.state(ready.copy(mq3BaselineReady = false), 1100))
        assertEquals(State.STABILIZING, AlcoholCheckPolicy.state(ready.copy(mq3Stabilizing = true), 1100))
        assertEquals(State.READY, AlcoholCheckPolicy.state(ready, 1100))
        assertEquals(State.WAITING, AlcoholCheckPolicy.state(ready, 5001))
        assertEquals(State.WAITING, AlcoholCheckPolicy.state(ready.copy(helmetDataFresh = false), 1100))
    }

    @Test fun thresholdIsInclusiveAndUsesRawReadingNotRoundedDisplay() {
        // Baseline 995 gives usable range 3100; delta 310 is exactly 0.050%.
        assertEquals(State.DETECTED, AlcoholCheckPolicy.state(ready.copy(mq3Baseline = 995, mq3Value = 1340), 1100))
        assertEquals(State.READY, AlcoholCheckPolicy.state(ready.copy(mq3Baseline = 995, mq3Value = 1339), 1100))
        assertEquals(0.050f, ready.copy(mq3Baseline = 995, mq3Value = 1340).alcoholPercent!!, 0.000001f)
        assertEquals(0f, ready.alcoholPercent!!, 0.000001f)
        assertEquals(State.DETECTED, AlcoholCheckPolicy.state(ready.copy(alcoholDetected = true), 1100))
        assertEquals(State.DETECTED, AlcoholCheckPolicy.state(ready.copy(testStatus = "RESULT_FAIL"), 1100))
    }

    @Test fun parsesActualFirmwareStatusFields() {
        val status = MotorStatus.parse("""STATUS:{"helmetConnected":true,"helmetDataFresh":true,"testStatus":"RESULT_PASS","locked":true,"alcoholDetected":false,"irDetected":true,"mq3BaselineReady":true,"mq3Stabilizing":false,"mq3Value":1000,"mq3Baseline":1000}""", 1000)
        assertEquals(State.READY, AlcoholCheckPolicy.state(status, 1100))
        assertEquals(State.WARMING, AlcoholCheckPolicy.state(ready.copy(mq3BaselineReady = null), 1100))
    }
}
