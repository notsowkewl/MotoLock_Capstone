package com.example.motolock

import com.example.motolock.data.SignUpValidation
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SignUpValidationTest {
    @Test fun nameValidation() {
        assertEquals("Name is required.", SignUpValidation.nameError("  "))
        assertEquals("Please enter a valid name.", SignUpValidation.nameError("A"))
        assertNull(SignUpValidation.nameError("Ari Rider"))
    }

    @Test fun emailValidation() {
        assertEquals("Email is required.", SignUpValidation.emailError(""))
        assertEquals("Please enter a valid email address.", SignUpValidation.emailError("not-an-email"))
        assertNull(SignUpValidation.emailError("rider@example.com"))
    }

    @Test fun passwordRequirements() {
        assertEquals("Password must contain at least 8 characters.", SignUpValidation.passwordError("short!"))
        assertEquals("Password must contain a special character.", SignUpValidation.passwordError("longpassword"))
        assertNull(SignUpValidation.passwordError("Longpass!"))
    }

    @Test fun confirmationMustMatch() {
        assertEquals("Please confirm your password.", SignUpValidation.confirmationError("Longpass!", ""))
        assertEquals("Passwords do not match.", SignUpValidation.confirmationError("Longpass!", "Longpass?"))
        assertNull(SignUpValidation.confirmationError("Longpass!", "Longpass!"))
    }
}
