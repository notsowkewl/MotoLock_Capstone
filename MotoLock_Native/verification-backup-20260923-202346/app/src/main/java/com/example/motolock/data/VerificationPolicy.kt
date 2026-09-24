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

/** Only the pre-start flow is governed here. Never cut an already running engine. */
class VerificationGate {
    enum class Stage { BARE_FACE, PUT_ON_HELMET, ALCOHOL, AUTHORIZING, READY, STARTED }
    var stage = Stage.BARE_FACE; private set
    var message = "Remove helmet, keep the IR sensor clear, and look at the camera"; private set
    private var lastVision = 0L
    private var lastHardware = 0L
    private var helmetWorn = false
    private var matched = false
    private var helmetVisible = false
    private var stable = 0
    private var transitionStart = 0L
    private var irRise = 0L
    private var cameraRise = 0L
    private var liveComplete = false
    private var sawActiveTest = false
    private var authorizationAt = 0L
    var needsCancel = false; private set
    var resetGeneration = 0; private set

    fun reset(reason: String) {
        if (stage == Stage.STARTED) return
        resetGeneration++
        needsCancel = needsCancel || stage >= Stage.ALCOHOL
        stage = Stage.BARE_FACE; stable = 0; liveComplete = false
        transitionStart = 0; irRise = 0; cameraRise = 0; sawActiveTest = false
        lastVision = 0; matched = false; helmetVisible = false; authorizationAt = 0
        message = reason
    }

    fun cancelSent() { needsCancel = false }

    fun hardware(now: Long, worn: Boolean, test: String, authorized: Boolean, locked: Boolean, sensorFresh: Boolean = true) {
        val previousWorn = helmetWorn
        helmetWorn = worn; lastHardware = now
        if (stage == Stage.STARTED) return
        // A running relay is terminal: no later camera failure may send a relay-off command.
        if (!locked) { stage = Stage.STARTED; message = "Motor started. Keep your helmet on."; return }
        if (!sensorFresh) { lastHardware = 0; reset("Helmet transmitter readings are stale. Check its battery and connection."); return }
        if (stage == Stage.PUT_ON_HELMET && !previousWorn && worn) irRise = now
        if (stage >= Stage.ALCOHOL && !worn) { reset("Helmet sensor cleared. Start verification again."); return }
        if (stage == Stage.ALCOHOL) {
            if (test in setOf("SENSOR_STABILIZING", "BASELINE_READING", "WAITING_FOR_BLOW", "BLOW_DETECTED", "MEASURING_ALCOHOL")) sawActiveTest = true
            if (test == "RESULT_FAIL") reset("Alcohol test failed. Starting is blocked.")
        }
        if (stage == Stage.AUTHORIZING && authorized && valid(now)) {
            stage = Stage.READY; authorizationAt = now
            message = "Checks passed. Keep facing the camera and press the motorcycle start button."
        }
    }

    fun vision(now: Long, captureTime: Long, faceMatches: Boolean, helmetOnHead: Boolean, liveness: Boolean, reason: String) {
        if (stage == Stage.STARTED) return
        lastVision = captureTime; matched = faceMatches; helmetVisible = helmetOnHead
        if (!VerificationPolicy.fresh(now, captureTime) || !faceMatches) {
            reset(reason); return
        }
        if (!VerificationPolicy.fresh(now, lastHardware)) { reset("Waiting for fresh helmet sensor readings"); return }
        when (stage) {
            Stage.BARE_FACE -> {
                if (helmetOnHead || helmetWorn) { stable = 0; liveComplete = false; resetGeneration++; message = "Remove helmet and keep its IR sensor clear"; return }
                liveComplete = liveness
                message = if (liveness) "Hold still" else reason
                if (liveness && ++stable >= VerificationPolicy.STABLE_SAMPLES) {
                    stage = Stage.PUT_ON_HELMET; transitionStart = now; stable = 0
                    message = "Put on the paired helmet. Keep your face and the whole helmet in view."
                }
            }
            Stage.PUT_ON_HELMET -> {
                if (now - transitionStart > 30000) { reset("Helmet transition timed out. Start again."); return }
                if (helmetOnHead && cameraRise == 0L) cameraRise = now
                if (!helmetOnHead) { cameraRise = 0; stable = 0 }
                if (helmetOnHead && helmetWorn && irRise > transitionStart && cameraRise > transitionStart) {
                    if (kotlin.math.abs(irRise - cameraRise) > 4000) { reset("Camera and IR did not detect the same wearing transition. Start again."); return }
                    if (++stable >= VerificationPolicy.STABLE_SAMPLES) {
                        stage = Stage.ALCOHOL; message = "Keep your face visible and blow for the alcohol test"
                    }
                } else { stable = 0 }
            }
            else -> if (!helmetOnHead) reset("Helmet no longer visible on your head. Start again.")
        }
    }

    fun valid(now: Long) = matched && helmetVisible && helmetWorn && liveComplete &&
        VerificationPolicy.fresh(now, lastVision) && VerificationPolicy.fresh(now, lastHardware)

    fun acceptPass(now: Long): Boolean {
        if (stage != Stage.ALCOHOL || !sawActiveTest || !valid(now)) return false
        stage = Stage.AUTHORIZING; authorizationAt = now; message = "Confirming start authorization with hardware"
        return true
    }

    fun tick(now: Long) {
        if (stage == Stage.STARTED) return
        if (lastVision > 0 && !VerificationPolicy.fresh(now, lastVision)) reset("Camera stopped or frames are too old. Start again.")
        if (lastHardware > 0 && !VerificationPolicy.fresh(now, lastHardware)) reset("Hardware readings expired. Reconnect your helmet.")
        if (stage == Stage.PUT_ON_HELMET && now - transitionStart > 30000) reset("Helmet transition timed out. Start again.")
        if (stage >= Stage.AUTHORIZING && now - authorizationAt > 10000) reset("Start authorization expired. Verify again.")
    }
}
