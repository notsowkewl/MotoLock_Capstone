package com.example.motolock

import com.example.motolock.data.*
import kotlinx.serialization.json.*
import org.junit.Assert.*
import org.junit.Test

class VerificationPolicyTest {
    @Test fun originalBlinkThenLeftAndRightSequence() {
        val c=EnrollmentChallenge()
        assertTrue(c.observe(0.95f,0.95f,0f).contains("blink"))
        c.observe(0.2f,0.2f,0f)
        assertTrue(c.observe(0.95f,0.95f,0f).contains("left"))
        assertTrue(c.observe(null,null,18f).contains("right"))
        c.observe(null,null,-18f)
        assertTrue(c.complete)
    }
    @Test fun closedEyesAloneDoNotCountAsBlink() {
        val c=EnrollmentChallenge()
        repeat(10){c.observe(0.1f,0.1f,0f)}
        c.observe(0.95f,0.95f,0f); c.observe(null,null,18f); c.observe(null,null,-18f)
        assertFalse(c.complete)
    }
    @Test fun temporarilyUnavailableEyeScoreDoesNotDiscardObservedClosure() {
        val c=EnrollmentChallenge()
        c.observe(0.95f,0.95f,0f); c.observe(0.2f,0.2f,0f)
        c.observe(null,null,0f)
        assertTrue(c.observe(0.95f,0.95f,0f).contains("left"))
    }
    @Test fun faceLossOrMultipleFacesResetChallenge() {
        val c=EnrollmentChallenge()
        c.observe(0.95f,0.95f,0f); c.observe(0.2f,0.2f,0f); c.observe(0.95f,0.95f,0f)
        c.reset(); c.observe(null,null,18f); c.observe(null,null,-18f)
        assertFalse(c.complete)
    }
    private fun vector()=FloatArray(192){if(it==0)1f else 0f}
    @Test fun helmetInputUsesSeparateRgbPlanes() {
        val actual=FloatArray(6)
        TensorPixels.rgb(intArrayOf(0x00ff0000,0x000000ff),true).asFloatBuffer().get(actual)
        assertArrayEquals(floatArrayOf(1f,0f,0f,0f,0f,1f),actual,0f)
    }
    @Test fun faceInputUsesInterleavedNormalizedRgb() {
        val actual=FloatArray(6)
        TensorPixels.rgb(intArrayOf(0x00ff0000,0x000000ff),false,127.5f,128f).asFloatBuffer().get(actual)
        val low=-127.5f/128f; val high=127.5f/128f
        assertArrayEquals(floatArrayOf(high,low,low,low,low,high),actual,0f)
    }
    @Test fun databaseArrayAndLegacyJsonStringDecodeIdentically() {
        val json=JsonArray(vector().map {JsonPrimitive(it)})
        assertArrayEquals(FaceProfiles.decode(json),FaceProfiles.decode(JsonPrimitive(json.toString())),0f)
    }
    @Test fun missingAndPlaceholderDatabaseProfilesAreNotRecognizable() {
        for(value in listOf(null,JsonNull,JsonArray(emptyList()),JsonArray(List(128){JsonPrimitive(0.1f)}),JsonArray(List(192){JsonPrimitive(0.1f)}),JsonPrimitive("invalid"))) {
            assertFalse(FaceProfiles.isUsable(value))
        }
    }
    @Test fun nonFiniteEmbeddingRejected() {
        assertThrows(IllegalArgumentException::class.java) {VerificationPolicy.normalize(FloatArray(192){Float.NaN})}
    }
    @Test fun matchingUsesNormalizedRealEmbedding() {
        val a=vector(); val b=FloatArray(192){if(it==1)1f else 0f}
        assertEquals(0f,VerificationPolicy.distance(a,a.map {it*2}.toFloatArray()),0.0001f)
        assertTrue(VerificationPolicy.distance(a,b)>VerificationPolicy.MAX_FACE_DISTANCE)
    }
    @Test fun registeredRiderWithoutHelmetGetsWearingInstruction() {
        val c=CameraCheck(); c.observe(1000,1000,true,false,"",false)
        assertEquals("Face recognized. Put your helmet on.",c.message); assertFalse(c.verified)
    }
    @Test fun riderAlreadyWearingHelmetCanPassWithoutHardwareOrBareHeadStage() {
        val c=CameraCheck()
        for(t in 1000L..1300L step 100)c.observe(t,t,true,true,"",false)
        assertTrue(c.verified); assertTrue(c.message.contains("test result"))
    }
    @Test fun wrongRiderNeverPassesEvenWithHelmet() {
        val c=CameraCheck()
        for(t in 1000L..1600L step 100)c.observe(t,t,false,true,"Face ID not recognized",false)
        assertFalse(c.verified); assertEquals("Face ID not recognized",c.message)
    }
    @Test fun multipleFacesImmediatelyClearSuccess() {
        val c=CameraCheck()
        for(t in 1000L..1300L step 100)c.observe(t,t,true,true,"",false)
        c.observe(1400,1400,false,false,"Multiple faces detected. Start again.",false)
        assertFalse(c.verified); assertTrue(c.message.startsWith("Multiple faces"))
    }
    @Test fun helmetRemovalImmediatelyClearsSuccess() {
        val c=CameraCheck()
        for(t in 1000L..1300L step 100)c.observe(t,t,true,true,"",false)
        c.observe(1400,1400,true,false,"",false)
        assertFalse(c.verified); assertTrue(c.message.contains("Put your helmet"))
    }
    @Test fun stoppedCameraClearsSuccess() {
        val c=CameraCheck()
        for(t in 1000L..1300L step 100)c.observe(t,t,true,true,"",false)
        c.tick(4000); assertFalse(c.verified)
    }
    @Test fun changedDatabaseProfileResetsSuccess() {
        val c=CameraCheck()
        for(t in 1000L..1300L step 100)c.observe(t,t,true,true,"",false)
        c.reset("Face ID loaded. Look at the camera."); assertFalse(c.verified)
    }
    @Test fun futureFrameRejected() {
        val c=CameraCheck(); c.observe(1000,1100,true,true,"",false)
        assertFalse(c.verified)
    }
}
