package com.example.motolock.data

import android.graphics.Bitmap
import android.graphics.Rect
import kotlin.math.*

interface LogoIdentityDetector {
    fun extractIdentity(bitmap: Bitmap, helmetBox: Rect): String?
}

/** Reads the shield slots using either the green print margin or the red lock/M.
 * Red-component registration supports transparent/cut-out versions of the artwork.
 * Both paths validate the logo, sync and checksum; no paired ID is assumed here.
 * Strong perspective, occlusion and severe print/camera distortion may be rejected.
 */
class IntegratedLogoDetector : LogoIdentityDetector {
    private val TOTAL_SECTORS = 32
    private val SYNC_MARKER = intArrayOf(1, 0, 1, 0, 1, 1)
    private data class Point(val x: Double, val y: Double)
    private data class Frame(val angle: Double, val left: Double, val top: Double,
                             val right: Double, val bottom: Double) {
        val area get() = (right - left) * (bottom - top)
        fun map(x: Double, y: Double): Point {
            val u = left + x * (right - left)
            val v = top + y * (bottom - top)
            return Point(u * cos(angle) - v * sin(angle), u * sin(angle) + v * cos(angle))
        }
    }

    override fun extractIdentity(bitmap: Bitmap, helmetBox: Rect): String? {
        val left = helmetBox.left.coerceIn(0, bitmap.width)
        val top = helmetBox.top.coerceIn(0, bitmap.height)
        val right = helmetBox.right.coerceIn(0, bitmap.width)
        val bottom = helmetBox.bottom.coerceIn(0, bitmap.height)
        if (right - left < 50 || bottom - top < 50) return null
        // Bound connected-component work on high-resolution camera frames.
        val step = max(1, ceil(max(right - left, bottom - top) / 800.0).toInt())
        val width = (right - left + step - 1) / step
        val height = (bottom - top + step - 1) / step
        val pixels = IntArray(width * height)
        val row = IntArray(right - left)
        for (y in 0 until height) {
            bitmap.getPixels(row, 0, row.size, left, top + y * step, row.size, 1)
            for (x in 0 until width) pixels[y * width + x] = row[x * step]
        }
        fun green(color: Int): Boolean {
            val r = (color ushr 16) and 255
            val g = (color ushr 8) and 255
            val b = color and 255
            return g > 55 && g > r * 1.25 && g > b * 1.25
        }
        val mask = BooleanArray(pixels.size) { green(pixels[it]) }
        val queue = IntArray(pixels.size)
        val candidates = mutableListOf<List<Point>>()
        for (start in mask.indices) {
            if (!mask[start]) continue
            var read = 0
            var count = 1
            queue[0] = start
            mask[start] = false
            val boundary = mutableListOf<Point>()
            while (read < count) {
                val index = queue[read++]
                val x = index % width
                val y = index / width
                var edge = false
                for (direction in 0..3) {
                    val nx = x + when (direction) { 0 -> -1; 1 -> 1; else -> 0 }
                    val ny = y + when (direction) { 2 -> -1; 3 -> 1; else -> 0 }
                    if (nx !in 0 until width || ny !in 0 until height) { edge = true; continue }
                    val next = ny * width + nx
                    if (!green(pixels[next])) edge = true
                    if (mask[next]) { mask[next] = false; queue[count++] = next }
                }
                if (edge) boundary.add(Point(x.toDouble(), y.toDouble()))
            }
            if (count >= 120 && boundary.size >= 40) candidates.add(boundary)
        }
        val frames = mutableListOf<Pair<Frame, Boolean>>()
        // Largest green components first; cap cost on textured backgrounds.
        for (boundary in candidates.sortedByDescending { it.size }.take(8)) {
            var best: Frame? = null
            for (degrees in -45..45) {
                val angle = degrees * PI / 180
                val c = cos(angle); val s = sin(angle)
                var minU = Double.POSITIVE_INFINITY; var maxU = Double.NEGATIVE_INFINITY
                var minV = Double.POSITIVE_INFINITY; var maxV = Double.NEGATIVE_INFINITY
                for (p in boundary) {
                    val u = p.x * c + p.y * s; val v = -p.x * s + p.y * c
                    minU = min(minU, u); maxU = max(maxU, u)
                    minV = min(minV, v); maxV = max(maxV, v)
                }
                val frame = Frame(angle, minU - 0.5, minV - 0.5, maxU + 0.5, maxV + 0.5)
                if (best == null || frame.area < best.area) best = frame
            }
            best?.let { frames.add(it to true) }
        }
        frames.addAll(redFrames(pixels, width, height).map { it to false })
        val identities = mutableSetOf<String>()
        for ((frame, needsGreenMargin) in frames) {
            val fw = frame.right - frame.left; val fh = frame.bottom - frame.top
            if (fw < 75 || fh < 85 || fw / fh !in 0.5..1.25) continue
            fun colorAt(x: Double, y: Double): Int? {
                val p = frame.map(x, y)
                val px = p.x.roundToInt(); val py = p.y.roundToInt()
                return if (px in 0 until width && py in 0 until height)
                    pixels[py * width + px].takeIf { (it ushr 24) >= 128 } else null
            }
            // Confirm a green rectangular margin, not just a green object nearby.
            val margin = listOf(0.025 to 0.025, 0.975 to 0.025, 0.025 to 0.975,
                0.975 to 0.975, 0.5 to 0.025, 0.5 to 0.975)
            if (needsGreenMargin && !margin.all { (x, y) -> colorAt(x, y)?.let { green(it) } == true }) continue
            fun sourceColor(x: Double, y: Double) = colorAt((x - 48) / 396, (y - 12) / 466.7143)
            // Red lock and M anchors make checksum matches on unrelated shapes insufficient.
            val anchors = listOf(247.0 to 52.0, 181.0 to 126.0, 311.0 to 126.0,
                168.0 to 200.0, 325.0 to 200.0, 247.0 to 245.0)
            if (!anchors.all { (x, y) ->
                val color = sourceColor(x, y)
                if (color == null) false else {
                    val r = (color ushr 16) and 255; val g = (color ushr 8) and 255; val b = color and 255
                    r > 50 && r > g * 1.4 && r > b * 1.4
                }
            }) continue
            val bits = IntArray(32)
            var valid = true
            for ((i, point) in slots.withIndex()) {
                // Median of a small source-relative patch preserves narrow slots at small sizes.
                val samples = mutableListOf<Int>()
                for (dy in -1..1) for (dx in -1..1) {
                    sourceColor(point.x + dx * 1.5, point.y + dy * 1.5)?.let { samples.add(it) }
                }
                if (samples.size != 9) { valid = false; break }
                val colors = samples.sortedBy { ((it ushr 16) and 255) + ((it ushr 8) and 255) + (it and 255) }
                val color = colors[4]
                val r = (color ushr 16) and 255; val g = (color ushr 8) and 255; val b = color and 255
                val light = (r + g + b) / 3
                // Green is never a white data slot, even when its luminance is high.
                if (maxOf(r, g, b) - minOf(r, g, b) > 65 || light in 96..154) { valid = false; break }
                bits[i] = if (light < 96) 1 else 0
            }
            if (!valid || !SYNC_MARKER.indices.all { bits[it] == SYNC_MARKER[it] }) continue
            var payload = 0
            for (i in 6 until 24) payload = (payload shl 1) or bits[i]
            var checksum = 0
            for (i in 24 until 32) checksum = (checksum shl 1) or bits[i]
            val expected = (((payload and 255) + ((payload ushr 8) and 255) +
                ((payload ushr 16) and 255)) xor 0xAA) and 255
            if (checksum == expected) identities.add("MOTO-%05X".format(payload))
        }
        return identities.singleOrNull()
    }

    private data class RedRegion(val count: Int, val x: Double, val y: Double,
                                 val xx: Double, val yy: Double, val xy: Double)

    private fun redFrames(pixels: IntArray, width: Int, height: Int): List<Frame> {
        val mask = BooleanArray(pixels.size) {
            val color = pixels[it]
            val r = (color ushr 16) and 255; val g = (color ushr 8) and 255; val b = color and 255
            (color ushr 24) >= 128 && r > 50 && r > g * 1.4 && r > b * 1.4
        }
        val queue = IntArray(pixels.size)
        val regions = mutableListOf<RedRegion>()
        for (start in mask.indices) {
            if (!mask[start]) continue
            var count = 1; var read = 0
            var xSum = 0.0; var ySum = 0.0
            var xxSum = 0.0; var yySum = 0.0; var xySum = 0.0
            queue[0] = start; mask[start] = false
            while (read < count) {
                val index = queue[read++]
                val x = index % width; val y = index / width
                xSum += x; ySum += y
                xxSum += x.toDouble() * x; yySum += y.toDouble() * y; xySum += x.toDouble() * y
                for (direction in 0..3) {
                    val nx = x + when (direction) { 0 -> -1; 1 -> 1; else -> 0 }
                    val ny = y + when (direction) { 2 -> -1; 3 -> 1; else -> 0 }
                    if (nx !in 0 until width || ny !in 0 until height) continue
                    val next = ny * width + nx
                    if (mask[next]) { mask[next] = false; queue[count++] = next }
                }
            }
            if (count < 40) continue
            val x = xSum / count; val y = ySum / count
            regions.add(RedRegion(count, x, y, xxSum / count - x * x,
                yySum / count - y * y, xySum / count - x * y))
        }
        // These spatial moments come from the red components in public/logo.png,
        // using the same red threshold as above. They describe artwork, not ID bits.
        val lockX = 247.258594; val lockY = 91.022115
        val mX = 247.506439; val mY = 237.686247
        val result = mutableListOf<Frame>()
        val largest = regions.sortedByDescending { it.count }.take(12)
        for (lock in largest) for (letter in largest) {
            if (lock === letter || letter.count.toDouble() / lock.count !in 1.6..2.6) continue
            val dx = letter.x - lock.x; val dy = letter.y - lock.y
            val distance = hypot(dx, dy)
            if (dy <= 0 || distance < 22) continue
            var angle = atan2(-dx, dy)
            if (abs(angle) > PI / 4) continue
            fun horizontalVariance(region: RedRegion, a: Double): Double {
                val c = cos(a); val s = sin(a)
                return c * c * region.xx + s * s * region.yy + 2 * c * s * region.xy
            }
            val lockScale = sqrt(horizontalVariance(lock, angle) / 2719.029691)
            val mScale = sqrt(horizontalVariance(letter, angle) / 4178.903431)
            if (lockScale / mScale !in 0.9..1.1) continue
            val sx = (lockScale + mScale) / 2
            val sy = distance / (mY - lockY)
            if (sx / sy !in 0.6..1.4) continue
            // The source component centroids differ slightly in X.
            angle += atan2((mX - lockX) * sx, (mY - lockY) * sy)
            val c = cos(angle); val s = sin(angle)
            val u = lock.x * c + lock.y * s
            val v = -lock.x * s + lock.y * c
            val left = u + (48 - lockX) * sx
            val top = v + (12 - lockY) * sy
            result.add(Frame(angle, left, top, left + 396 * sx, top + 466.7143 * sy))
        }
        return result
    }

    private val slots: List<Point> = run {
        val outline = arrayOf(
            floatArrayOf(147f,108f), floatArrayOf(126f,116f), floatArrayOf(104f,124f),
            floatArrayOf(86f,133f), floatArrayOf(78f,148f), floatArrayOf(78f,171f),
            floatArrayOf(79f,198f), floatArrayOf(81f,227f), floatArrayOf(85f,256f),
            floatArrayOf(92f,284f), floatArrayOf(103f,312f), floatArrayOf(119f,339f),
            floatArrayOf(141f,366f), floatArrayOf(168f,391f), floatArrayOf(199f,414f),
            floatArrayOf(226f,430f), floatArrayOf(247f,441f), floatArrayOf(268f,430f),
            floatArrayOf(295f,414f), floatArrayOf(326f,391f), floatArrayOf(353f,366f),
            floatArrayOf(375f,339f), floatArrayOf(391f,312f), floatArrayOf(402f,284f),
            floatArrayOf(409f,256f), floatArrayOf(413f,227f), floatArrayOf(415f,198f),
            floatArrayOf(416f,171f), floatArrayOf(416f,148f), floatArrayOf(408f,133f),
            floatArrayOf(390f,124f), floatArrayOf(368f,116f), floatArrayOf(347f,108f)
        )
        val lengths = (0 until outline.lastIndex).map { i ->
            hypot(outline[i + 1][0] - outline[i][0], outline[i + 1][1] - outline[i][1]).toDouble()
        }
        val perimeter = lengths.sum()
        List(TOTAL_SECTORS) { i ->
            var distance = perimeter * (i + 0.5) / TOTAL_SECTORS
            var segment = 0
            while (segment < lengths.lastIndex && distance > lengths[segment]) distance -= lengths[segment++]
            val t = distance / lengths[segment]
            Point(outline[segment][0] + (outline[segment + 1][0] - outline[segment][0]) * t,
                outline[segment][1] + (outline[segment + 1][1] - outline[segment][1]) * t)
        }
    }
}
