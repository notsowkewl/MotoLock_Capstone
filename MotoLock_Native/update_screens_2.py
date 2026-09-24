# coding=utf-8
import os

# --- LoginScreen.kt ---
with open('app/src/main/java/com/example/motolock/LoginScreen.kt', 'r', encoding='utf-8') as f:
    login_code = f.read()

if 'import androidx.compose.material.icons.Icons' not in login_code:
    login_code = login_code.replace('import androidx.compose.material3.*', 'import androidx.compose.material3.*\nimport androidx.compose.material.icons.Icons\nimport androidx.compose.material.icons.filled.Visibility\nimport androidx.compose.material.icons.filled.VisibilityOff\nimport androidx.compose.material3.Icon')

# Remove forgot password from the Row
forgot_old = """                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Password", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
                    Text(
                        "Forgot?", 
                        fontSize = 11.sp, 
                        fontWeight = FontWeight.Black, 
                        color = motoRed,
                        modifier = Modifier.clickable { 
                            Toast.makeText(context, "Forgot Password Clicked", Toast.LENGTH_SHORT).show() 
                        }
                    )
                }"""
forgot_new = """                Text("Password", fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))"""
login_code = login_code.replace(forgot_old, forgot_new)

# Add it below
pwd_field = """                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(modifier = Modifier.weight(1f)) {
                                if (password.isEmpty()) {
                                    Text("Enter password", fontSize = 13.sp, color = Color.Gray)
                                }
                                innerTextField()
                            }
                            Text(
                                text = if (passwordVisible) "Hide" else "Show",
                                fontSize = 11.sp,
                                color = motoRed,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.clickable { passwordVisible = !passwordVisible }.padding(start = 8.dp)
                            )
                        }
                    }
                )"""
pwd_field_new = """                        Row(
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
                )
                Spacer(modifier = Modifier.height(10.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    Text(
                        "Forgot Password?", 
                        fontSize = 11.sp, 
                        fontWeight = FontWeight.Black, 
                        color = motoRed,
                        modifier = Modifier.clickable { 
                            Toast.makeText(context, "Forgot Password Clicked", Toast.LENGTH_SHORT).show() 
                        }
                    )
                }"""
login_code = login_code.replace(pwd_field, pwd_field_new)

with open('app/src/main/java/com/example/motolock/LoginScreen.kt', 'w', encoding='utf-8') as f:
    f.write(login_code)


# --- RegistrationScreens.kt ---
with open('app/src/main/java/com/example/motolock/RegistrationScreens.kt', 'r', encoding='utf-8') as f:
    reg_code = f.read()

if 'import androidx.compose.material.icons.filled.Visibility' not in reg_code:
    reg_code = reg_code.replace('import androidx.compose.material.icons.Icons', 'import androidx.compose.material.icons.Icons\nimport androidx.compose.material.icons.filled.Visibility\nimport androidx.compose.material.icons.filled.VisibilityOff\nimport androidx.compose.material3.Icon')

field_old = """                    Box(modifier = Modifier.weight(1f)) {
                        if (value.isEmpty()) {
                            Text(placeholder, fontSize = 13.sp, color = Color.Gray)
                        }
                        innerTextField()
                    }
                    if (isPassword) {
                        Text(
                            text = if (passwordVisible) "Hide" else "Show",
                            fontSize = 11.sp,
                            color = Color(0xFFED1C24),
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.clickable { passwordVisible = !passwordVisible }.padding(start = 8.dp)
                        )
                    }"""
field_new = """                    Box(modifier = Modifier.weight(1f)) {
                        innerTextField()
                    }
                    if (isPassword) {
                        Icon(
                            imageVector = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                            contentDescription = "Toggle Password Visibility",
                            tint = Color(0xFFED1C24),
                            modifier = Modifier.size(24.dp).clickable { passwordVisible = !passwordVisible }.padding(start = 4.dp)
                        )
                    }"""
reg_code = reg_code.replace(field_old, field_new)

terms_old = """        if (showTerms) {
            AlertDialog(
                onDismissRequest = { showTerms = false },
                title = { Text("Terms & Privacy Policy", fontWeight = FontWeight.Bold) },
                text = { Text("By using MotoLock, you agree to secure your motorcycle using our AI verification systems. We store your account data securely. Ride safely.") },
                confirmButton = {
                    TextButton(onClick = { showTerms = false }) {
                        Text("Accept", color = motoRed)
                    }
                }
            )
        }"""
terms_new = """        if (showTerms) {
            androidx.compose.ui.window.Dialog(onDismissRequest = { showTerms = false }) {
                Surface(
                    shape = RoundedCornerShape(18.dp),
                    color = Color.White,
                    modifier = Modifier.fillMaxWidth().padding(16.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text("Terms & Privacy", fontSize = 20.sp, fontWeight = FontWeight.Black, color = motoBlack)
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            "MotoLock ensures your motorcycle is securely locked and accessible only to you through Face ID and Helmet verification.\n\nData is securely stored in our cloud infrastructure. By continuing, you agree to these terms.",
                            fontSize = 13.sp, color = textGray, lineHeight = 20.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center
                        )
                        Spacer(modifier = Modifier.height(24.dp))
                        Button(
                            onClick = { showTerms = false },
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = motoRed),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("I Accept", color = Color.White, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }"""
reg_code = reg_code.replace(terms_old, terms_new)

with open('app/src/main/java/com/example/motolock/RegistrationScreens.kt', 'w', encoding='utf-8') as f:
    f.write(reg_code)

