# coding=utf-8
with open('app/src/main/java/com/example/motolock/RegistrationScreens.kt', 'r', encoding='utf-8') as f:
    code = f.read()

# Auto-check terms when clicking I Accept
terms_old = """                    Button(
                        onClick = { showTermsModal = false },"""
terms_new = """                    Button(
                        onClick = { 
                            terms = true
                            privacy = true
                            showTermsModal = false 
                        },"""
code = code.replace(terms_old, terms_new)

# Add password length & special char check
# Add red border and error text
val_old = """                if (fullName.isBlank() || email.isBlank() || password.isBlank()) {
                    Toast.makeText(context, "Please fill in all required fields", Toast.LENGTH_SHORT).show()
                    return@Button
                }"""
val_new = """                if (fullName.isBlank() || email.isBlank() || password.isBlank()) {
                    Toast.makeText(context, "Please fill in all required fields", Toast.LENGTH_SHORT).show()
                    return@Button
                }
                if (password.length < 8 || !password.any { !it.isLetterOrDigit() }) {
                    Toast.makeText(context, "Password must be at least 8 characters and contain a special character", Toast.LENGTH_LONG).show()
                    return@Button
                }
                if (password != confirmPassword) {
                    Toast.makeText(context, "Passwords do not match", Toast.LENGTH_SHORT).show()
                    return@Button
                }"""
code = code.replace(val_old, val_new)

with open('app/src/main/java/com/example/motolock/RegistrationScreens.kt', 'w', encoding='utf-8') as f:
    f.write(code)
