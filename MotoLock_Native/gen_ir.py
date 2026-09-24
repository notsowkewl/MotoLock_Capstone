# coding=utf-8
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/ml'

ir_detector_kt = """package com.example.motolock.ml

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

// Stub for Phase 2 hardware integration
class IrHelmetDetectorImpl : HelmetDetector {
    
    private val _detectionState = MutableStateFlow(DetectionResult.UNAVAILABLE)
    override val detectionState: StateFlow<DetectionResult> = _detectionState.asStateFlow()

    override fun startDetection() {
        // Not implemented until physical IR sensor is available
        _detectionState.value = DetectionResult.UNAVAILABLE
    }

    override fun stopDetection() {
        _detectionState.value = DetectionResult.UNAVAILABLE
    }
}
"""

with open(os.path.join(output_dir, "IrHelmetDetectorImpl.kt"), "w", encoding="utf-8") as f:
    f.write(ir_detector_kt)
print("IR stub created")
