package com.example.motolock.data

/** Monotonic, session-local heartbeat tracking. Unsolicited/repeated PONGs do not extend liveness. */
internal class BluetoothHeartbeat(private val startedAt: Long, private val timeoutMs: Long = 3500) {
    private var nextToken = 0L
    private var lastReply = startedAt
    private val outstanding = linkedSetOf<String>()
    @Synchronized fun ping(): String {
        val token = (++nextToken).toString()
        outstanding.add(token)
        while (outstanding.size > 4) outstanding.remove(outstanding.first())
        return "PING:$token\n"
    }
    @Synchronized fun receive(line: String, now: Long): Boolean {
        if (!line.startsWith("PONG:") || expired(now)) return false
        val token = line.substringAfter(':')
        if (!outstanding.remove(token)) return false
        lastReply = now
        return true
    }
    @Synchronized fun expired(now: Long) = now - lastReply >= timeoutMs
}
