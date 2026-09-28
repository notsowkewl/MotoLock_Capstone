package com.example.motolock

import com.example.motolock.data.AlcoholSampleWindow
import com.example.motolock.data.MotorStatus
import org.junit.Assert.*
import org.junit.Test

class AlcoholSampleWindowTest {
    private fun sample(raw: Int, time: Long) = MotorStatus(true, true, "RESULT_PASS", true,
        false, true, time, true, false, raw, 995)

    @Test fun retainsPeakWhenReadingFallsAndIgnoresAfterDeadline() {
        val window = AlcoholSampleWindow()
        window.start(1000, sample(1340, 900))
        window.observe(sample(1650, 4000), 4000)
        window.observe(sample(1100, 15000), 15000)
        assertEquals(0.100f, window.maximum!!, 0.000001f)
        assertTrue(window.detected)
        assertEquals(0L, window.remaining(16000))
        window.observe(sample(2000, 16001), 16001)
        assertEquals(0.100f, window.maximum!!, 0.000001f)
    }

    @Test fun restartClearsPeakAndRejectsStaleSamples() {
        val window = AlcoholSampleWindow()
        window.start(1000, sample(1650, 900))
        window.start(20000)
        window.observe(sample(2000, 1000), 21000)
        assertNull(window.maximum)
        assertFalse(window.detected)
        window.observe(sample(1100, 21000), 21000)
        assertEquals(sample(1100, 21000).alcoholPercent!!, window.maximum!!, 0.000001f)
    }
}
