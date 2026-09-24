package com.example.motolock.data

import android.content.Context
import android.graphics.*
import android.os.SystemClock
import androidx.camera.core.ImageProxy
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.face.Face
import com.google.mlkit.vision.face.FaceDetection
import com.google.mlkit.vision.face.FaceDetectorOptions
import org.tensorflow.lite.DataType
import org.tensorflow.lite.Interpreter
import org.json.JSONObject
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.util.concurrent.TimeUnit
import kotlin.math.*

data class VisionSample(
    val capturedAt: Long,
    val embedding: FloatArray? = null,
    val helmetOnHead: Boolean = false,
    val faceMatches: Boolean = false,
    val live: Boolean = false,
    val message: String = "Position your face in the camera",
    val helmetScore: Float = 0f,
    val helmetLabelsVerified: Boolean = false
)

/** Own on one camera worker; close on that same worker after clearing the analyzer. */
class NativeVision(private val context: Context, private val requireHelmet: Boolean = true) : AutoCloseable {
    private fun model(name: String): Interpreter {
        val bytes = context.assets.open(name).use { it.readBytes() }
        val buffer = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder()).put(bytes)
        buffer.rewind()
        return Interpreter(buffer, Interpreter.Options().apply { setNumThreads(4) })
    }
    private val faceModel = model("mobilefacenet.tflite")
    private var helmetModel: Interpreter? = null
    private val detector = FaceDetection.getClient(FaceDetectorOptions.Builder()
        .setPerformanceMode(if(requireHelmet) FaceDetectorOptions.PERFORMANCE_MODE_ACCURATE else FaceDetectorOptions.PERFORMANCE_MODE_FAST)
        .setLandmarkMode(FaceDetectorOptions.LANDMARK_MODE_ALL)
        .setClassificationMode(FaceDetectorOptions.CLASSIFICATION_MODE_ALL)
        .enableTracking().build())
    private var classId = -1
    private var labelsVerified = false
    private var channelsFirst = true
    private var coordinateScale = 1f
    private val enrollmentChallenge = EnrollmentChallenge()

    init {
        try {
            require(faceModel.getInputTensor(0).shape().contentEquals(intArrayOf(1,112,112,3))) { "Unsupported face model input" }
            require(faceModel.getOutputTensor(0).shape().contentEquals(intArrayOf(1,192))) { "Unsupported face model output" }
            require(faceModel.getInputTensor(0).dataType() == DataType.FLOAT32)
            if (requireHelmet) {
                val h = model("helmet.tflite"); helmetModel = h
                val shape = h.getInputTensor(0).shape()
                channelsFirst = shape.contentEquals(intArrayOf(1,3,640,640))
                require(channelsFirst || shape.contentEquals(intArrayOf(1,640,640,3))) { "Unsupported helmet input" }
                require(h.getOutputTensor(0).shape().contentEquals(intArrayOf(1,6,8400))) { "Unsupported helmet output" }
                require(h.getInputTensor(0).dataType() == DataType.FLOAT32)
                val config = JSONObject(context.assets.open("helmet-model.json").bufferedReader().use { it.readText() })
                labelsVerified = config.optBoolean("labelsVerified", false)
                classId = config.getInt("helmetClassId")
                require(classId in 0..1)
                coordinateScale = if (config.getString("coordinates") == "normalized") 640f else 1f
            }
        } catch (e: Exception) { close(); throw e }
    }

    fun resetLiveness() { enrollmentChallenge.reset() }

    @android.annotation.SuppressLint("UnsafeOptInUsageError")
    fun analyze(proxy: ImageProxy, registered: FloatArray?, challenge: Boolean): VisionSample {
        val captured = SystemClock.elapsedRealtime()
        var bitmap: Bitmap? = null
        try {
            // Read blink/pose directly from camera frames. Avoid bitmap conversion and
            // TFLite work until the enrollment challenge finishes, so short blinks aren't skipped.
            val enrollment = challenge && !requireHelmet
            val image = if(enrollment) {
                InputImage.fromMediaImage(requireNotNull(proxy.image),proxy.imageInfo.rotationDegrees)
            } else {
                bitmap = uprightBitmap(proxy)
                InputImage.fromBitmap(bitmap,0)
            }
            val faces = Tasks.await(detector.process(image), 3, TimeUnit.SECONDS)
            if (faces.size != 1) {
                resetLiveness()
                return VisionSample(captured, message = if (faces.isEmpty()) "No face detected. Keep your face visible." else "Multiple faces detected. Start again.")
            }
            val face = faces[0]
            if(enrollment) {
                val prompt=enrollmentChallenge.observe(face.leftEyeOpenProbability,face.rightEyeOpenProbability,face.headEulerAngleY)
                if(!enrollmentChallenge.complete || abs(face.headEulerAngleY)>12 || abs(face.headEulerAngleZ)>15) {
                    return VisionSample(captured,faceMatches=true,live=enrollmentChallenge.complete,message=prompt)
                }
                bitmap=uprightBitmap(proxy)
            }
            val frame=requireNotNull(bitmap)
            val bounds = face.boundingBox
            val qualityMessage=when {
                bounds.width()<100 || bounds.height()<100 -> "Move closer: face is too small"
                bounds.left<0 || bounds.top<0 || bounds.right>frame.width || bounds.bottom>frame.height -> "Keep your whole face in the frame"
                abs(face.headEulerAngleY)>=30 || abs(face.headEulerAngleZ)>=20 -> "Face the camera more directly"
                else -> null
            }
            if(qualityMessage!=null) return VisionSample(captured,faceMatches=enrollment,
                live=enrollmentChallenge.complete,message=qualityMessage)
            val embedding = embed(frame, bounds)
            val matched = registered == null || VerificationPolicy.distance(embedding, registered) <= VerificationPolicy.MAX_FACE_DISTANCE
            if (!matched) { resetLiveness(); return VisionSample(captured, embedding, message = "Face ID not recognized") }
            val helmet = helmetModel?.let { detectHelmet(frame, bounds, it) } ?: (false to 0f)
            if (challenge && helmet.first) resetLiveness()
            val liveMessage = if (challenge && !helmet.first) "Face forward and hold still" else "Keep your face visible"
            return VisionSample(captured, embedding, helmet.first, matched, enrollmentChallenge.complete, liveMessage, helmet.second, labelsVerified)
        } catch (e: Exception) {
            resetLiveness()
            android.util.Log.e("MotoLockVision", "Frame verification failed", e)
            return VisionSample(captured, message = e.message ?: "Camera processing failed")
        } finally { bitmap?.recycle(); proxy.close() }
    }

    private fun embed(bitmap: Bitmap, bounds: Rect): FloatArray {
        val crop = Bitmap.createBitmap(bitmap, bounds.left, bounds.top, bounds.width(), bounds.height())
        val resized = Bitmap.createScaledBitmap(crop, 112, 112, true)
        try {
            val pixels = IntArray(112*112); resized.getPixels(pixels,0,112,0,0,112,112)
            val input = TensorPixels.rgb(pixels,false,127.5f,128f)
            val output = Array(1) { FloatArray(faceModel.getOutputTensor(0).shape()[1]) }
            faceModel.run(input,output)
            return VerificationPolicy.normalize(output[0])
        } finally { if (resized !== crop) resized.recycle(); if (crop !== bitmap) crop.recycle() }
    }

    private fun detectHelmet(bitmap: Bitmap, face: Rect, model: Interpreter): Pair<Boolean,Float> {
        val scale = min(640f/bitmap.width,640f/bitmap.height)
        val w = (bitmap.width*scale).roundToInt(); val h = (bitmap.height*scale).roundToInt()
        val dx = (640-w)/2; val dy = (640-h)/2
        val letterbox = Bitmap.createBitmap(640,640,Bitmap.Config.ARGB_8888)
        val canvas = Canvas(letterbox); canvas.drawColor(Color.rgb(114,114,114))
        canvas.drawBitmap(bitmap,null,Rect(dx,dy,dx+w,dy+h),Paint(Paint.FILTER_BITMAP_FLAG))
        val pixels = IntArray(640*640); letterbox.getPixels(pixels,0,640,0,0,640,640); letterbox.recycle()
        val input = TensorPixels.rgb(pixels,channelsFirst)
        val output = Array(1) { Array(6) { FloatArray(8400) } }; model.run(input,output)
        val o = output[0]; var best = 0f
        for (i in 0 until 8400) {
            val confidence = o[4+classId][i]; val other = o[4+(1-classId)][i]
            if (!confidence.isFinite() || !other.isFinite() || confidence < 0.6f || confidence < other+0.15f) continue
            val cx=(o[0][i]*coordinateScale-dx)/scale; val cy=(o[1][i]*coordinateScale-dy)/scale
            val bw=o[2][i]*coordinateScale/scale; val bh=o[3][i]*coordinateScale/scale
            if (!listOf(cx,cy,bw,bh).all { it.isFinite() } || bw<=0 || bh<=0) continue
            val box=RectF(cx-bw/2,cy-bh/2,cx+bw/2,cy+bh/2)
            // Helmet must surround this rider's head, not be held elsewhere in the frame.
            val overlap=max(0f,min(box.right,face.right.toFloat())-max(box.left,face.left.toFloat()))/face.width()
            if (overlap < 0.65f || box.top > face.top+face.height()*0.2f || box.bottom < face.top+face.height()*0.25f) continue
            if (abs(cx-face.exactCenterX()) > face.width()*0.6f || bw < face.width()*0.85f || bw > face.width()*3f || bh < face.height()*0.4f) continue
            if (box.left < 0 || box.top < 0 || box.right > bitmap.width || box.bottom > bitmap.height) continue
            best=max(best,confidence)
        }
        return (best >= 0.6f) to best
    }

    /** YUV planes can have padding and interleaved chroma. Never concatenate their buffers. */
    private fun uprightBitmap(proxy: ImageProxy): Bitmap {
        val planes=proxy.planes; require(planes.size==3) { "Expected YUV camera image" }
        val buffers=planes.map { it.buffer.duplicate() }; val starts=buffers.map { it.position() }
        val pixels=IntArray(proxy.width*proxy.height)
        fun sample(p:Int,x:Int,y:Int):Int = buffers[p].get(starts[p]+y*planes[p].rowStride+x*planes[p].pixelStride).toInt() and 255
        for (y in 0 until proxy.height) for (x in 0 until proxy.width) {
            val yy=max(0,sample(0,x,y)-16); val u=sample(1,x/2,y/2)-128; val v=sample(2,x/2,y/2)-128
            val r=((298*yy+409*v+128) shr 8).coerceIn(0,255)
            val g=((298*yy-100*u-208*v+128) shr 8).coerceIn(0,255)
            val b=((298*yy+516*u+128) shr 8).coerceIn(0,255)
            pixels[y*proxy.width+x]=Color.rgb(r,g,b)
        }
        val raw=Bitmap.createBitmap(pixels,proxy.width,proxy.height,Bitmap.Config.ARGB_8888)
        if (proxy.imageInfo.rotationDegrees==0) return raw
        val rotated=Bitmap.createBitmap(raw,0,0,raw.width,raw.height,Matrix().apply { postRotate(proxy.imageInfo.rotationDegrees.toFloat()) },true)
        if (rotated !== raw) raw.recycle()
        return rotated
    }

    override fun close() { detector.close(); helmetModel?.close(); faceModel.close() }
}
