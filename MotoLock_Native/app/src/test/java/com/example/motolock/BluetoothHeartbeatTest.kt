package com.example.motolock.data

import org.junit.Assert.*
import org.junit.Test

class BluetoothHeartbeatTest {
    @Test fun silentConnectionExpiresWithoutSocketCallback() {
        val heartbeat = BluetoothHeartbeat(100)
        heartbeat.ping()
        assertFalse(heartbeat.expired(3599))
        assertTrue(heartbeat.expired(3600))
    }
    @Test fun matchingPongExtendsDeadline() {
        val heartbeat = BluetoothHeartbeat(0)
        val ping = heartbeat.ping().trim()
        assertTrue(heartbeat.receive(ping.replace("PING:", "PONG:"), 1000))
        assertFalse(heartbeat.expired(4499))
        assertTrue(heartbeat.expired(4500))
    }
    @Test fun statusAndUnsolicitedPongsDoNotKeepConnectionAlive() {
        val heartbeat = BluetoothHeartbeat(0)
        heartbeat.ping()
        assertFalse(heartbeat.receive("STATUS:{\"locked\":false}", 1000))
        assertFalse(heartbeat.receive("PONG:9999", 2000))
        assertFalse(heartbeat.receive("PONG", 3000))
        assertTrue(heartbeat.expired(3500))
    }
    @Test fun repeatedPongCannotRefreshLiveness() {
        val heartbeat = BluetoothHeartbeat(0)
        val pong = heartbeat.ping().trim().replace("PING:", "PONG:")
        assertTrue(heartbeat.receive(pong, 500))
        assertFalse(heartbeat.receive(pong, 3500))
        assertTrue(heartbeat.expired(4000))
    }
    @Test fun expiredSessionCannotBeResurrectedByLateReply() {
        val heartbeat = BluetoothHeartbeat(0)
        val pong = heartbeat.ping().trim().replace("PING:", "PONG:")
        assertFalse(heartbeat.receive(pong, 3500))
        assertTrue(heartbeat.expired(3500))
    }
}
