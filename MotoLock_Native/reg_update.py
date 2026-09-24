# coding=utf-8
import re

with open('app/src/main/java/com/example/motolock/RegistrationScreens.kt', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. State vars
state_old = """    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var confirmPasswordVisible by remember { mutableStateOf(false) }
    var terms by remember { mutableStateOf(false) }
    var privacy by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var showTermsModal by remember { mutableStateOf(false) }"""
state_new = """    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var confirmPasswordVisible by remember { mutableStateOf(false) }
    var terms by remember { mutableStateOf(false) }
    var privacy by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var showTermsModal by remember { mutableStateOf(false) }
    var passwordError by remember { mutableStateOf<String?>(null) }
    var confirmPasswordError by remember { mutableStateOf<String?>(null) }"""
code = code.replace(state_old, state_new)

# 2. Terms "I Accept" automatically checks the checkbox
terms_old = """                    Button(
                        onClick = { showTermsModal = false },"""
terms_new = """                    Button(
                        onClick = { 
                            terms = true
                            privacy = true
                            showTermsModal = false 
                        },"""
code = code.replace(terms_old, terms_new)

with open('app/src/main/java/com/example/motolock/RegistrationScreens.kt', 'w', encoding='utf-8') as f:
    f.write(code)
