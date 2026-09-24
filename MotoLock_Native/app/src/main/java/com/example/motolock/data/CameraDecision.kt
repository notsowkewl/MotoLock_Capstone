package com.example.motolock.data

data class VerificationState(
    val faceDetected: Boolean,
    val faceRecognized: Boolean,
    val helmetDetected: Boolean,
    val helmetSensorActive: Boolean,
    val visorBlockingFace: Boolean,
    val isSignatureValid: Boolean,
    val isLogoIdentityMatched: Boolean,
    val isSequenceValid: Boolean,
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
        visuallyExtractedLogoId: String?,
        isSequenceValid: Boolean,
        spatiallyAssociatedHelmetWithoutFace: Boolean = false
    ): VerificationState {
        val faceDetected = faceCount == 1
        val multipleFaces = faceCount > 1
        
        val visorBlockingFace = !faceDetected && spatiallyAssociatedHelmetWithoutFace
        
        // Timing constraints
        val isFresh = (System.currentTimeMillis() - telemetry.receivedAt) < 3000
        val isCorrectDevice = pairedHelmetDeviceId != null && telemetry.deviceId == pairedHelmetDeviceId
        
        // Visual Logo Check (Ensure the extracted visual ID explicitly matches the registered visual ID)
        val isLogoIdentityMatched = pairedHelmetVisualId != null && visuallyExtractedLogoId == pairedHelmetVisualId
        
        // Crypto binding
        val isSignatureValid = expectedNonce != null && helmetPublicKey != null && 
                               HelmetCrypto.verifySignature(telemetry, expectedNonce, helmetPublicKey)
        
        val irSensorActive = telemetry.isConnected && telemetry.sensorActive && isFresh && isCorrectDevice && isSignatureValid && isSequenceValid
        
        // ALL conditions must be met for final auth candidate
        val isCandidate = faceDetected && faceMatches && helmetOnHead && irSensorActive && isLogoIdentityMatched

        val state = VerificationState(
            faceDetected = faceDetected,
            faceRecognized = faceDetected && faceMatches,
            helmetDetected = helmetOnHead || spatiallyAssociatedHelmetWithoutFace,
            helmetSensorActive = irSensorActive,
            visorBlockingFace = visorBlockingFace,
            isSignatureValid = isSignatureValid,
            isLogoIdentityMatched = isLogoIdentityMatched,
            isSequenceValid = isSequenceValid,
            finalAuthenticationState = isCandidate,
            message = ""
        )

        return when {
            multipleFaces -> state.copy(message = "Multiple faces detected. Only one rider allowed.")
            faceDetected && !faceMatches -> state.copy(message = "Face ID not recognized.")
            visorBlockingFace -> state.copy(message = "Lift your visor.")
            !faceDetected && !spatiallyAssociatedHelmetWithoutFace -> state.copy(message = "No face detected. Keep your face visible.")
            faceDetected && faceMatches && !helmetOnHead -> state.copy(message = "Put your helmet on.")
            
            faceDetected && faceMatches && helmetOnHead && (!telemetry.isConnected || !isFresh || expectedNonce == null) -> state.copy(message = "Connecting to helmet sensor...")
            faceDetected && faceMatches && helmetOnHead && telemetry.isConnected && isFresh && !isCorrectDevice -> state.copy(message = "Unknown helmet device detected via BLE.")
            faceDetected && faceMatches && helmetOnHead && telemetry.isConnected && isFresh && isCorrectDevice && !isLogoIdentityMatched -> state.copy(message = "MotoLock logo identification failed.")
            faceDetected && faceMatches && helmetOnHead && telemetry.isConnected && isFresh && isCorrectDevice && isLogoIdentityMatched && !isSequenceValid -> state.copy(message = "Stale or replayed telemetry sequence.")
            faceDetected && faceMatches && helmetOnHead && telemetry.isConnected && isFresh && isCorrectDevice && isLogoIdentityMatched && isSequenceValid && !isSignatureValid -> state.copy(message = "Helmet signature validation failed.")
            faceDetected && faceMatches && helmetOnHead && telemetry.isConnected && isFresh && isCorrectDevice && isLogoIdentityMatched && isSequenceValid && isSignatureValid && !irSensorActive -> state.copy(message = "Alcohol detected or sensor failed.")
            
            isCandidate -> state.copy(message = "Face and helmet verified. Proceeding...")
            else -> state.copy(message = "Verifying...")
        }
    }
}
