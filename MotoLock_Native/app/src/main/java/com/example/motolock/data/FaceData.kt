package com.example.motolock.data

import android.graphics.*
import androidx.camera.core.ImageProxy
import kotlinx.serialization.json.*
import org.tensorflow.lite.Interpreter
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.sqrt

/** Shared preprocessing for enrollment and recognition; compatible with the 192-value model. */
object FaceData {
    fun normalize(values: FloatArray): FloatArray {
        require(values.size == 192 && values.all { it.isFinite() }) { "Saved Face ID is invalid. Register again." }
        require(values.maxOrNull()!! - values.minOrNull()!! > 0.00001f) { "Saved Face ID is a placeholder. Register again." }
        val norm = sqrt(values.sumOf { it.toDouble() * it }).toFloat()
        require(norm.isFinite() && norm > 0.00001f)
        return FloatArray(values.size) { values[it] / norm }
    }

    fun decode(value: JsonElement?): FloatArray {
        require(value != null && value !is JsonNull) { "No registered face found. Register your face first." }
        val parsed = if (value is JsonPrimitive && value.isString) Json.parseToJsonElement(value.content) else value
        return normalize((parsed as? JsonArray ?: error("Invalid Face ID. Register again.")).map { it.jsonPrimitive.float }.toFloatArray())
    }

    fun matches(current: FloatArray, stored: FloatArray): Boolean {
        val a = normalize(current); val b = normalize(stored)
        return sqrt(a.indices.sumOf { val d = (a[it] - b[it]).toDouble(); d * d }) < 0.95
    }

    fun embed(bitmap: Bitmap, bounds: Rect, model: Interpreter): FloatArray {
        require(bounds.left >= 0 && bounds.top >= 0 && bounds.right <= bitmap.width && bounds.bottom <= bitmap.height && !bounds.isEmpty) {
            "Keep your whole face visible"
        }
        val crop = Bitmap.createBitmap(bitmap, bounds.left, bounds.top, bounds.width(), bounds.height())
        val scaled = Bitmap.createScaledBitmap(crop, 112, 112, true)
        try {
            val pixels = IntArray(112 * 112)
            scaled.getPixels(pixels, 0, 112, 0, 0, 112, 112)
            val input = ByteBuffer.allocateDirect(pixels.size * 3 * 4).order(ByteOrder.nativeOrder())
            for (p in pixels) for (shift in intArrayOf(16, 8, 0)) input.putFloat(((p shr shift and 255) - 127.5f) / 128f)
            input.rewind()
            require(model.getOutputTensor(0).shape().contentEquals(intArrayOf(1, 192))) { "Unsupported face model" }
            val output = Array(1) { FloatArray(192) }
            model.run(input, output)
            return normalize(output[0])
        } finally {
            if (scaled !== crop) scaled.recycle()
            if (crop !== bitmap) crop.recycle()
        }
    }

    /** Respect camera row/pixel strides, including interleaved chroma and padded rows. */
    fun uprightBitmap(proxy: ImageProxy): Bitmap {
        val planes = proxy.planes
        require(planes.size == 3)
        val buffers = planes.map { it.buffer.duplicate() }
        val starts = buffers.map { it.position() }
        fun sample(p: Int, x: Int, y: Int) = buffers[p].get(starts[p] + y * planes[p].rowStride + x * planes[p].pixelStride).toInt() and 255
        val pixels = IntArray(proxy.width * proxy.height)
        for (y in 0 until proxy.height) for (x in 0 until proxy.width) {
            val yy = (sample(0, x, y) - 16).coerceAtLeast(0)
            val u = sample(1, x / 2, y / 2) - 128; val v = sample(2, x / 2, y / 2) - 128
            val r = ((298 * yy + 409 * v + 128) shr 8).coerceIn(0, 255)
            val g = ((298 * yy - 100 * u - 208 * v + 128) shr 8).coerceIn(0, 255)
            val b = ((298 * yy + 516 * u + 128) shr 8).coerceIn(0, 255)
            pixels[y * proxy.width + x] = Color.rgb(r, g, b)
        }
        val raw = Bitmap.createBitmap(pixels, proxy.width, proxy.height, Bitmap.Config.ARGB_8888)
        if (proxy.imageInfo.rotationDegrees == 0) return raw
        val rotated = Bitmap.createBitmap(raw, 0, 0, raw.width, raw.height, Matrix().apply { postRotate(proxy.imageInfo.rotationDegrees.toFloat()) }, true)
        if (rotated !== raw) raw.recycle()
        return rotated
    }
}
