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
        window.start(1000, sample(1100, 900))
        window.observe(sample(1650, 4000), 4000)
        window.observe(sample(2000, 4100), 4100)
        window.observe(sample(1100, 5000), 5000)
        assertEquals(0.100f, window.maximum!!, 0.000001f)
        assertTrue(window.detected)
        assertEquals(0L, window.remaining(6000))
        window.observe(sample(2000, 6001), 6001)
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

    @Test fun cleanWindowEndsAtFiveSecondsWithoutAddingLaterReadings() {
        val window = AlcoholSampleWindow()
        window.start(1000, sample(1100, 900))
        assertEquals(5000L, window.remaining(1000))
        window.observe(sample(1200, 5999), 5999)
        val peak = window.maximum
        window.observe(sample(2000, 6001), 6001)
        assertEquals(peak, window.maximum)
        assertFalse(window.detected)
    }

    @Test fun explicitAlcoholReportLatchesWithoutFakingTheLegalLimit() {
        val window = AlcoholSampleWindow()
        window.start(1000)
        val detected = MotorStatus(true, true, "RESULT_FAIL", true, true, true, 1200,
            true, false, 1050, 995)
        window.reportDetected(detected, 1200)
        assertTrue(window.detected)
        assertEquals(detected.alcoholPercent!!, window.maximum!!, 0.000001f)
        window.observe(sample(2000, 1300), 1300)
        assertEquals(detected.alcoholPercent!!, window.maximum!!, 0.000001f)
    }
}
