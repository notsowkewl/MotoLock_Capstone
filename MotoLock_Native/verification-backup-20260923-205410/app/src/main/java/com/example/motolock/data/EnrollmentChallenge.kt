package com.example.motolock.data

import kotlin.math.abs

/** Original open/closed/open blink, then left/right turns. No model inference in this loop. */
class EnrollmentChallenge {
    private var phase=0
    val complete get()=phase==5
    fun reset() {phase=0}
    fun observe(left:Float?,right:Float?,yaw:Float):String {
        if(phase<=2) {
            if(abs(yaw)>15f) {phase=0; return "Look straight ahead to blink"}
            if(left==null || right==null) return "Keep both eyes visible"
            val open=left>0.85f && right>0.85f
            val closed=left<0.35f && right<0.35f
            when(phase) {
                0->if(open) phase=1
                1->if(closed) phase=2
                2->if(open) phase=3
            }
        } else when(phase) {
            3->if(yaw>15f) phase=4
            4->if(yaw< -15f) phase=5
        }
        return when(phase) {
            0->"Position your face in the circle"
            1->"Eyes open - now blink!"
            2->"Blink"
            3->"Turn your head to your left"
            4->"Turn your head to your right"
            else->"Face forward and hold still"
        }
    }
}
