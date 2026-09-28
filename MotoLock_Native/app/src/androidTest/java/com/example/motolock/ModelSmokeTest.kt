package com.example.motolock

import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.json.JSONArray
import org.json.JSONObject
import org.tensorflow.lite.Interpreter
import org.tensorflow.lite.DataType
import java.io.File
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.security.MessageDigest
import kotlin.math.sqrt

/** Runs the shipped models on the phone without camera access or rider data.
 * Synthetic tensors test contracts/numerics only; they cannot establish accuracy.
 */
@RunWith(AndroidJUnit4::class)
class ModelSmokeTest {
    @Test fun shippedModelsExecuteOnDevice() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val report = JSONObject().put("accuracyMeasured", false)
            .put("reason", "No labeled real-image dataset; synthetic runtime checks only")
            .put("device", "${android.os.Build.MANUFACTURER} ${android.os.Build.MODEL}")
            .put("androidSdk", android.os.Build.VERSION.SDK_INT).put("threads", 4)
        val models = JSONArray()
        for (name in listOf("mobilefacenet.tflite", "helmet.tflite")) {
            val bytes = context.assets.open(name).use { it.readBytes() }
            val buffer = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder())
            buffer.put(bytes); buffer.rewind()
            val face = name.startsWith("mobileface")
            Interpreter(buffer, Interpreter.Options().apply { setNumThreads(4) }).use { model ->
                val inputTensor = model.getInputTensor(0)
                val outputTensor = model.getOutputTensor(0)
                assertArrayEquals(if (face) intArrayOf(1,112,112,3) else intArrayOf(1,3,640,640), inputTensor.shape())
                assertArrayEquals(if (face) intArrayOf(1,192) else intArrayOf(1,6,8400), outputTensor.shape())
                assertEquals(DataType.FLOAT32, inputTensor.dataType())
                assertEquals(DataType.FLOAT32, outputTensor.dataType())
                val result = JSONObject().put("name", name)
                    .put("sha256", MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 255) })
                    .put("inputShape", JSONArray(inputTensor.shape().toList()))
                    .put("outputShape", JSONArray(outputTensor.shape().toList()))
                    .put("inputType", inputTensor.dataType().toString()).put("outputType", outputTensor.dataType().toString())
                val runs = JSONArray()
                var repeated: FloatArray? = null
                for (kind in listOf("black", "gray", "white", "noise", "noise-repeat")) {
                    val input = ByteBuffer.allocateDirect(inputTensor.numBytes()).order(ByteOrder.nativeOrder())
                    val random = java.util.Random(44)
                    repeat(inputTensor.numBytes() / 4) {
                        val pixel = when (kind) { "black" -> 0; "gray" -> 128; "white" -> 255; else -> random.nextInt(256) }
                        input.putFloat(if (face) (pixel - 127.5f) / 128f else pixel / 255f)
                    }
                    input.rewind()
                    val output = ByteBuffer.allocateDirect(outputTensor.numBytes()).order(ByteOrder.nativeOrder())
                    val start = android.os.SystemClock.elapsedRealtimeNanos()
                    model.run(input, output)
                    val ms = (android.os.SystemClock.elapsedRealtimeNanos() - start) / 1_000_000.0
                    output.rewind()
                    val values = FloatArray(outputTensor.numBytes() / 4) { output.float }
                    assertTrue("$name $kind output must be finite", values.all { it.isFinite() })
                    val run = JSONObject().put("input", kind).put("elapsedMs", ms)
                        .put("outputMin", values.minOrNull()).put("outputMax", values.maxOrNull())
                    if (face) {
                        val norm = sqrt(values.sumOf { it.toDouble() * it })
                        assertTrue(norm > 0.00001)
                        assertTrue(values.maxOrNull()!! - values.minOrNull()!! > 0.00001f)
                        run.put("embeddingNorm", norm)
                    } else {
                        run.put("class0Max", values.sliceArray(4*8400 until 5*8400).maxOrNull())
                        run.put("class1Max", values.sliceArray(5*8400 until 6*8400).maxOrNull())
                        run.put("scoreThresholdCandidates", (0 until 8400).count {
                            values[4*8400+it] >= 0.5f && values[4*8400+it] >= values[5*8400+it] + 0.15f
                        })
                    }
                    if (kind == "noise") repeated = values
                    if (kind == "noise-repeat") {
                        val maxDiff = values.indices.maxOf { kotlin.math.abs(values[it] - repeated!![it]) }
                        assertTrue("Repeated input should be deterministic", maxDiff < 0.0001f)
                        run.put("repeatMaxAbsoluteDifference", maxDiff)
                    }
                    runs.put(run)
                }
                models.put(result.put("runs", runs))
            }
        }
        report.put("models", models)
        File(context.filesDir, "model-smoke-report.json").writeText(report.toString(2))
    }
}
