package com.example.motolock.data

import android.graphics.*
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import org.tensorflow.lite.Interpreter
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.TimeUnit
import kotlin.math.*

/** Camera-only verification. A positive result is not hardware authorization. */
class DualAiAnalyzer(
    private val faceNetInterpreter: Interpreter?,
    private val helmetInterpreter: Interpreter?,
    private val registeredEmbedding: FloatArray?,
    private val onResult: (Boolean, String) -> Unit
) : ImageAnalysis.Analyzer, AutoCloseable {
    private val detector = FaceDetection.getClient(FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE).build())
    private val main = Handler(Looper.getMainLooper())
    @Volatile private var stopped = false
    private var lastAnalyzed = 0L
    private var lastDiagnostic = 0L

    private fun report(result: Pair<Boolean, String>) {
        if (android.util.Log.isLoggable("MotoLockDetection", android.util.Log.DEBUG)) {
            android.util.Log.d("MotoLockDetection", "cameraPass=${result.first} message=${result.second}")
        }
        main.post { if (!stopped) onResult(result.first, result.second) }
    }

    @android.annotation.SuppressLint("UnsafeOptInUsageError")
    override fun analyze(proxy: ImageProxy) {
        var bitmap: Bitmap? = null
        try {
            if (stopped || SystemClock.elapsedRealtime() - lastAnalyzed < 250) return
            lastAnalyzed = SystemClock.elapsedRealtime()
            val image = proxy.image ?: return report(false to "Camera frame unavailable")
            val faces = Tasks.await(detector.process(InputImage.fromMediaImage(image, proxy.imageInfo.rotationDegrees)), 2, TimeUnit.SECONDS)
            if (faces.size != 1) return report(CameraDecision.evaluate(faces.size, false, false))
            val faceModel = faceNetInterpreter ?: return report(false to "Face model not loaded")
            val stored = registeredEmbedding ?: return report(false to "No valid saved Face ID. Register your face again.")
            bitmap = FaceData.uprightBitmap(proxy)
            val face = faces.single()
            val faceDistance = FaceData.distance(FaceData.embed(bitmap, face.boundingBox, faceModel), stored)
            val matches = faceDistance < 1.1
            val diagnostics = android.util.Log.isLoggable("MotoLockDetection", android.util.Log.DEBUG)
            if (diagnostics) android.util.Log.d("MotoLockDetection", "faceDistance=$faceDistance matches=$matches yaw=${face.headEulerAngleY}")
            // During explicit diagnostics, inspect both helmet classes even on a face mismatch.
            if (!matches && !diagnostics) return report(CameraDecision.evaluate(1, false, false))
            val helmetModel = helmetInterpreter ?: return report(false to "Helmet model not loaded")
            report(CameraDecision.evaluate(1, matches, helmetOnHead(bitmap, face.boundingBox, helmetModel)))
        } catch (e: Exception) {
            report(false to (e.message ?: "Camera detection failed. Please retry."))
        } finally {
            bitmap?.recycle()
            proxy.close()
        }
    }

    private fun helmetOnHead(bitmap: Bitmap, face: Rect, model: Interpreter): Boolean {
        require(model.getInputTensor(0).shape().contentEquals(intArrayOf(1, 3, 640, 640))) { "Unsupported helmet input" }
        require(model.getOutputTensor(0).shape().contentEquals(intArrayOf(1, 6, 8400))) { "Unsupported helmet output" }
        val scale = min(640f / bitmap.width, 640f / bitmap.height)
        val w = (bitmap.width * scale).roundToInt(); val h = (bitmap.height * scale).roundToInt()
        val dx = (640 - w) / 2; val dy = (640 - h) / 2
        val letterbox = Bitmap.createBitmap(640, 640, Bitmap.Config.ARGB_8888)
        val pixels = IntArray(640 * 640)
        try {
            val canvas = Canvas(letterbox)
            canvas.drawColor(Color.rgb(114, 114, 114))
            canvas.drawBitmap(bitmap, null, Rect(dx, dy, dx + w, dy + h), Paint(Paint.FILTER_BITMAP_FLAG))
            letterbox.getPixels(pixels, 0, 640, 0, 0, 640, 640)
        } finally { letterbox.recycle() }
        val input = ByteBuffer.allocateDirect(pixels.size * 3 * 4).order(ByteOrder.nativeOrder())
        // Actual asset is CHW: complete red plane, then green, then blue.
        for (shift in intArrayOf(16, 8, 0)) for (pixel in pixels) input.putFloat((pixel shr shift and 255) / 255f)
        input.rewind()
        val output = Array(1) { Array(6) { FloatArray(8400) } }
        model.run(input, output)
        val o = output[0]
        // This asset's final graph multiplies decoded pixel boxes by 1/640.
        // Do not infer units from predictions: outlier boxes can exceed normalized 1.0.
        val coordinateScale = 640f
        var bestClass0 = 0f
        var bestClass1 = 0f
        var headClass0 = 0f
        var headClass1 = 0f
        var rejectedByGeometry = 0
        var detected = false
        for (i in 0 until 8400) {
            // Diagnostic class indices only; class 0 produced false positives on a bare head.
            val confidence = o[4][i]; val other = o[5][i]
            if (confidence.isFinite()) bestClass0 = max(bestClass0, confidence)
            if (other.isFinite()) bestClass1 = max(bestClass1, other)
            if (!confidence.isFinite() || !other.isFinite() || max(confidence, other) < 0.05f) continue
            val cx = (o[0][i] * coordinateScale - dx) / scale
            val cy = (o[1][i] * coordinateScale - dy) / scale
            val bw = o[2][i] * coordinateScale / scale; val bh = o[3][i] * coordinateScale / scale
            if (!listOf(cx, cy, bw, bh).all { it.isFinite() } || bw <= 0 || bh <= 0) continue
            val box = RectF(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2)
            val overlap = max(0f, min(box.right, face.right.toFloat()) - max(box.left, face.left.toFloat())) / face.width()
            if (overlap < 0.65f || box.top > face.top + face.height() * 0.2f || box.bottom < face.top + face.height() * 0.25f ||
                abs(cx - face.exactCenterX()) > face.width() * 0.6f || bw < face.width() * 0.85f || bw > face.width() * 3f || bh < face.height() * 0.4f) {
                rejectedByGeometry++
                continue
            }
            headClass0 = max(headClass0, confidence)
            headClass1 = max(headClass1, other)
            if (confidence >= 0.6f && confidence >= other + 0.15f) detected = true
        }
        if (android.util.Log.isLoggable("MotoLockDetection", android.util.Log.DEBUG) && SystemClock.elapsedRealtime() - lastDiagnostic >= 1000) {
            lastDiagnostic = SystemClock.elapsedRealtime()
            android.util.Log.d("MotoLockDetection", "helmet class0=$bestClass0 class1=$bestClass1 headClass0=$headClass0 headClass1=$headClass1 geometryRejected=$rejectedByGeometry candidate0=$detected labelsValidated=false")
        }
        return detected
    }

    fun stop() { stopped = true }
    override fun close() { stop(); detector.close() }
}
