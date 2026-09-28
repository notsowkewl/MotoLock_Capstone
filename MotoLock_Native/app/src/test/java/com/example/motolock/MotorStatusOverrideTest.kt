package com.example.motolock

import com.example.motolock.data.MotorStatus
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MotorStatusOverrideTest {
    @Test fun parsesPhysicalOverrideState() {
        val status = MotorStatus.parse(
            """STATUS:{"helmetConnected":true,"helmetDataFresh":true,"testStatus":"RESULT_PASS","locked":false,"alcoholDetected":false,"irDetected":true,"overrideActive":true}""",
            1000
        )
        assertTrue(requireNotNull(status).overrideActive)
    }

    @Test fun absentOverrideFieldDefaultsToInactive() {
        val status = MotorStatus.parse(
            """STATUS:{"helmetConnected":true,"helmetDataFresh":true,"testStatus":"RESULT_PASS","locked":false,"alcoholDetected":false,"irDetected":true}""",
            1000
        )
        assertFalse(requireNotNull(status).overrideActive)
    }
}
