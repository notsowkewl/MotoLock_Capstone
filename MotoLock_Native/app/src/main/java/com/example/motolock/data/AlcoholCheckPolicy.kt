package com.example.motolock.data

/** STATUS controls the prompt; the motor still independently authorizes every unlock. */
object AlcoholCheckPolicy {
    enum class State { WAITING, WARMING, STABILIZING, NOT_WORN, DETECTED, READY }

    fun state(status: MotorStatus?, now: Long): State {
        if (status == null || now - status.receivedAt !in 0L..3500L ||
            status.helmetConnected != true || status.helmetDataFresh != true) return State.WAITING
        if (status.alcoholDetected == true || status.testStatus == "RESULT_FAIL") return State.DETECTED
        val raw = status.mq3Value
        val baseline = status.mq3Baseline
        if (status.mq3BaselineReady == true && raw != null && baseline != null &&
            raw in 6..4089 && baseline in 6..4089 &&
            (raw - baseline - 35).coerceAtLeast(0) * 0.500f /
            (4095 - baseline).coerceAtLeast(1) >= 0.050f) return State.DETECTED
        if (status.mq3BaselineReady != true || status.testStatus == "SENSOR_NOT_READY") return State.WARMING
        if (status.mq3Stabilizing != false || status.testStatus == "STABILIZING") return State.STABILIZING
        if (status.irDetected != true || status.testStatus == "HELMET_NOT_WORN") return State.NOT_WORN
        return if (status.testStatus == "RESULT_PASS" && status.alcoholDetected == false) State.READY else State.WAITING
    }
}
