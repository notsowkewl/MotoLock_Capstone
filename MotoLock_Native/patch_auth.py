import os
import re

# 1. LoginScreen.kt - Add Email Icon
with open('app/src/main/java/com/example/motolock/LoginScreen.kt', 'r', encoding='utf-8') as f:
    login_code = f.read()

# Add decorationBox to Email input
old_email_input = """                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(47.dp)
                        .background(inputBg, RoundedCornerShape(14.dp))
                        .border(1.dp, if (emailError != null) Color.Red else lineCol, RoundedCornerShape(14.dp))
                        .padding(horizontal = 14.dp, vertical = 14.dp)
                )"""

new_email_input = """                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(47.dp)
                        .background(inputBg, RoundedCornerShape(14.dp))
                        .border(1.dp, if (emailError != null) Color.Red else lineCol, RoundedCornerShape(14.dp)),
                    decorationBox = { innerTextField ->
                        Row(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Email,
                                contentDescription = "Email",
                                tint = Color.DarkGray,
                                modifier = Modifier.size(20.dp).padding(end = 6.dp)
                            )
                            Box(modifier = Modifier.weight(1f)) {
                                innerTextField()
                            }
                        }
                    }
                )"""

login_code = login_code.replace(old_email_input, new_email_input)

if "import androidx.compose.material.icons.filled.Email" not in login_code:
    login_code = login_code.replace("import androidx.compose.material.icons.filled.Visibility", "import androidx.compose.material.icons.filled.Visibility\nimport androidx.compose.material.icons.filled.Email")

with open('app/src/main/java/com/example/motolock/LoginScreen.kt', 'w', encoding='utf-8') as f:
    f.write(login_code)


# 2. RegistrationScreens.kt - Email Icon & Password Icon Color
with open('app/src/main/java/com/example/motolock/RegistrationScreens.kt', 'r', encoding='utf-8') as f:
    reg_code = f.read()

old_custom_text = """fun CustomTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text
) {"""

new_custom_text = """fun CustomTextField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    isPassword: Boolean = false,
    keyboardType: KeyboardType = KeyboardType.Text,
    icon: androidx.compose.ui.graphics.vector.ImageVector? = null
) {"""
reg_code = reg_code.replace(old_custom_text, new_custom_text)

old_dec_box = """                    decorationBox = { innerTextField ->
                        Row(
                            modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Box(modifier = Modifier.weight(1f)) {
                                innerTextField()
                            }
                            if (isPassword) {
                                Icon(
                                    imageVector = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                                    contentDescription = "Toggle Password Visibility",
                                    tint = Color(0xFFED1C24),
                                    modifier = Modifier.size(24.dp).clickable { passwordVisible = !passwordVisible }.padding(start = 4.dp)
                                )
                            }
                        }
                    }"""

new_dec_box = """                    decorationBox = { innerTextField ->
                        Row(
                            modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            if (icon != null) {
                                Icon(
                                    imageVector = icon,
                                    contentDescription = null,
                                    tint = Color.DarkGray,
                                    modifier = Modifier.size(20.dp).padding(end = 6.dp)
                                )
                            }
                            Box(modifier = Modifier.weight(1f)) {
                                innerTextField()
                            }
                            if (isPassword) {
                                Icon(
                                    imageVector = if (passwordVisible) Icons.Filled.Visibility else Icons.Filled.VisibilityOff,
                                    contentDescription = "Toggle Password Visibility",
                                    tint = Color.DarkGray,
                                    modifier = Modifier.size(24.dp).clickable { passwordVisible = !passwordVisible }.padding(start = 4.dp)
                                )
                            }
                        }
                    }"""
reg_code = reg_code.replace(old_dec_box, new_dec_box)

reg_code = reg_code.replace("""CustomTextField("Email", email, { email = it }, keyboardType = KeyboardType.Email)""", """CustomTextField("Email", email, { email = it }, keyboardType = KeyboardType.Email, icon = Icons.Filled.Email)""")

if "import androidx.compose.material.icons.filled.Email" not in reg_code:
    reg_code = reg_code.replace("import androidx.compose.material.icons.filled.Visibility", "import androidx.compose.material.icons.filled.Visibility\nimport androidx.compose.material.icons.filled.Email")

with open('app/src/main/java/com/example/motolock/RegistrationScreens.kt', 'w', encoding='utf-8') as f:
    f.write(reg_code)


print("Login and Registration updated.")
