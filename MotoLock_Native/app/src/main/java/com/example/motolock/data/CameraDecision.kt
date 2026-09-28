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

    private fun blank(
        helmetDetected: Boolean = false,
        helmetSensorActive: Boolean = false,
        faceDetected: Boolean = false,
        faceRecognized: Boolean = false,
        msg: String = ""
    ) = VerificationState(
        faceDetected = faceDetected,
        faceRecognized = faceRecognized,
        helmetDetected = helmetDetected,
        helmetSensorActive = helmetSensorActive,
        visorBlockingFace = false,
        finalAuthenticationState = false,
        message = msg
    )

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
        // Helmet confirmed if YOLO sees it, or if it was spatially associated, or if the logo sticker is visible
        val helmetSeen = helmetOnHead || spatiallyAssociatedHelmetWithoutFace || (extractedLogoId != null)

        // Multiple faces – reject always
        if (faceCount > 1) {
            return blank(msg = "Multiple faces detected. Only one rider allowed.")
        }

        when (phase) {

            // ── PHASE 1 ─────────────────────────────────────────────────────────
            Phase.NEED_HELMET -> {
                return when {
                    helmetSeen && irOn -> {
                        // Helmet confirmed AND chin bar is down. Advance.
                        phase = Phase.NEED_FACE
                        blank(
                            helmetDetected = true,
                            helmetSensorActive = true,
                            msg = "Registered helmet detected. Lift your chin bar for Face ID."
                        )
                    }
                    helmetSeen && !irOn -> {
                        // Helmet visible but chin bar isn't down yet
                        blank(
                            helmetDetected = true,
                            msg = "Helmet detected. Close the chin bar, then lift it for Face ID."
                        )
                    }
                    !helmetSeen && irOn -> {
                        // Sensor is on but camera can't see the helmet (visor blocking or bad angle)
                        blank(
                            helmetSensorActive = true,
                            msg = "Sensor active. Center your helmet in frame so the camera can confirm it."
                        )
                    }
                    else -> {
                        // Nothing detected yet
                        blank(msg = "No helmet detected. Put your helmet on.")
                    }
                }
            }

            // ── PHASE 2 ─────────────────────────────────────────────────────────
            Phase.NEED_FACE -> {
                return when {
                    faceRecognized -> {
                        // Face verified. Advance.
                        phase = Phase.NEED_CHIN_BAR
                        blank(
                            helmetDetected = true,
                            faceDetected = true,
                            faceRecognized = true,
                            msg = "Face verified. Pull down your chin bar to secure the helmet."
                        )
                    }
                    faceDetected && !faceRecognized -> {
                        blank(
                            helmetDetected = true,
                            faceDetected = true,
                            msg = "Face ID not recognized. Make sure you are the registered rider."
                        )
                    }
                    irOn -> {
                        // Chin bar is back down before face was verified – remind them to lift it
                        blank(
                            helmetDetected = true,
                            helmetSensorActive = true,
                            msg = "Registered helmet detected. Lift your chin bar for Face ID."
                        )
                    }
                    else -> {
                        blank(
                            helmetDetected = true,
                            msg = "No face detected. Move closer to the camera."
                        )
                    }
                }
            }

            // ── PHASE 3 ─────────────────────────────────────────────────────────
            Phase.NEED_CHIN_BAR -> {
                if (!irOn) {
                    // Still waiting for chin bar to close
                    return blank(
                        helmetDetected = true,
                        faceDetected = faceDetected,
                        faceRecognized = true,
                        msg = "Face verified. Pull down your chin bar to secure the helmet."
                    )
                }

                // Chin bar closed → helmet is connected → proceed to alcohol check
                // The motor ESP32 handles final security (secret + helmet sensor flags) in the UNLOCK command
                return if (telemetry.isConnected) {
                    VerificationState(
                        faceDetected = faceDetected,
                        faceRecognized = true,
                        helmetDetected = true,
                        helmetSensorActive = true,
                        visorBlockingFace = false,
                        finalAuthenticationState = true,
                        message = "Rider and helmet secured. Proceeding to alcohol detection..."
                    )
                } else {
                    blank(
                        helmetDetected = true,
                        helmetSensorActive = true,
                        faceRecognized = true,
                        msg = "Connect your paired helmet."
                    )
                }
            }
        }
    }

    private fun ByteArray?.isNullOrEmptyBytes() = this == null || isEmpty()
}
