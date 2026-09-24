# coding=utf-8
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/ml'
os.makedirs(output_dir, exist_ok=True)

detector_interface_kt = """package com.example.motolock.ml

import kotlinx.coroutines.flow.StateFlow

enum class DetectionResult {
    HELMET_DETECTED,
    NO_HELMET,
    UNCERTAIN,
    UNAVAILABLE
}

interface HelmetDetector {
    val detectionState: StateFlow<DetectionResult>
    fun startDetection()
    fun stopDetection()
}
"""

combined_detector_kt = """package com.example.motolock.ml

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class CombinedHelmetDetector(
    private val cameraDetector: HelmetDetector,
    private val irDetector: HelmetDetector
) {
    private val _combinedState = MutableStateFlow(DetectionResult.UNAVAILABLE)
    val combinedState: StateFlow<DetectionResult> = _combinedState.asStateFlow()

    private val scope = CoroutineScope(Dispatchers.Default)

    init {
        scope.launch {
            cameraDetector.detectionState.collect { cameraResult ->
                val irResult = irDetector.detectionState.value
                
                // Final logic: If IR is unavailable (Phase 1), trust Camera entirely.
                // If IR is available (Phase 2), require both.
                _combinedState.value = if (irResult == DetectionResult.UNAVAILABLE) {
                    cameraResult
                } else {
                    if (cameraResult == DetectionResult.HELMET_DETECTED && irResult == DetectionResult.HELMET_DETECTED) {
                        DetectionResult.HELMET_DETECTED
                    } else if (cameraResult == DetectionResult.NO_HELMET || irResult == DetectionResult.NO_HELMET) {
                        DetectionResult.NO_HELMET
                    } else {
                        DetectionResult.UNCERTAIN
                    }
                }
            }
        }
    }

    fun start() {
        cameraDetector.startDetection()
        irDetector.startDetection()
    }

    fun stop() {
        cameraDetector.stopDetection()
        irDetector.stopDetection()
    }
}
"""

with open(os.path.join(output_dir, "HelmetDetector.kt"), "w", encoding="utf-8") as f:
    f.write(detector_interface_kt)
with open(os.path.join(output_dir, "CombinedHelmetDetector.kt"), "w", encoding="utf-8") as f:
    f.write(combined_detector_kt)
print("ML Interfaces created")
