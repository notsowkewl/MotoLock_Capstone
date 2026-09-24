package com.example.motolock.data

/** Evaluated anew for every frame. No remembered identity or helmet pass. */
object CameraDecision {
    fun evaluate(faceCount: Int, faceMatches: Boolean, helmetOnHead: Boolean,
                 helmetModelValidated: Boolean = false): Pair<Boolean, String> = when {
        faceCount > 1 -> false to "Multiple faces detected. Only one rider allowed."
        faceCount == 0 -> false to "No face detected. Keep your face visible."
        !faceMatches -> false to "Face ID not recognized"
        // Bare-head phone testing disproved the bundled model's provisional class-0 mapping.
        // Unlabeled model scores cannot support either a helmet pass or a no-helmet prompt.
        !helmetModelValidated -> false to "Helmet check unavailable"
        !helmetOnHead -> false to "Put your helmet"
        else -> true to "Face and helmet detected. Camera check passed."
    }
}
