package com.example.motolock

import com.example.motolock.data.*
import org.junit.Assert.*
import org.junit.Test

class VerificationPolicyTest {
    @Test fun helmetInputUsesSeparateRgbPlanes() {
        val packed=TensorPixels.rgb(intArrayOf(0x00ff0000,0x000000ff),true).asFloatBuffer()
        val actual=FloatArray(6); packed.get(actual)
        assertArrayEquals(floatArrayOf(1f,0f,0f,0f,0f,1f),actual,0f)
    }
    @Test fun faceInputUsesInterleavedNormalizedRgb() {
        val packed=TensorPixels.rgb(intArrayOf(0x00ff0000,0x000000ff),false,127.5f,128f).asFloatBuffer()
        val actual=FloatArray(6); packed.get(actual)
        val low=-127.5f/128f; val high=127.5f/128f
        assertArrayEquals(floatArrayOf(high,low,low,low,low,high),actual,0f)
    }
    @Test fun resetRequiresNewLivenessChallengeAndKeepsCancellation() {
        val g=readyForAlcohol(); val revision=g.resetGeneration
        g.reset("No face"); g.reset("Sensor stale")
        assertTrue(g.resetGeneration>revision); assertTrue(g.needsCancel)
        g.hardware(2000,false,"IDLE",false,true)
        for(t in 2100L..2600L step 100) g.vision(t,t,true,false,false,"Blink")
        assertEquals(VerificationGate.Stage.BARE_FACE,g.stage)
    }
    private fun readyForAlcohol():VerificationGate {
        val g=VerificationGate()
        g.hardware(1000,false,"IDLE",false,true)
        for(t in 1100L..1400L step 100) g.vision(t,t,true,false,true,"")
        assertEquals(VerificationGate.Stage.PUT_ON_HELMET,g.stage)
        g.hardware(1500,true,"IDLE",false,true)
        for(t in 1600L..1900L step 100) g.vision(t,t,true,true,true,"")
        assertEquals(VerificationGate.Stage.ALCOHOL,g.stage)
        return g
    }
    @Test fun staleOrReplayPassCannotAuthorize() {
        val g=readyForAlcohol()
        assertFalse(g.acceptPass(1900))
        g.hardware(2000,true,"MEASURING_ALCOHOL",false,true)
        assertFalse(g.acceptPass(5000))
    }
    @Test fun requiresLiveFaceHelmetHardwareAndActiveTest() {
        val g=readyForAlcohol()
        g.hardware(2000,true,"MEASURING_ALCOHOL",false,true)
        assertTrue(g.acceptPass(2100))
        g.hardware(2200,true,"RESULT_PASS",true,true)
        assertEquals(VerificationGate.Stage.READY,g.stage)
        g.vision(2300,2300,false,true,false,"Wrong rider")
        assertEquals(VerificationGate.Stage.BARE_FACE,g.stage)
        assertTrue(g.needsCancel)
        assertFalse(g.acceptPass(2300))
    }
    @Test fun missingCameraExpiresPermission() {
        val g=readyForAlcohol(); g.tick(5000)
        assertEquals(VerificationGate.Stage.BARE_FACE,g.stage); assertTrue(g.needsCancel)
    }
    @Test fun sensorRemovalOrStaleTransmitterRevokes() {
        val g=readyForAlcohol(); g.hardware(2000,false,"IDLE",false,true)
        assertEquals(VerificationGate.Stage.BARE_FACE,g.stage); assertTrue(g.needsCancel)
        val stale=readyForAlcohol(); stale.hardware(2000,true,"IDLE",false,true,false)
        assertFalse(stale.valid(2000)); assertTrue(stale.needsCancel)
    }
    @Test fun cannotStartWithIrAlreadyTriggered() {
        val g=VerificationGate(); g.hardware(1000,true,"IDLE",false,true)
        for(t in 1100L..2000L step 100) g.vision(t,t,true,false,true,"")
        assertEquals(VerificationGate.Stage.BARE_FACE,g.stage)
    }
    @Test fun rejectsUncorrelatedWearingTransition() {
        val g=VerificationGate(); g.hardware(1000,false,"IDLE",false,true)
        for(t in 1100L..1400L step 100) g.vision(t,t,true,false,true,"")
        g.hardware(1500,true,"IDLE",false,true)
        for(t in 1600L..6000L step 200) {g.hardware(t,true,"IDLE",false,true); g.vision(t,t,true,false,true,"")}
        g.vision(6100,6100,true,true,true,"")
        assertEquals(VerificationGate.Stage.BARE_FACE,g.stage)
    }
    @Test fun runningMotorNeverRequestsCameraCutoff() {
        val g=readyForAlcohol(); g.hardware(2000,true,"RESULT_PASS",true,false)
        g.reset("Camera stopped"); g.tick(10000)
        assertEquals(VerificationGate.Stage.STARTED,g.stage); assertFalse(g.needsCancel)
    }
    @Test fun invalidFaceVectorsRejected() {
        for(v in listOf(FloatArray(128){0.1f},FloatArray(192){0.1f},FloatArray(192){Float.NaN})) {
            assertThrows(IllegalArgumentException::class.java) {VerificationPolicy.normalize(v)}
        }
        val a=FloatArray(192){if(it==0)1f else 0f}
        val b=FloatArray(192){if(it==1)1f else 0f}
        assertEquals(0f,VerificationPolicy.distance(a,a),0.0001f)
        assertTrue(VerificationPolicy.distance(a,b)>VerificationPolicy.MAX_FACE_DISTANCE)
    }
    @Test fun oldAndFutureFramesRejected() {
        assertFalse(VerificationPolicy.fresh(5000,2000)); assertFalse(VerificationPolicy.fresh(5000,5001))
        assertTrue(VerificationPolicy.fresh(5000,4999))
    }
}
