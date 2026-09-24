package com.example.motolock.data

import kotlin.math.sqrt

/** Pure, testable checks. Thresholds require validation with this camera/model population. */
object VerificationPolicy {
    const val FACE_SIZE = 192
    const val MAX_FACE_DISTANCE = 0.85f
    const val MAX_SAMPLE_AGE_MS = 2500L
    const val STABLE_SAMPLES = 4

    fun normalize(values: FloatArray): FloatArray {
        require(values.size == FACE_SIZE && values.all { it.isFinite() }) { "Invalid face embedding. Register your face again." }
        require((values.maxOrNull()!! - values.minOrNull()!!) > 0.00001f) { "Placeholder face profile. Register your face again." }
        val norm = sqrt(values.sumOf { (it * it).toDouble() }).toFloat()
        require(norm > 0.00001f) { "Empty face embedding" }
        return FloatArray(values.size) { values[it] / norm }
    }

    fun distance(a: FloatArray, b: FloatArray): Float {
        val x = normalize(a); val y = normalize(b)
        return sqrt(x.indices.sumOf { val d = x[it] - y[it]; (d * d).toDouble() }).toFloat()
    }

    fun fresh(now: Long, timestamp: Long) = timestamp > 0 && now - timestamp in 0..MAX_SAMPLE_AGE_MS
}

