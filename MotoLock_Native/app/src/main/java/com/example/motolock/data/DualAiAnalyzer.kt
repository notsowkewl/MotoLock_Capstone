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
import java.security.SecureRandom
import java.util.concurrent.TimeUnit
import kotlin.math.*

class DualAiAnalyzer(
    private val faceNetInterpreter: Interpreter?,
    private val helmetInterpreter: Interpreter?,
    private val registeredEmbedding: FloatArray?,
    private val telemetryManager: HelmetTelemetryManager,
    private val pairedHelmetDeviceId: String?,
    private val pairedHelmetVisualId: String?,
    private val helmetPublicKey: ByteArray?,
    private val logoIdentityDetector: LogoIdentityDetector,
    private val onLowLightChanged: (Boolean) -> Unit = {},
    private val onRiderPresenceChanged: (Boolean) -> Unit = {},
    private val onResult: (Boolean, String) -> Unit
) : ImageAnalysis.Analyzer, AutoCloseable {
    
    private val detector = FaceDetection.getClient(FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST).build())
        
    private val main = Handler(Looper.getMainLooper())
    @Volatile private var stopped = false
    @Volatile private var lowLight = false
    @Volatile private var finalAuthenticationReported = false
    
    private var lastAnalyzed = 0L

    // Temporal tracking
    private var lastRecognizedFaceRect: Rect? = null
    private var lastFaceMatchTime = 0L
    private var lastFaceEmbedTime = 0L
    private var lastHelmetDetectTime = 0L

    // Crypto state
    private val secureRandom = SecureRandom()
    private var currentNonce: ByteArray? = null
    private var lastChallengeTime = 0L
    private var lastValidSequenceForNonce: Long = -1L
    private var lastSequenceReceiveTime: Long = 0L

    data class TimedState(val time: Long, val state: VerificationState)
    private var history = mutableListOf<TimedState>()
    private val REQUIRED_STABLE_MS = 1500L

    private fun reportFallback(success: Boolean, message: String) {
        val fbState = VerificationState(faceDetected = false, faceRecognized = false, helmetDetected = false, helmetSensorActive = false, visorBlockingFace = false, finalAuthenticationState = success, message = message)
        report(fbState)
    }

    private fun report(state: VerificationState) {
        val now = SystemClock.elapsedRealtime()

        // If the state machine says fully authenticated -> fire immediately, no debounce needed
        // (CameraDecision is already a forward-only machine)
        if (state.finalAuthenticationState) {
            if (!finalAuthenticationReported) {
                finalAuthenticationReported = true
                main.post { onResult(true, state.message) }
            }
            return
        }

        val wasAuthenticated = finalAuthenticationReported
        finalAuthenticationReported = false

        history.add(TimedState(now, state))
        history.removeAll { now - it.time > REQUIRED_STABLE_MS + 500L }

        // Always show the immediate message to prevent UI lag/flickering between states
        val displayMessage = state.message.ifBlank { "Verifying..." }

        main.post { onResult(false, if (wasAuthenticated)
            "Rider verification expired. Put on the paired helmet and verify again."
        else displayMessage) }
    }

    @android.annotation.SuppressLint("UnsafeOptInUsageError")
    override fun analyze(proxy: ImageProxy) {
        val now = SystemClock.elapsedRealtime()
        if (stopped || now - lastAnalyzed < 250) {
            proxy.close()
            return
        }
        lastAnalyzed = now

        updateLowLight(proxy)

        var bitmap: Bitmap? = null
        try {
            val image = proxy.image ?: return reportFallback(false, "Camera frame unavailable")
            val faces = Tasks.await(detector.process(InputImage.fromMediaImage(image, proxy.imageInfo.rotationDegrees)), 1, TimeUnit.SECONDS)
            val telemetry = telemetryManager.getTelemetry()
            
            // Manage Challenge lifecycle
            if (currentNonce == null) {
                val nonce = ByteArray(32)
                secureRandom.nextBytes(nonce)
                currentNonce = nonce
                lastChallengeTime = now
                lastValidSequenceForNonce = -1L
                lastSequenceReceiveTime = now
                telemetryManager.initiateChallenge(nonce)
            } else if (now - lastChallengeTime > 5000) {
                lastChallengeTime = now
                telemetryManager.initiateChallenge(currentNonce!!)
            }
            
            val isSequenceValid = if (telemetry.nonce != null && currentNonce != null && telemetry.nonce.contentEquals(currentNonce)) {
                if (telemetry.sequence > lastValidSequenceForNonce) {
                    lastValidSequenceForNonce = telemetry.sequence
                    lastSequenceReceiveTime = now
                    true
                } else if (telemetry.sequence == lastValidSequenceForNonce) {
                    (now - lastSequenceReceiveTime) < 1000
                } else {
                    false
                }
            } else {
                false
            }
            
            // Filter out tiny background faces to prevent "Multiple faces" flickering.
            // If we still detect multiple faces (e.g. phantom reflection on the visor or someone behind), 
            // we sort by area and only pick the largest primary face.
            val validFaces = faces
                .filter { it.boundingBox.width() >= proxy.width * 0.15f && it.boundingBox.height() >= proxy.height * 0.15f }
                .sortedByDescending { it.boundingBox.width() * it.boundingBox.height() }
                .take(1)
            
            if (validFaces.size != 1) {
                main.post { if (!stopped) onRiderPresenceChanged(false) }
                if (validFaces.size == 0) {
                    val helmetModel = helmetInterpreter ?: return reportFallback(false, "Helmet model not loaded")
                    bitmap = FaceData.uprightBitmap(proxy)
                    
                    val prevRect = lastRecognizedFaceRect
                    val recentlyRecognized = prevRect != null && (now - lastFaceMatchTime < 3000)
                    
                    val detectedHelmetBox = helmetOnHead(bitmap, if (recentlyRecognized) prevRect else null, helmetModel, isTransition = true)
                    val spatiallyAssociated = recentlyRecognized && (detectedHelmetBox != null)
                    
                    val extractedLogoId = if (detectedHelmetBox != null) {
                        logoIdentityDetector.extractIdentity(bitmap, detectedHelmetBox)
                    } else {
                        null
                    }

                    if (detectedHelmetBox != null) lastHelmetDetectTime = now
                    val helmetVisuallyConfirmed = (now - lastHelmetDetectTime < 5000)

                    if (!spatiallyAssociated) {
                        lastRecognizedFaceRect = null 
                    }
                    
                    return report(CameraDecision.evaluate(0, false, helmetVisuallyConfirmed, telemetry, pairedHelmetDeviceId, pairedHelmetVisualId, currentNonce, helmetPublicKey, extractedLogoId, isSequenceValid, spatiallyAssociated))
                }
                lastRecognizedFaceRect = null
                return report(CameraDecision.evaluate(validFaces.size, false, false, telemetry, pairedHelmetDeviceId, pairedHelmetVisualId, currentNonce, helmetPublicKey, null, isSequenceValid))
            }
            
            val face = validFaces.single()
            
            // We already filtered by size, but keep this for safety
            if (face.boundingBox.width() < proxy.width * 0.15f || face.boundingBox.height() < proxy.height * 0.15f) {
                return reportFallback(false, "Move closer to the camera.")
            }
            
            bitmap = FaceData.uprightBitmap(proxy)
            
            val faceModel = faceNetInterpreter ?: return reportFallback(false, "Face model not loaded")
            val stored = registeredEmbedding ?: return reportFallback(false, "No valid saved Face ID. Register your face again.")
            val matches = FaceData.matches(FaceData.embed(bitmap, face.boundingBox, faceModel), stored)

            if (matches) {
                lastRecognizedFaceRect = face.boundingBox
                lastFaceMatchTime = now
                lastFaceEmbedTime = now
            } else {
                lastRecognizedFaceRect = null
            }

            main.post { if (!stopped) onRiderPresenceChanged(matches) }
            
            val helmetModel = helmetInterpreter ?: return reportFallback(false, "Helmet model not loaded")
            val detectedHelmetBox = helmetOnHead(bitmap, face.boundingBox, helmetModel)
            
            val extractedLogoId = if (detectedHelmetBox != null) {
                logoIdentityDetector.extractIdentity(bitmap, detectedHelmetBox)
            } else {
                logoIdentityDetector.extractIdentity(bitmap, android.graphics.Rect(0, 0, bitmap.width, bitmap.height))
            }
            
            if (detectedHelmetBox != null) lastHelmetDetectTime = now
            // Allow a 5000ms grace period (5 seconds). AI bounding boxes jitter naturally, 
            // and YOLO models have blindspots when looking up/down/sideways.
            // If the model loses the helmet, we trust the last known state for 5 seconds.
            val helmetVisuallyConfirmed = (now - lastHelmetDetectTime < 5000)
            
            report(CameraDecision.evaluate(1, matches, helmetVisuallyConfirmed, telemetry, pairedHelmetDeviceId, pairedHelmetVisualId, currentNonce, helmetPublicKey, extractedLogoId, isSequenceValid))
            
        } catch (e: Exception) {
            reportFallback(false, e.message ?: "Camera detection failed. Please retry.")
        } finally {
            bitmap?.recycle()
            proxy.close()
        }
    }

    private fun updateLowLight(proxy: ImageProxy) {
        val plane = proxy.planes.firstOrNull() ?: return
        val buffer = plane.buffer.duplicate()
        val length = buffer.remaining()
        if (length == 0) return
        val step = max(1, length / 1200)
        var total = 0L
        var count = 0
        var index = 0
        while (index < length) {
            total += (buffer.get(buffer.position() + index).toInt() and 0xff)
            count++
            index += step
        }
        val averageLuma = total / count
        val nextLowLight = if (lowLight) averageLuma < 95 else averageLuma < 70
        if (nextLowLight != lowLight) {
            lowLight = nextLowLight
            main.post { if (!stopped) onLowLightChanged(nextLowLight) }
        }
    }

    private fun helmetOnHead(bitmap: Bitmap, face: Rect?, model: Interpreter, isTransition: Boolean = false): Rect? {
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
        for (shift in intArrayOf(16, 8, 0)) for (pixel in pixels) input.putFloat((pixel shr shift and 255) / 255f)
        input.rewind()
        val output = Array(1) { Array(6) { FloatArray(8400) } }
        model.run(input, output)
        val o = output[0]
        val coordinateScale = 640f
        
        var bestBox: Rect? = null
        var maxConfidence = 0f
        
        for (i in 0 until 8400) {
            val confidence = o[4][i]; val other = o[5][i]
            
            // To prevent hair/caps from triggering at weird angles, we raise the strict confidence to 0.93.
            // But for closed helmets with no face, the YOLO model is very weak at angles, so we drop it all the way to 0.40.
            val requiredConfidence = if (face != null) 0.93f else 0.40f
            
            // MARGIN FIX: 'other' is the YOLO model's "No Helmet / Head" class. 
            // If the AI is confused between Hair and Helmet, both classes will have high confidence.
            // We force a MASSIVE margin of 0.65. The AI must be 65% MORE confident that it is a helmet than a bare head.
            val margin = if (face != null) 0.65f else 0.10f
            if (!confidence.isFinite() || !other.isFinite() || confidence < requiredConfidence || confidence < other + margin) continue
            val cx = (o[0][i] * coordinateScale - dx) / scale
            val cy = (o[1][i] * coordinateScale - dy) / scale
            val bw = o[2][i] * coordinateScale / scale; val bh = o[3][i] * coordinateScale / scale
            if (!listOf(cx, cy, bw, bh).all { it.isFinite() } || bw <= 0 || bh <= 0) continue
            val boxF = RectF(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2)

            if (face != null) {
                // SPATIAL TRACKING: Force the AI to follow the face anywhere on the screen!
                // 1. The helmet must overlap with the face horizontally
                val overlap = max(0f, min(boxF.right, face.right.toFloat()) - max(boxF.left, face.left.toFloat())) / face.width()
                // 2. The helmet must be physically near the face center
                val dxFace = abs(cx - face.exactCenterX())
                
                // If it doesn't spatially overlap or track the face, it's a background object (ignore)
                if (overlap < 0.2f || dxFace > face.width() * 2.0f) continue
                
                // 3. The helmet must still be physically larger than the face (to reject baseball caps)
                // We use 1.15x as the golden ratio to allow looking sideways/upwards.
                if (bw < face.width() * 1.15f || bh < face.height() * 1.15f) continue
                
                // 4. Hair ends at the chin, but a real helmet shell extends BELOW the chin.
                // If the bounding box ends at or above the face's chin, it's just hair!
                if (boxF.bottom < face.bottom) continue
                
            } else {
                if (bw < bitmap.width * 0.12f || bh < bitmap.height * 0.12f || cy > bitmap.height * 0.85f) continue
            }
            if (confidence > maxConfidence) {
                maxConfidence = confidence
                bestBox = Rect(boxF.left.roundToInt(), boxF.top.roundToInt(), boxF.right.roundToInt(), boxF.bottom.roundToInt())
            }
        }
        return bestBox
    }

    fun stop() { stopped = true }
    override fun close() { stop(); detector.close(); telemetryManager.close() }
}


