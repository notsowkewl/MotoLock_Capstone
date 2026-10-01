package com.example.motolock.data

data class VerificationState(
    val faceDetected: Boolean,
    val faceRecognized: Boolean,
    val helmetDetected: Boolean,
    val helmetSensorActive: Boolean,
    val visorBlockingFace: Boolean,
    val finalAuthenticationState: Boolean,
    val message: String
)

/**
 * Forward-only state machine for the unlock flow.
 *
 * PHASE 1 – NEED_HELMET
 *   → Camera AI confirms helmet on head AND IR sensor is ON (chin bar down)
 *   → Advance to NEED_FACE. Never return to this phase.
 *
 * PHASE 2 – NEED_FACE
 *   → Rider lifts chin bar (IR OFF), face is verified by FaceNet
 *   → Advance to NEED_CHIN_BAR. Never return to this phase.
 *
 * PHASE 3 – NEED_CHIN_BAR
 *   → Rider pulls chin bar back down (IR ON again)
 *   → Advance to DONE → finalAuthenticationState = true
 *
 * Call reset() whenever the unlock screen opens fresh.
 */
object CameraDecision {

    enum class Phase { NEED_HELMET, NEED_FACE, NEED_CHIN_BAR }

    @Volatile private var phase = Phase.NEED_HELMET

    fun reset() {
        phase = Phase.NEED_HELMET
    }

    fun currentPhase(): Phase = phase

    private fun blank(
        helmetDetected: Boolean = false,
        helmetSensorActive: Boolean = false,
        faceDetected: Boolean = false,
        faceRecognized: Boolean = false,
        msg: String = ""
    ): VerificationState {
        return VerificationState(
            faceDetected = faceDetected,
            faceRecognized = faceRecognized,
            helmetDetected = helmetDetected,
            helmetSensorActive = helmetSensorActive,
            visorBlockingFace = false,
            finalAuthenticationState = false,
            message = msg
        )
    }

    fun evaluate(
        faceCount: Int,
        faceMatches: Boolean,
        helmetOnHead: Boolean,
        telemetry: HelmetTelemetry,
        pairedHelmetDeviceId: String?,
        pairedHelmetVisualId: String?,
        expectedNonce: ByteArray?,
        helmetPublicKey: ByteArray?,
        extractedLogoId: String?,
        isSequenceValid: Boolean,
        spatiallyAssociatedHelmetWithoutFace: Boolean = false,
        recentlyRecognized: Boolean = false
    ): VerificationState {

        val irOn = telemetry.sensorActive
        val faceDetected = faceCount == 1
        val faceRecognized = faceDetected && faceMatches
        val helmetSeen = helmetOnHead || spatiallyAssociatedHelmetWithoutFace
        val helmetProofValid = telemetry.isConnected && isSequenceValid &&
            !pairedHelmetDeviceId.isNullOrBlank() && telemetry.deviceId == pairedHelmetDeviceId &&
            !pairedHelmetVisualId.isNullOrBlank() && telemetry.visualId == pairedHelmetVisualId &&
            expectedNonce != null && expectedNonce.size == 32 &&
            helmetPublicKey != null && helmetPublicKey.isNotEmpty() &&
            HelmetCrypto.verifySignature(telemetry, expectedNonce, helmetPublicKey)

        // Phase Logic removed. Jumping straight to the simple Matrix.

        // TEMPORARY SIMPLE LOGIC AS REQUESTED BY USER
        
        // 1. If NO FACE is detected, but a HELMET is detected, that means the visor/chin bar is covering the face!
        // We should allow this to proceed to the Matrix.
        if (faceCount == 0 && !helmetSeen) {
            return blank(msg = "No rider detected. Waiting for rider...")
        }

        // 2. Multiple riders (If the camera glitches and sees 2 faces, we just ignore the background face and trust the primary one if it's large enough. For this simple test, we will just warn but not strictly block if we already see the helmet).
        if (faceCount > 1 && !helmetSeen) {
            return blank(msg = "Multiple faces detected. Only one rider allowed.")
        }

        // 3. Apply the Matrix:
        if (irOn && helmetSeen) {
            return blank(
                helmetDetected = true,
                helmetSensorActive = true,
                faceDetected = true,
                msg = "IR=1, Helmet=Y. Step 1 Passed. Proceed to next step."
            )
        } 
        else if (irOn && !helmetSeen) {
            return blank(
                helmetSensorActive = true,
                faceDetected = true,
                msg = "IR=1, Helmet=N. No helmet detected on camera."
            )
        }
        else if (!irOn && helmetSeen) {
            return blank(
                helmetDetected = true,
                faceDetected = true,
                msg = "IR=0, Helmet=Y. Pull down your chin bar."
            )
        }
        else { // !irOn && !helmetSeen
            return blank(
                faceDetected = true,
                msg = "IR=0, Helmet=N. No helmet detected."
            )
        }
    } // Missing closing brace for evaluate()

    private fun ByteArray?.isNullOrEmptyBytes() = this == null || isEmpty()
}
