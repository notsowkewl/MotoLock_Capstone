# coding=utf-8
import os

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/ml'
os.makedirs(output_dir, exist_ok=True)

camera_detector_kt = """package com.example.motolock.ml

import android.content.Context
import android.graphics.Bitmap
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.channels.FileChannel

class CameraHelmetDetectorImpl(private val context: Context) : HelmetDetector {
    
    private val _detectionState = MutableStateFlow(DetectionResult.UNAVAILABLE)
    override val detectionState: StateFlow<DetectionResult> = _detectionState.asStateFlow()

    private var interpreter: Interpreter? = null
    private val inputSize = 640 // Standard YOLOv8 size

    init {
        try {
            val assetFileDescriptor = context.assets.openFd("helmet.tflite")
            val fileInputStream = FileInputStream(assetFileDescriptor.fileDescriptor)
            val fileChannel = fileInputStream.channel
            val startOffset = assetFileDescriptor.startOffset
            val declaredLength = assetFileDescriptor.declaredLength
            val mappedByteBuffer = fileChannel.map(FileChannel.MapMode.READ_ONLY, startOffset, declaredLength)
            
            val options = Interpreter.Options().apply {
                setNumThreads(4)
            }
            interpreter = Interpreter(mappedByteBuffer, options)
        } catch (e: Exception) {
            e.printStackTrace()
            _detectionState.value = DetectionResult.UNAVAILABLE
        }
    }

    override fun startDetection() {
        if (interpreter != null) {
            _detectionState.value = DetectionResult.UNCERTAIN
        } else {
            _detectionState.value = DetectionResult.UNAVAILABLE
        }
    }

    override fun stopDetection() {
        _detectionState.value = DetectionResult.UNAVAILABLE
    }

    // Call this repeatedly from CameraX ImageAnalysis analyzer
    fun processFrame(bitmap: Bitmap) {
        if (interpreter == null) return

        try {
            // Resize and normalize bitmap to ByteBuffer
            val scaledBitmap = Bitmap.createScaledBitmap(bitmap, inputSize, inputSize, true)
            val byteBuffer = ByteBuffer.allocateDirect(1 * inputSize * inputSize * 3 * 4)
            byteBuffer.order(ByteOrder.nativeOrder())

            val intValues = IntArray(inputSize * inputSize)
            scaledBitmap.getPixels(intValues, 0, scaledBitmap.width, 0, 0, scaledBitmap.width, scaledBitmap.height)

            var pixel = 0
            for (i in 0 until inputSize) {
                for (j in 0 until inputSize) {
                    val `val` = intValues[pixel++]
                    // Normalize to 0-1.0 (standard for YOLO)
                    byteBuffer.putFloat(((`val` shr 16) and 0xFF) / 255.0f)
                    byteBuffer.putFloat(((`val` shr 8) and 0xFF) / 255.0f)
                    byteBuffer.putFloat((`val` and 0xFF) / 255.0f)
                }
            }

            // Standard YOLOv8 output: [1, 5, 8400] (4 bbox + 1 class confidence)
            val outputArray = Array(1) { Array(5) { FloatArray(8400) } }
            
            interpreter?.run(byteBuffer, outputArray)

            // Basic parsing logic: Look for any detection with confidence > 0.6
            var helmetDetected = false
            for (i in 0 until 8400) {
                val confidence = outputArray[0][4][i] // Assuming class 0 is Helmet
                if (confidence > 0.60f) {
                    helmetDetected = true
                    break
                }
            }

            if (helmetDetected) {
                _detectionState.value = DetectionResult.HELMET_DETECTED
            } else {
                _detectionState.value = DetectionResult.NO_HELMET
            }

        } catch (e: Exception) {
            e.printStackTrace()
            _detectionState.value = DetectionResult.UNCERTAIN
        }
    }

    fun close() {
        interpreter?.close()
        interpreter = null
    }
}
"""

with open(os.path.join(output_dir, "CameraHelmetDetectorImpl.kt"), "w", encoding="utf-8") as f:
    f.write(camera_detector_kt)
print("CameraDetector implemented")
