# coding=utf-8
import re

with open('app/src/main/java/com/example/motolock/LoginScreen.kt', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. State vars
state_old = """    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }"""
state_new = """    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    var isLoading by remember { mutableStateOf(false) }
    var emailError by remember { mutableStateOf<String?>(null) }
    var passwordError by remember { mutableStateOf<String?>(null) }"""
code = code.replace(state_old, state_new)

# 2. Email field border and error
email_field_old = """                BasicTextField(
                    value = email,
                    onValueChange = { email = it },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    textStyle = TextStyle(fontSize = 13.sp, color = motoBlack),
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(47.dp)
                        .background(inputBg, RoundedCornerShape(14.dp))
                        .border(1.dp, lineCol, RoundedCornerShape(14.dp))
                        .padding(horizontal = 14.dp, vertical = 14.dp)
                )"""
email_field_new = """                BasicTextField(
                    value = email,
                    onValueChange = { 
                        email = it
                        emailError = null
                    },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                    textStyle = TextStyle(fontSize = 13.sp, color = motoBlack),
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(47.dp)
                        .background(inputBg, RoundedCornerShape(14.dp))
                        .border(1.dp, if (emailError != null) Color.Red else lineCol, RoundedCornerShape(14.dp))
                        .padding(horizontal = 14.dp, vertical = 14.dp)
                )
                if (emailError != null) {
                    Text(emailError!!, color = Color.Red, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
                }"""
code = code.replace(email_field_old, email_field_new)

# 3. Password field border, icon color, and error
pw_field_old = """                BasicTextField(
                    value = password,
                    onValueChange = { password = it },
                    visualTransformation = if (passwordVisible) androidx.compose.ui.text.input.VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    textStyle = TextStyle(fontSize = 13.sp, color = motoBlack),
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(47.dp)
                        .background(inputBg, RoundedCornerShape(14.dp))
                        .border(1.dp, lineCol, RoundedCornerShape(14.dp)),
                    decorationBox = { innerTextField ->
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(modifier = Modifier.weight(1f)) {
                                innerTextField()
                            }
                            Icon(
                                imageVector = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                                contentDescription = "Toggle Password Visibility",
                                tint = motoRed,
                                modifier = Modifier.size(24.dp).clickable { passwordVisible = !passwordVisible }.padding(start = 4.dp)
                            )
                        }
                    }
                )"""
pw_field_new = """                BasicTextField(
                    value = password,
                    onValueChange = { 
                        password = it 
                        passwordError = null
                    },
                    visualTransformation = if (passwordVisible) androidx.compose.ui.text.input.VisualTransformation.None else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    textStyle = TextStyle(fontSize = 13.sp, color = motoBlack),
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(47.dp)
                        .background(inputBg, RoundedCornerShape(14.dp))
                        .border(1.dp, if (passwordError != null) Color.Red else lineCol, RoundedCornerShape(14.dp)),
                    decorationBox = { innerTextField ->
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(modifier = Modifier.weight(1f)) {
                                innerTextField()
                            }
                            Icon(
                                imageVector = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                                contentDescription = "Toggle Password Visibility",
                                tint = Color.DarkGray,
                                modifier = Modifier.size(24.dp).clickable { passwordVisible = !passwordVisible }.padding(start = 4.dp)
                            )
                        }
                    }
                )
                if (passwordError != null) {
                    Text(passwordError!!, color = Color.Red, fontSize = 11.sp, modifier = Modifier.padding(top = 4.dp))
                }"""
code = code.replace(pw_field_old, pw_field_new)

# 4. Button validation logic
btn_old = """                    if (email.isBlank() || password.isBlank()) {
                        Toast.makeText(context, "Please enter email and password", Toast.LENGTH_SHORT).show()
                        return@Button
                    }
                    isLoading = true
                    coroutineScope.launch {
                        try {
                            SupabaseClientManager.client.auth.signInWith(Email) {
                                this.email = email
                                this.password = password
                            }
                            onLoginSuccess()
                        } catch (e: Exception) {
                            Toast.makeText(context, "Login Failed: ${e.message}", Toast.LENGTH_LONG).show()
                        } finally {
                            isLoading = false
                        }
                    }"""
btn_new = """                    var valid = true
                    if (email.isBlank()) { emailError = "Email is required"; valid = false }
                    if (password.isBlank()) { passwordError = "Password is required"; valid = false }
                    if (!valid) return@Button
                    
                    isLoading = true
                    coroutineScope.launch {
                        try {
                            SupabaseClientManager.client.auth.signInWith(Email) {
                                this.email = email
                                this.password = password
                            }
                            onLoginSuccess()
                        } catch (e: Exception) {
                            if (e.message?.contains("credentials") == true || e.message?.contains("invalid") == true) {
                                emailError = "Invalid email or password"
                                passwordError = "Invalid email or password"
                            } else {
                                Toast.makeText(context, "Login Failed: ${e.message}", Toast.LENGTH_LONG).show()
                            }
                        } finally {
                            isLoading = false
                        }
                    }"""
code = code.replace(btn_old, btn_new)

with open('app/src/main/java/com/example/motolock/LoginScreen.kt', 'w', encoding='utf-8') as f:
    f.write(code)
