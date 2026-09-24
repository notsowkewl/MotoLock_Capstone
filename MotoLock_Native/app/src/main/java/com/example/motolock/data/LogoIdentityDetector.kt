package com.example.motolock.data

import android.graphics.Bitmap
import android.graphics.Rect
import kotlin.math.cos
import kotlin.math.sin

interface LogoIdentityDetector {
    fun extractIdentity(bitmap: Bitmap, helmetBox: Rect): String?
}

class IntegratedLogoDetector : LogoIdentityDetector {
    
    // Total bits in the circular track around the logo
    private val TOTAL_SECTORS = 32
    // Sync marker to find rotation alignment
    private val SYNC_MARKER = intArrayOf(1, 0, 1, 0, 1, 1)
    
    override fun extractIdentity(bitmap: Bitmap, helmetBox: Rect): String? {
        val validBox = Rect(
            maxOf(0, helmetBox.left),
            maxOf(0, helmetBox.top),
            minOf(bitmap.width, helmetBox.right),
            minOf(bitmap.height, helmetBox.bottom)
        )
        
        if (validBox.width() < 50 || validBox.height() < 50) return null

        // 1. Crop and Grayscale
        val width = validBox.width()
        val height = validBox.height()
        val pixels = IntArray(width * height)
        bitmap.getPixels(pixels, 0, width, validBox.left, validBox.top, width, height)
        
        val luminance = IntArray(pixels.size)
        var sumLuminance = 0L
        for (i in pixels.indices) {
            val color = pixels[i]
            val r = (color shr 16) and 0xFF
            val g = (color shr 8) and 0xFF
            val b = color and 0xFF
            // Perceived luminance
            val lum = (0.299 * r + 0.587 * g + 0.114 * b).toInt()
            luminance[i] = lum
            sumLuminance += lum
        }
        val avgLuminance = (sumLuminance / pixels.size).toInt()

        // 2. Locate the 5cm sticker on the forehead using high-contrast edges
        val foreheadTop = (height * 0.05).toInt()
        val foreheadBottom = (height * 0.55).toInt() // upper half of helmet
        val foreheadLeft = (width * 0.2).toInt()
        val foreheadRight = (width * 0.8).toInt()

        var sumX = 0L
        var sumY = 0L
        var minX = width
        var maxX = 0
        var minY = height
        var maxY = 0
        var edgeCount = 0

        // Calculate simple gradient magnitude to find the sticker regardless of helmet color
        for (y in foreheadTop + 1 until foreheadBottom - 1) {
            for (x in foreheadLeft + 1 until foreheadRight - 1) {
                val dx = luminance[y * width + (x + 1)] - luminance[y * width + (x - 1)]
                val dy = luminance[(y + 1) * width + x] - luminance[(y - 1) * width + x]
                val mag = Math.abs(dx) + Math.abs(dy)
                
                if (mag > 60) { // Strong edge detected
                    sumX += x
                    sumY += y
                    if (x < minX) minX = x
                    if (x > maxX) maxX = x
                    if (y < minY) minY = y
                    if (y > maxY) maxY = y
                    edgeCount++
                }
            }
        }
        
        if (edgeCount < 40 || maxX <= minX || maxY <= minY) return null // Sticker edges not found

        val stickerWidth = maxX - minX
        val stickerHeight = maxY - minY
        
        // Ensure the detected edge clump is roughly square (circle viewed front-on or slightly angled)
        val aspect = stickerWidth.toFloat() / stickerHeight.toFloat()
        if (aspect < 0.4f || aspect > 2.5f) return null

        val cx = (sumX / edgeCount).toInt()
        val cy = (sumY / edgeCount).toInt()
        
        // Ensure center is valid
        if (cx < width * 0.1 || cx > width * 0.9 || cy < height * 0.05 || cy > height * 0.6) return null

        // 3. Scan concentric ring data pattern embedded into the shield perimeter
        // The outer bounding box captures the absolute outer edge of the logo.
        // We embedded the data slits into the outer border of the logo.
        // The slits are centered at approximately 85% (0.85) of the logo's radius.
        val boundsRadius = (stickerWidth + stickerHeight) / 4.0
        val radius = boundsRadius * 0.85
        
        val rawBits = IntArray(TOTAL_SECTORS)
        
        for (i in 0 until TOTAL_SECTORS) {
            val angle = 2.0 * Math.PI * i / TOTAL_SECTORS
            var sectorSum = 0
            var sampleCount = 0
            
            // Average a small region around the sample point
            for (dr in -2..2) {
                for (dtheta in -1..1) {
                    val r = radius + dr
                    val a = angle + dtheta * 0.05
                    val px = cx + (r * cos(a)).toInt()
                    val py = cy + (r * sin(a)).toInt()
                    
                    if (px in 0 until width && py in 0 until height) {
                        sectorSum += luminance[py * width + px]
                        sampleCount++
                    }
                }
            }
            
            if (sampleCount == 0) return null
            val sectorLum = sectorSum / sampleCount
            
            // Compare to the local average luminance of the sticker bounding box
            rawBits[i] = if (sectorLum < avgLuminance) 1 else 0
        }
        
        // 4. Find Sync Marker and Extract Payload & Checksum
        for (offset in 0 until TOTAL_SECTORS) {
            var match = true
            for (j in SYNC_MARKER.indices) {
                val bitIndex = (offset + j) % TOTAL_SECTORS
                if (rawBits[bitIndex] != SYNC_MARKER[j]) {
                    match = false
                    break
                }
            }
            
            if (match) {
                val payloadBits = TOTAL_SECTORS - SYNC_MARKER.size
                var payloadValue = 0
                var checksumValue = 0
                val idBitsCount = payloadBits - 8
                
                for (i in 0 until idBitsCount) {
                    val bitIndex = (offset + SYNC_MARKER.size + i) % TOTAL_SECTORS
                    payloadValue = (payloadValue shl 1) or rawBits[bitIndex]
                }
                
                for (i in 0 until 8) {
                    val bitIndex = (offset + SYNC_MARKER.size + idBitsCount + i) % TOTAL_SECTORS
                    checksumValue = (checksumValue shl 1) or rawBits[bitIndex]
                }
                
                val byte0 = payloadValue and 0xFF
                val byte1 = (payloadValue shr 8) and 0xFF
                val byte2 = (payloadValue shr 16) and 0xFF
                val calculatedChecksum = ((byte0 + byte1 + byte2) xor 0xAA) and 0xFF
                
                if (calculatedChecksum == checksumValue) {
                    return "MOTO-%05X".format(payloadValue)
                }
            }
        }
        
        return null // No valid sync marker with a matching CRC found
    }
}
