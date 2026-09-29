package com.example.motolock.data

object AuthRecovery {
    private val state = kotlinx.coroutines.flow.MutableStateFlow(false)
    val pendingFlow: kotlinx.coroutines.flow.StateFlow<Boolean> = state
    var pending: Boolean
        get() = state.value
        set(value) { state.value = value }
}
