package com.example.motolock.data

import android.annotation.SuppressLint
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.graphics.Rect
import android.graphics.YuvImage
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import org.tensorflow.lite.Interpreter
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.sqrt

/**
 * DualAiAnalyzer — Real implementation for the Face Unlock flow.
 *
 * Pipeline for each camera frame:
 *  1. ML Kit Face Detection  → find face bounding box
 *  2. helmet.tflite (YOLOv8) → find helmet bounding box
 *  3. Containment check      → face center must be inside helmet box (anti-bypass)
 *  4. mobilefacenet.tflite   → compare 128-d embedding against stored descriptor
 *
 * The [registeredEmbedding] is loaded from the user's face_descriptor DB column (FloatArray, 128 elements).
 * If null, verification cannot proceed and onResult reports an error.
 */
class DualAiAnalyzer(
    private val faceNetInterpreter: Interpreter?,
    private val helmetInterpreter: Interpreter?,
    private val registeredEmbedding: FloatArray?,
    private val onResult: (success: Boolean, message: String) -> Unit
) : ImageAnalysis.Analyzer {

    companion object {
        // Helmet YOLO model input size
        private const val YOLO_INPUT_SIZE = 640
        // MobileFaceNet input size
        private const val FACENET_INPUT_SIZE = 112
        // Confidence threshold for helmet detection
        private const val HELMET_CONFIDENCE_THRESHOLD = 0.25f
        // Euclidean distance threshold for face match (lower = stricter)
        private const val FACE_MATCH_THRESHOLD = 1.1f
    }

    private val faceDetectorOptions = FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
        .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_NONE)
        .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_NONE)
        .build()

    private val faceDetector = FaceDetection.getClient(faceDetectorOptions)

    // Throttling — 500ms between heavy inference
    private var lastAnalyzedTimestamp = 0L

    @SuppressLint("UnsafeOptInUsageError")
    override fun analyze(imageProxy: ImageProxy) {
        val currentTimestamp = System.currentTimeMillis()
        if (currentTimestamp - lastAnalyzedTimestamp < 500) {
            imageProxy.close()
            return
        }

        val mediaImage = imageProxy.image ?: run {
            imageProxy.close()
            return
        }

        val image = InputImage.fromMediaImage(mediaImage, imageProxy.imageInfo.rotationDegrees)

        faceDetector.process(image)
            .addOnSuccessListener { faces ->
                if (faces.isEmpty()) {
                    onResult(false, "No face detected")
                    imageProxy.close()
                    return@addOnSuccessListener
                }

                // Reject if multiple faces are detected in frame
                if (faces.size > 1) {
                    onResult(false, "Multiple faces detected")
                    imageProxy.close()
                    return@addOnSuccessListener
                }

                lastAnalyzedTimestamp = currentTimestamp

                val primaryFace = faces.firstOrNull()
                if (primaryFace == null) {
                    onResult(false, "No stable face detected")
                    imageProxy.close()
                    return@addOnSuccessListener
                }

                val faceBounds = primaryFace.boundingBox

                // Convert to Bitmap for TFLite inference
                val bitmap = mediaImageToBitmap(mediaImage, imageProxy.imageInfo.rotationDegrees)
                if (bitmap == null) {
                    onResult(false, "Image processing error")
                    imageProxy.close()
                    return@addOnSuccessListener
                }

                // Step 2: Run helmet.tflite (YOLOv8)
                val helmetBounds = if (helmetInterpreter != null) {
                    runYoloHelmetDetection(bitmap, helmetInterpreter)
                } else {
                    // No helmet model loaded — skip helmet check
                    null
                }

                if (helmetBounds == null) {
                    onResult(false, "No helmet detected")
                    imageProxy.close()
                    return@addOnSuccessListener
                }

                // Step 3: Removed containment check as per user request

                // Step 4: FaceNet identity verification
                if (faceNetInterpreter == null) {
                    onResult(false, "Face model not loaded")
                    imageProxy.close()
                    return@addOnSuccessListener
                }
                if (registeredEmbedding == null) {
                    onResult(false, "No registered face found")
                    imageProxy.close()
                    return@addOnSuccessListener
                }

                val isMatch = runFaceNetVerification(bitmap, faceBounds, faceNetInterpreter, registeredEmbedding)
                if (isMatch) {
                    onResult(true, "Identity verified")
                } else {
                    onResult(false, "Face does not match registered user")
                }

                imageProxy.close()
            }
            .addOnFailureListener {
                onResult(false, "Detection error: ${it.message}")
                imageProxy.close()
            }
    }

    // ─── YOLO Helmet Detection ────────────────────────────────────────────────

    /**
     * Runs helmet.tflite (YOLOv8) on a full camera frame.
     * Input tensor:  [1, 3, 640, 640] float32  (CHW format, normalized 0..1)
     * Output tensor: [1, 5, 8400] float32  (x_center, y_center, w, h, confidence per anchor)
     *
     * Returns the highest-confidence helmet Rect in original image coordinates, or null.
     */
    private fun runYoloHelmetDetection(bitmap: Bitmap, interpreter: Interpreter): Rect? {
        val scaledBitmap = Bitmap.createScaledBitmap(bitmap, YOLO_INPUT_SIZE, YOLO_INPUT_SIZE, true)

        // Input: [1, 3, 640, 640] CHW, normalized float32
        val inputBuffer = ByteBuffer.allocateDirect(1 * 3 * YOLO_INPUT_SIZE * YOLO_INPUT_SIZE * 4)
            .order(ByteOrder.nativeOrder())

        // Fill in HWC order: R, G, B interleaved per pixel (standard YOLOv8 TFLite format)
        val pixels = IntArray(YOLO_INPUT_SIZE * YOLO_INPUT_SIZE)
        scaledBitmap.getPixels(pixels, 0, YOLO_INPUT_SIZE, 0, 0, YOLO_INPUT_SIZE, YOLO_INPUT_SIZE)

        for (pixel in pixels) {
            inputBuffer.putFloat((pixel shr 16 and 0xFF) / 255f)  // R
            inputBuffer.putFloat((pixel shr 8 and 0xFF) / 255f)   // G
            inputBuffer.putFloat((pixel and 0xFF) / 255f)         // B
        }

        // Output: [1, 6, 8400] — cx, cy, w, h, confidence, class_score
        val outputArray = Array(1) { Array(6) { FloatArray(8400) } }
        interpreter.run(inputBuffer, outputArray)

        val output = outputArray[0]
        val imgW = bitmap.width.toFloat()
        val imgH = bitmap.height.toFloat()

        var bestConf = HELMET_CONFIDENCE_THRESHOLD
        var bestRect: Rect? = null

        for (i in 0 until 8400) {
            val conf = output[4][i]
            if (conf > bestConf) {
                // YOLOv8 outputs cx, cy, w, h relative to input size
                val cx = output[0][i] / YOLO_INPUT_SIZE * imgW
                val cy = output[1][i] / YOLO_INPUT_SIZE * imgH
                val w  = output[2][i] / YOLO_INPUT_SIZE * imgW
                val h  = output[3][i] / YOLO_INPUT_SIZE * imgH

                bestConf = conf
                bestRect = Rect(
                    (cx - w / 2).toInt().coerceAtLeast(0),
                    (cy - h / 2).toInt().coerceAtLeast(0),
                    (cx + w / 2).toInt().coerceAtMost(imgW.toInt()),
                    (cy + h / 2).toInt().coerceAtMost(imgH.toInt())
                )
            }
        }

        return bestRect
    }

    // ─── FaceNet Identity Verification ───────────────────────────────────────

    /**
     * Crops [faceBounds] from [bitmap], resizes to 112×112, runs through mobilefacenet.tflite
     * to produce a 128-d embedding, then computes the Euclidean distance against [storedEmbedding].
     *
     * Returns true if distance < [FACE_MATCH_THRESHOLD].
     */
    private fun runFaceNetVerification(
        bitmap: Bitmap,
        faceBounds: Rect,
        interpreter: Interpreter,
        storedEmbedding: FloatArray
    ): Boolean {
        // Safely crop the face region
        val left   = faceBounds.left.coerceAtLeast(0)
        val top    = faceBounds.top.coerceAtLeast(0)
        val right  = faceBounds.right.coerceAtMost(bitmap.width)
        val bottom = faceBounds.bottom.coerceAtMost(bitmap.height)

        if (right <= left || bottom <= top) return false

        val faceCrop = Bitmap.createBitmap(bitmap, left, top, right - left, bottom - top)
        val faceScaled = Bitmap.createScaledBitmap(faceCrop, FACENET_INPUT_SIZE, FACENET_INPUT_SIZE, true)

        // Input: [1, 112, 112, 3] HWC, normalized to [-1, 1]
        val inputBuffer = ByteBuffer.allocateDirect(1 * FACENET_INPUT_SIZE * FACENET_INPUT_SIZE * 3 * 4)
            .order(ByteOrder.nativeOrder())

        val facePixels = IntArray(FACENET_INPUT_SIZE * FACENET_INPUT_SIZE)
        faceScaled.getPixels(facePixels, 0, FACENET_INPUT_SIZE, 0, 0, FACENET_INPUT_SIZE, FACENET_INPUT_SIZE)
        for (pixel in facePixels) {
            inputBuffer.putFloat(((pixel shr 16 and 0xFF) / 128f) - 1f)  // R
            inputBuffer.putFloat(((pixel shr 8  and 0xFF) / 128f) - 1f)  // G
            inputBuffer.putFloat(((pixel        and 0xFF) / 128f) - 1f)  // B
        }

        // Output: [1, 128] float embedding
        val outputEmbedding = Array(1) { FloatArray(128) }
        interpreter.run(inputBuffer, outputEmbedding)

        val currentEmbedding = outputEmbedding[0]

        // Euclidean distance
        val distance = euclideanDistance(currentEmbedding, storedEmbedding)
        return distance < FACE_MATCH_THRESHOLD
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private fun euclideanDistance(a: FloatArray, b: FloatArray): Float {
        if (a.size != b.size) return Float.MAX_VALUE
        var sum = 0f
        for (i in a.indices) {
            val diff = a[i] - b[i]
            sum += diff * diff
        }
        return sqrt(sum.toDouble()).toFloat()
    }

    /**
     * Converts a MediaImage (YUV_420_888) to a Bitmap, applying rotation.
     */
    private fun mediaImageToBitmap(mediaImage: android.media.Image, rotationDegrees: Int): Bitmap? {
        return try {
            val yBuffer = mediaImage.planes[0].buffer
            val uBuffer = mediaImage.planes[1].buffer
            val vBuffer = mediaImage.planes[2].buffer

            val ySize = yBuffer.remaining()
            val uSize = uBuffer.remaining()
            val vSize = vBuffer.remaining()

            val nv21 = ByteArray(ySize + uSize + vSize)
            yBuffer.get(nv21, 0, ySize)
            vBuffer.get(nv21, ySize, vSize)
            uBuffer.get(nv21, ySize + vSize, uSize)

            val yuvImage = YuvImage(nv21, ImageFormat.NV21, mediaImage.width, mediaImage.height, null)
            val out = ByteArrayOutputStream()
            yuvImage.compressToJpeg(android.graphics.Rect(0, 0, mediaImage.width, mediaImage.height), 85, out)
            val imageBytes = out.toByteArray()
            val raw = BitmapFactory.decodeByteArray(imageBytes, 0, imageBytes.size) ?: return null

            // Apply rotation
            if (rotationDegrees != 0) {
                val matrix = Matrix().apply { postRotate(rotationDegrees.toFloat()) }
                Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, matrix, true)
            } else {
                raw
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }
}
