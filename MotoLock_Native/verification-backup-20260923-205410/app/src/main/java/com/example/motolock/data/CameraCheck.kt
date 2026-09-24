package com.example.motolock.data

/** Camera test results only. This class has no hardware permissions or authorization commands. */
class CameraCheck {
    var message="Look at the camera"; private set
    var verified=false; private set
    private var helmetSamples=0
    private var lastFrame=0L
    fun reset(reason:String) {message=reason; verified=false; helmetSamples=0; lastFrame=0}
    fun observe(now:Long,capturedAt:Long,matches:Boolean,helmet:Boolean,reason:String,labelsVerified:Boolean) {
        lastFrame=capturedAt
        if(!VerificationPolicy.fresh(now,capturedAt)) {reset("Camera paused. Look at the camera again."); return}
        if(!matches) {verified=false; helmetSamples=0; message=reason; return}
        if(!helmet) {verified=false; helmetSamples=0; message="Face recognized. Put your helmet on."; return}
        helmetSamples++
        verified=helmetSamples>=VerificationPolicy.STABLE_SAMPLES
        message=if(!verified) "Face recognized. Checking helmet..." else if(labelsVerified) "Registered face and helmet detected" else "Registered face and helmet detected — test result"
    }
    fun tick(now:Long) {if(lastFrame>0 && !VerificationPolicy.fresh(now,lastFrame)) reset("Camera paused. Look at the camera again.")}
}
