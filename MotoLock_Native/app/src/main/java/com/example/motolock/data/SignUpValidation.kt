package com.example.motolock.data

object SignUpValidation {
    fun nameError(value: String): String? = when {
        value.isBlank() -> "Name is required."
        value.trim().length < 2 -> "Please enter a valid name."
        value.any { it.isDigit() } -> "Name cannot contain numbers."
        else -> null
    }

    fun emailError(value: String): String? = when {
        value.isBlank() -> "Email is required."
        !Regex("^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+$").matches(value.trim()) -> "Please enter a valid email address."
        else -> null
    }

    fun passwordError(value: String): String? = when {
        value.length < 8 -> "Password must contain at least 8 characters."
        !value.any { !it.isLetterOrDigit() } -> "Password must contain a special character."
        else -> null
    }

    fun confirmationError(password: String, confirmation: String): String? = when {
        confirmation.isBlank() -> "Please confirm your password."
        password != confirmation -> "Passwords do not match."
        else -> null
    }
}
