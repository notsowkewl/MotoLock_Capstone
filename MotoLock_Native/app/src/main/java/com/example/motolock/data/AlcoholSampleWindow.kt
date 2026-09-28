package com.example.motolock.data

/** One fixed sampling window; readings arriving after its deadline cannot change its peak. */
class AlcoholSampleWindow(private val durationMs: Long = 15000L) {
    var startedAt: Long? = null
        private set
    var maximum: Float? = null
        private set
    var detected = false
        private set

    fun start(now: Long, initialStatus: MotorStatus? = null) {
        reset()
        startedAt = now
        if (initialStatus != null && now - initialStatus.receivedAt in 0L..3500L) capture(initialStatus)
    }
    fun reset() { startedAt = null; maximum = null; detected = false }
    fun remaining(now: Long): Long = startedAt?.let { (it + durationMs - now).coerceAtLeast(0) } ?: durationMs

    fun observe(status: MotorStatus?, now: Long) {
        val start = startedAt ?: return
        if (status == null || now !in start..(start + durationMs) ||
            status.receivedAt !in start..(start + durationMs) ||
            now - status.receivedAt !in 0L..3500L || status.helmetConnected != true ||
            status.helmetDataFresh != true || status.mq3BaselineReady != true) return
        capture(status)
    }

    private fun capture(status: MotorStatus) {
        if (status.helmetConnected != true || status.helmetDataFresh != true || status.mq3BaselineReady != true) return
        val reading = status.alcoholPercent ?: return
        maximum = maximum?.let { maxOf(it, reading) } ?: reading
        detected = detected || reading >= 0.050f || status.alcoholDetected == true || status.testStatus == "RESULT_FAIL"
    }
}
