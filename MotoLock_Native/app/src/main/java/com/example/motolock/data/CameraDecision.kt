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
        spatiallyAssociatedHelmetWithoutFace: Boolean = false
    ): VerificationState {
        val cameraState = evaluateCamera(
            faceCount, faceMatches, helmetOnHead, telemetry.sensorActive,
            spatiallyAssociatedHelmetWithoutFace
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
        spatiallyAssociatedHelmetWithoutFace: Boolean = false
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
            
            // CASE 2: Different/unregistered rider (Priority over helmet)
            faceDetected && !faceMatches -> state.copy(message = "Face ID not recognized.")
            
            // CASE 3: Visor DOWN (Spatially associated helmet covering the last known face region)
            visorBlockingFace -> state.copy(message = "Lift your visor.")
            
            // No face, no helmet
            !faceDetected && !spatiallyAssociatedHelmetWithoutFace -> state.copy(message = "No face detected. Keep your face visible.")
            
            // CASE 1: Registered rider, no helmet
            faceDetected && faceMatches && !helmetOnHead -> state.copy(message = "Put your helmet on.")
            
            // CASE 5: Camera says helmet, IR sensor = 0
            faceDetected && faceMatches && helmetOnHead && !irSensorActive -> state.copy(message = "Fasten helmet strap (IR sensor not detected).")
            
            // CASE 4 & 6: Registered rider + helmet + face verified + IR sensor = 1
            faceDetected && faceMatches && helmetOnHead && irSensorActive -> state.copy(
                finalAuthenticationState = true,
                message = "Face and helmet verified. Proceeding..."
            )
            
            else -> state.copy(message = "Verifying...")
        }
    }
}
