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

object CameraDecision {
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
        val logoMatched = (extractedLogoId != null && extractedLogoId == pairedHelmetVisualId)
        val cameraState = evaluateCamera(
            faceCount, faceMatches, helmetOnHead, telemetry.sensorActive,
            spatiallyAssociatedHelmetWithoutFace, recentlyRecognized, logoMatched
        )
        if (!cameraState.finalAuthenticationState) return cameraState

        val ageMs = System.currentTimeMillis() - telemetry.receivedAt
        val failure = when {
            pairedHelmetDeviceId.isNullOrBlank() || pairedHelmetVisualId.isNullOrBlank() ||
                helmetPublicKey.isNullOrEmptyBytes() -> "Pair your helmet before unlocking."
            !telemetry.isConnected -> "Connect your paired helmet."
            telemetry.deviceId != pairedHelmetDeviceId -> "Connected helmet does not match your paired helmet."
            ageMs !in 0L..1000L -> "Waiting for fresh helmet telemetry."
            expectedNonce == null || expectedNonce.size != 32 || !isSequenceValid -> "Waiting for helmet challenge verification."
            !HelmetCrypto.verifySignature(telemetry, expectedNonce, helmetPublicKey!!) -> "Helmet signature verification failed."
            telemetry.visualId != pairedHelmetVisualId -> "Helmet visual identity does not match pairing."
            telemetry.flags and 0x0e != 0x0e || telemetry.flags and 0x10 != 0 -> "Helmet sensor warming up or alcohol check not clear."
            extractedLogoId != pairedHelmetVisualId -> "Show the paired helmet logo to the camera."
            else -> null
        }
        return if (failure == null) cameraState else cameraState.copy(
            finalAuthenticationState = false, message = failure
        )
    }

    private fun ByteArray?.isNullOrEmptyBytes() = this == null || isEmpty()
    private fun evaluateCamera(
        faceCount: Int, 
        faceMatches: Boolean, 
        helmetOnHead: Boolean, 
        irSensorActive: Boolean,
        spatiallyAssociatedHelmetWithoutFace: Boolean = false,
        recentlyRecognized: Boolean = false,
        logoMatched: Boolean = false
    ): VerificationState {
        val faceDetected = faceCount == 1
        val multipleFaces = faceCount > 1
        
        // CASE 3: Visor DOWN - Strong evidence required. Not just "no face + helmet anywhere".
        val visorBlockingFace = !faceDetected && spatiallyAssociatedHelmetWithoutFace

        val state = VerificationState(
            faceDetected = faceDetected,
            faceRecognized = faceDetected && faceMatches,
            helmetDetected = helmetOnHead || spatiallyAssociatedHelmetWithoutFace,
            helmetSensorActive = irSensorActive,
            visorBlockingFace = visorBlockingFace,
            finalAuthenticationState = false,
            message = ""
        )

        return when {
            multipleFaces -> state.copy(message = "Multiple faces detected. Only one rider allowed.")
            
            // CASE 2: Different/unregistered rider
            faceDetected && !faceMatches -> state.copy(message = "Face ID not recognized.")
            
            // ── NEW SECURE WORKFLOW ──────────────────────────────────────────
            // State 3: Visor DOWN after face was recently verified -> SUCCESS
            visorBlockingFace && irSensorActive && recentlyRecognized && logoMatched -> state.copy(
                finalAuthenticationState = true,
                message = "Rider and helmet secured. Proceeding to alcohol detection..."
            )
            
            // State 3 Alt: Missing logo
            visorBlockingFace && irSensorActive && recentlyRecognized && !logoMatched -> state.copy(
                message = "Face verified, but logo missing. Show the MotoLock logo to the camera."
            )
            
            // State 1: Visor DOWN initially (never verified face)
            visorBlockingFace && irSensorActive && !recentlyRecognized && logoMatched -> state.copy(
                message = "Registered helmet detected. Lift your chin bar for Face ID."
            )
            
            // State 1 Alt: Helmet detected, no face, IR=1, not spatially associated (new scan)
            !faceDetected && helmetOnHead && irSensorActive && !recentlyRecognized && logoMatched -> state.copy(
                message = "Registered helmet detected. Lift your chin bar for Face ID."
            )

            // State 1 Missing Logo: Helmet detected, IR=1, but no logo seen yet
            (!faceDetected || visorBlockingFace) && helmetOnHead && irSensorActive && !recentlyRecognized && !logoMatched -> state.copy(
                message = "Show the MotoLock logo on your helmet to the camera."
            )

            // State 2: Visor is UP (Face verified, Helmet ON, IR=0) -> Tell them to close it
            faceDetected && faceMatches && helmetOnHead && !irSensorActive -> state.copy(
                message = "Face verified. Pull down your chin bar to secure the helmet."
            )
            // ─────────────────────────────────────────────────────────────────

            // Transition: Visor is coming down (Face blocked, IR=0 still)
            visorBlockingFace && !irSensorActive -> state.copy(
                message = "Face hidden. Pull down your chin bar to activate the sensor."
            )
            
            // No face, no helmet
            !faceDetected && !spatiallyAssociatedHelmetWithoutFace && !helmetOnHead -> state.copy(
                message = "No face detected. Keep your face visible."
            )
            
            // Registered rider, no helmet detected by camera
            faceDetected && faceMatches && !helmetOnHead && irSensorActive -> state.copy(
                message = "Helmet sensor is ON, but the camera can't confirm your helmet. Center your head in frame, improve the lighting, and show the helmet logo."
            )

            faceDetected && faceMatches && !helmetOnHead -> state.copy(
                message = "No helmet detected. Put your helmet on."
            )
            
            // Open-face helmet case (Face verified, helmet on, IR=1 simultaneously)
            faceDetected && faceMatches && helmetOnHead && irSensorActive -> state.copy(
                finalAuthenticationState = true,
                message = "Face and helmet verified. Proceeding to alcohol detection..."
            )
            
            else -> state.copy(message = "Verifying...")
        }
    }
}
