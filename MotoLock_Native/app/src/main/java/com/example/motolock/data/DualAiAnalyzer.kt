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
    private val onResult: (Boolean, String) -> Unit
) : ImageAnalysis.Analyzer, AutoCloseable {
    
    private val detector = FaceDetection.getClient(FaceDetectorOptions.Builder()
        .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST).build())
        
    private val main = Handler(Looper.getMainLooper())
    @Volatile private var stopped = false
    @Volatile private var lowLight = false
    
    private var lastAnalyzed = 0L

    // Temporal tracking
    private var lastRecognizedFaceRect: Rect? = null
    private var lastFaceMatchTime = 0L
    private var lastFaceEmbedTime = 0L

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
        
        history.add(TimedState(now, state))
        history.removeAll { now - it.time > REQUIRED_STABLE_MS + 500L }
        
        val stableDuration = if (history.isNotEmpty()) now - history.first().time else 0L
        val consistentlySuccessful = stableDuration >= REQUIRED_STABLE_MS && history.all { it.state.finalAuthenticationState }
        
        if (consistentlySuccessful) {
            stopped = true
        }
        
        val displayMessage = if (consistentlySuccessful) {
            state.message
        } else {
            val failures = history.map { it.state }.filter { !it.finalAuthenticationState }
            if (failures.isNotEmpty()) {
                failures.groupingBy { it.message }.eachCount().maxByOrNull { it.value }?.key ?: "Verifying..."
            } else {
                "Verifying..."
            }
        }
        
        main.post { if (!stopped || consistentlySuccessful) onResult(consistentlySuccessful, displayMessage) }
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
            if (currentNonce == null || now - lastChallengeTime > 5000) {
                val nonce = ByteArray(32)
                secureRandom.nextBytes(nonce)
                currentNonce = nonce
                lastChallengeTime = now
                lastValidSequenceForNonce = -1L
                lastSequenceReceiveTime = now
                telemetryManager.initiateChallenge(nonce)
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
            
            // Filter out tiny background faces to prevent "Multiple faces" flickering
            val validFaces = faces.filter { it.boundingBox.width() >= proxy.width * 0.15f && it.boundingBox.height() >= proxy.height * 0.15f }
            
            if (validFaces.size != 1) {
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

                    if (!spatiallyAssociated) {
                        lastRecognizedFaceRect = null 
                    }
                    
                    return report(CameraDecision.evaluate(0, false, detectedHelmetBox != null, telemetry, pairedHelmetDeviceId, pairedHelmetVisualId, currentNonce, helmetPublicKey, extractedLogoId, isSequenceValid, spatiallyAssociated))
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
            
            var matches = false
            val prevRect = lastRecognizedFaceRect
            val timeSinceLastEmbed = now - lastFaceEmbedTime
            
            if (prevRect != null && now - lastFaceMatchTime < 2000 && timeSinceLastEmbed < 1000) {
                val overlap = max(0, min(face.boundingBox.right, prevRect.right) - max(face.boundingBox.left, prevRect.left))
                if (overlap > face.boundingBox.width() * 0.7f) {
                    matches = true 
                }
            }
            
            if (!matches) {
                val faceModel = faceNetInterpreter ?: return reportFallback(false, "Face model not loaded")
                val stored = registeredEmbedding ?: return reportFallback(false, "No valid saved Face ID. Register your face again.")
                matches = FaceData.matches(FaceData.embed(bitmap, face.boundingBox, faceModel), stored)
                
                if (matches) {
                    lastRecognizedFaceRect = face.boundingBox
                    lastFaceMatchTime = now
                    lastFaceEmbedTime = now
                } else {
                    lastRecognizedFaceRect = null
                }
            } else {
                lastFaceMatchTime = now
                lastRecognizedFaceRect = face.boundingBox
            }
            
            val helmetModel = helmetInterpreter ?: return reportFallback(false, "Helmet model not loaded")
            val detectedHelmetBox = helmetOnHead(bitmap, face.boundingBox, helmetModel)
            
            val extractedLogoId = if (detectedHelmetBox != null) {
                logoIdentityDetector.extractIdentity(bitmap, detectedHelmetBox)
            } else {
                null
            }
            
            report(CameraDecision.evaluate(1, matches, detectedHelmetBox != null, telemetry, pairedHelmetDeviceId, pairedHelmetVisualId, currentNonce, helmetPublicKey, extractedLogoId, isSequenceValid))
            
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
            // Increased baseline confidence to 0.70 to avoid bare heads
            if (!confidence.isFinite() || !other.isFinite() || confidence < 0.70f || confidence < other + 0.15f) continue
            val cx = (o[0][i] * coordinateScale - dx) / scale
            val cy = (o[1][i] * coordinateScale - dy) / scale
            val bw = o[2][i] * coordinateScale / scale; val bh = o[3][i] * coordinateScale / scale
            if (!listOf(cx, cy, bw, bh).all { it.isFinite() } || bw <= 0 || bh <= 0) continue
            val boxF = RectF(cx - bw / 2, cy - bh / 2, cx + bw / 2, cy + bh / 2)

            if (face != null) {
                // Relax overlap and center checks if this is a transition (stale face box)
                val requiredOverlap = if (isTransition) 0.15f else 0.3f
                val overlap = max(0f, min(boxF.right, face.right.toFloat()) - max(boxF.left, face.left.toFloat())) / face.width()
                
                if (overlap < requiredOverlap || boxF.bottom < face.top ||
                    abs(cx - face.exactCenterX()) > face.width() * 2.0f || bw < face.width() * 0.5f || bw > face.width() * 5f || bh < face.height() * 0.2f) {
                    continue
                }

                // ── Forehead Coverage Check ───────────────────────────────────────
                // If it's a transition, the head might have moved down, so allow the helmet box 
                // to start lower. Otherwise, enforce that it extends above the face.
                val foreheadCoverageThreshold = if (isTransition) {
                    face.top + face.height() * 0.15f
                } else {
                    face.top - face.height() * 0.10f
                }
                
                if (boxF.top > foreheadCoverageThreshold) continue

                // ── Helmet Height Ratio Check ─────────────────────────────────────
                // Relaxed for transition since the face box might be stale/smaller relative to helmet
                val minHeightRatio = if (isTransition) 0.60f else 0.80f
                if (bh < face.height() * minHeightRatio) continue

            } else {
                if (bw < bitmap.width * 0.25f || bh < bitmap.height * 0.25f || cy > bitmap.height * 0.7f) {
                    continue
                }
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
