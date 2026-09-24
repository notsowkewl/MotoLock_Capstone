package com.example.motolock.data

object LogoEncoder {
    
    private val SYNC_MARKER = intArrayOf(1, 0, 1, 0, 1, 1)

    /**
     * Generates the deterministic 32-sector bit pattern for a given helmet ID payload.
     * The output array represents the physical MotoLock logo data ring.
     * 1 = Dark (Ink), 0 = Light (Background/White)
     * Payload must fit in 18 bits (max 0x3FFFF).
     */
    fun encodeHelmetId(payloadValue: Int): IntArray {
        require(payloadValue in 0..0x3FFFF) { "Payload must be an 18-bit integer" }
        
        val bits = IntArray(32)
        
        // 1. Write 6-bit Sync Marker
        for (i in SYNC_MARKER.indices) {
            bits[i] = SYNC_MARKER[i]
        }
        
        // 2. Write 18-bit Payload (MSB first to match decoder)
        for (i in 0 until 18) {
            val bit = (payloadValue shr (17 - i)) and 1
            bits[6 + i] = bit
        }
        
        // 3. Calculate 8-bit Checksum (Pseudo CRC-8)
        val byte0 = payloadValue and 0xFF
        val byte1 = (payloadValue shr 8) and 0xFF
        val byte2 = (payloadValue shr 16) and 0xFF
        val checksumValue = ((byte0 + byte1 + byte2) xor 0xAA) and 0xFF
        
        // 4. Write 8-bit Checksum (MSB first to match decoder)
        for (i in 0 until 8) {
            val bit = (checksumValue shr (7 - i)) and 1
            bits[24 + i] = bit
        }
        
        return bits
    }
    
    /**
     * Helper string representation for physical printing instructions.
     */
    fun getPrintablePattern(payloadValue: Int): String {
        val encoded = encodeHelmetId(payloadValue)
        return encoded.joinToString("") { if (it == 1) "¦" else "?" }
    }
}
