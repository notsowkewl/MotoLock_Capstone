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

    private fun report(result: Pair<Boolean, String>) {
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
            val matches = FaceData.matches(FaceData.embed(bitmap, face.boundingBox, faceModel), stored)
            if (!matches) return report(CameraDecision.evaluate(1, false, false))
            val helmetModel = helmetInterpreter ?: return report(false to "Helmet model not loaded")
            report(CameraDecision.evaluate(1, true, helmetOnHead(bitmap, face.boundingBox, helmetModel)))
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
        val coordinateScale = if ((o[0].maxOrNull() ?: 0f) <= 2f && (o[1].maxOrNull() ?: 0f) <= 2f) 640f else 1f
        for (i in 0 until 8400) {
            // Original app's provisional class-0 mapping. Model labels remain unverified.
            val confidence = o[4][i]; val other = o[5][i]
            if (!confidence.isFinite() || !other.isFinite() || confidence < 0.6f || confidence < other + 0.15f) continue
            val cx = (o[0][i] * coordinateScale - dx) / scale
            val cy = (o[1][i] * coordinateScale - dy) / scale
            val bw = o[2][i] * coordinateScale / scale; val bh = o[3][i] * coordinateScale / scale
            if (!listOf(cx, cy, bw, bh).all { it.isFinite() } || bw <= 0 || bh <= 0) continue
            val box = RectF(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2)
            val overlap = max(0f, min(box.right, face.right.toFloat()) - max(box.left, face.left.toFloat())) / face.width()
            if (overlap < 0.65f || box.top > face.top + face.height() * 0.2f || box.bottom < face.top + face.height() * 0.25f) continue
            if (abs(cx - face.exactCenterX()) > face.width() * 0.6f || bw < face.width() * 0.85f || bw > face.width() * 3f || bh < face.height() * 0.4f) continue
            return true
        }
        return false
    }

    fun stop() { stopped = true }
    override fun close() { stop(); detector.close() }
}
