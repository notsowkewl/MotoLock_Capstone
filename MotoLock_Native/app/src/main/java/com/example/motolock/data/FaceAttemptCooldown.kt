package com.example.motolock.data

import android.content.Context

/** Five wrong recognized faces trigger a persisted, 30-second retry cooldown. */
object FaceAttemptCooldown {
    const val MAX_FAILED_ATTEMPTS = 5
    const val COOLDOWN_MS = 30_000L

    data class Status(
        val failedAttempts: Int,
        val remainingMs: Long
    )

    private const val PREFS = "MotoLockPrefs"
    private const val FAILED_ATTEMPTS_KEY = "face_failed_attempts"
    private const val COOLDOWN_UNTIL_KEY = "face_cooldown_until"

    @Synchronized
    fun status(context: Context): Status {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val now = System.currentTimeMillis()
        val cooldownUntil = prefs.getLong(COOLDOWN_UNTIL_KEY, 0L)
        if (cooldownUntil > now) {
            return Status(MAX_FAILED_ATTEMPTS, cooldownUntil - now)
        }
        if (cooldownUntil != 0L) {
            prefs.edit().remove(COOLDOWN_UNTIL_KEY).remove(FAILED_ATTEMPTS_KEY).apply()
            return Status(0, 0L)
        }
        return Status(prefs.getInt(FAILED_ATTEMPTS_KEY, 0).coerceIn(0, MAX_FAILED_ATTEMPTS - 1), 0L)
    }

    @Synchronized
    fun registerFailure(context: Context): Status {
        val prefs = context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val current = status(context)
        if (current.remainingMs > 0L) return current

        val failedAttempts = current.failedAttempts + 1
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            val cooldownUntil = System.currentTimeMillis() + COOLDOWN_MS
            prefs.edit()
                .putInt(FAILED_ATTEMPTS_KEY, MAX_FAILED_ATTEMPTS)
                .putLong(COOLDOWN_UNTIL_KEY, cooldownUntil)
                .commit()
            return Status(MAX_FAILED_ATTEMPTS, COOLDOWN_MS)
        }

        prefs.edit().putInt(FAILED_ATTEMPTS_KEY, failedAttempts).commit()
        return Status(failedAttempts, 0L)
    }

    @Synchronized
    fun registerSuccess(context: Context) {
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .remove(FAILED_ATTEMPTS_KEY)
            .remove(COOLDOWN_UNTIL_KEY)
            .commit()
    }
}
