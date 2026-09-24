package com.example.motolock

import com.example.motolock.data.CameraDecision
import com.example.motolock.data.FaceData
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class CameraFlowTest {
    @Test fun identityPrecedesHelmetPrompt() {
        assertEquals(false to "Face ID not recognized", CameraDecision.evaluate(1, false, false, helmetModelValidated = true))
        assertEquals(false to "Face ID not recognized", CameraDecision.evaluate(1, false, true, helmetModelValidated = true))
        assertEquals(false to "Put your helmet", CameraDecision.evaluate(1, true, false, helmetModelValidated = true))
        assertTrue(CameraDecision.evaluate(1, true, true, helmetModelValidated = true).first)
    }

    @Test fun multipleAndMissingFacesInvalidatePreviousPass() {
        assertTrue(CameraDecision.evaluate(1, true, true, helmetModelValidated = true).first)
        for (count in listOf(0, 2, 3)) assertFalse(CameraDecision.evaluate(count, true, true, helmetModelValidated = true).first)
        assertFalse(CameraDecision.evaluate(1, false, true, helmetModelValidated = true).first)
        assertFalse(CameraDecision.evaluate(1, true, false, helmetModelValidated = true).first)
    }

    @Test fun unvalidatedModelNeverClaimsHelmetPresenceOrAbsence() {
        for (rawPrediction in listOf(false, true)) {
            assertEquals(false to "Helmet check unavailable", CameraDecision.evaluate(1, true, rawPrediction))
            assertEquals(false to "Face ID not recognized", CameraDecision.evaluate(1, false, rawPrediction))
            assertFalse(CameraDecision.evaluate(2, true, rawPrediction).first)
        }
    }

    @Test fun savedArraysAndLegacyStringsDecodeIdentically() {
        val array = JsonArray(List(192) { JsonPrimitive((it - 96) / 192f) })
        assertArrayEquals(FaceData.decode(array), FaceData.decode(JsonPrimitive(array.toString())), 0f)
        val saved = FaceData.decode(array)
        assertTrue(FaceData.matches(saved, FloatArray(192) { saved[it] * 3 }))
        assertFalse(FaceData.matches(saved, FloatArray(192) { -saved[it] }))
    }

    @Test fun placeholdersMalformedAndWrongModelVectorsAreRejected() {
        val bad = listOf<JsonElement?>(null, JsonNull, JsonPrimitive("broken"),
            JsonArray(List(128) { JsonPrimitive(0.1f) }),
            JsonArray(List(192) { JsonPrimitive(0.1f) }),
            JsonArray(List(192) { JsonPrimitive(if (it == 0) "NaN" else "1") }))
        for (value in bad) assertTrue(runCatching { FaceData.decode(value) }.isFailure)
    }
}
