# coding=utf-8
import os

# --- LoginScreen.kt ---
with open('app/src/main/java/com/example/motolock/LoginScreen.kt', 'r', encoding='utf-8') as f:
    login_code = f.read()

# Remove Smart Helmet Security
login_code = login_code.replace("""            Text(
                text = "Smart Helmet Security",
                fontSize = 13.sp,
                color = Color(0xFF737987),
                lineHeight = 18.sp
            )
            
            Spacer(modifier = Modifier.height(30.dp))""", "            Spacer(modifier = Modifier.height(30.dp))")

# Add hide/show for password in LoginScreen
if 'var passwordVisible' not in login_code:
    login_code = login_code.replace('var password by remember { mutableStateOf("") }', 
                                    'var password by remember { mutableStateOf("") }\n    var passwordVisible by remember { mutableStateOf(false) }')

password_field_old = """                BasicTextField(
                    value = password,
                    onValueChange = { password = it },
                    visualTransformation = PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                    textStyle = TextStyle(fontSize = 13.sp, color = motoBlack),
                    singleLine = true,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(47.dp)
                        .background(inputBg, RoundedCornerShape(14.dp))
                        .border(1.dp, lineCol, RoundedCornerShape(14.dp))
                        .padding(horizontal = 14.dp, vertical = 14.dp)
                )"""

password_field_new = """                BasicTextField(
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

login_code = login_code.replace(password_field_old, password_field_new)

with open('app/src/main/java/com/example/motolock/LoginScreen.kt', 'w', encoding='utf-8') as f:
    f.write(login_code)


# --- RegistrationScreens.kt ---
with open('app/src/main/java/com/example/motolock/RegistrationScreens.kt', 'r', encoding='utf-8') as f:
    reg_code = f.read()

# Remove back button
back_btn_old = """        // Topbar
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .background(Color.White.copy(alpha = 0.88f), RoundedCornerShape(14.dp))
                    .border(1.dp, lineCol, RoundedCornerShape(14.dp))
                    .shadow(18.dp, RoundedCornerShape(14.dp), spotColor = Color(0xFF0F172A).copy(alpha = 0.05f))
                    .clickable { onBack() },
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp), tint = motoBlack)
            }
        }"""
back_btn_new = """        // Topbar removed as requested"""
reg_code = reg_code.replace(back_btn_old, back_btn_new)

# Add Terms dialog state
if 'var showTerms by remember' not in reg_code:
    reg_code = reg_code.replace('var isLoading by remember { mutableStateOf(false) }',
                                'var isLoading by remember { mutableStateOf(false) }\n    var showTerms by remember { mutableStateOf(false) }')

# Clickable terms
terms_old = """        // Checkbox row
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(
                checked = termsAccepted,
                onCheckedChange = { termsAccepted = it },
                colors = CheckboxDefaults.colors(checkedColor = motoRed)
            )
            Text("I agree to the Terms & Privacy", fontSize = 11.sp, color = textGray)
        }"""
terms_new = """        // Checkbox row
        Row(verticalAlignment = Alignment.CenterVertically) {
            Checkbox(
                checked = termsAccepted,
                onCheckedChange = { termsAccepted = it },
                colors = CheckboxDefaults.colors(checkedColor = motoRed)
            )
            Text("I agree to the ", fontSize = 11.sp, color = textGray)
            Text("Terms & Privacy", fontSize = 11.sp, color = motoRed, fontWeight = FontWeight.Bold, modifier = Modifier.clickable { showTerms = true })
        }
        
        if (showTerms) {
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
reg_code = reg_code.replace(terms_old, terms_new)

# Make registration DB insertion wrapped in try/catch to prevent failing if users table is missing or RLS blocks
db_old = """                        // Insert user profile
                        val newUser = User(
                            id = userId,
                            name = fullName,
                            email = email
                        )
                        SupabaseClientManager.client.postgrest["users"].insert(newUser)
                        
                        onNext()"""
db_new = """                        // Insert user profile
                        try {
                            val newUser = User(
                                id = userId,
                                name = fullName,
                                email = email
                            )
                            SupabaseClientManager.client.postgrest["users"].insert(newUser)
                        } catch (dbError: Exception) {
                            android.util.Log.e("Supabase", "DB Insert failed: ${dbError.message}")
                            // Proceed anyway to next screen since Auth succeeded
                        }
                        onNext()"""
reg_code = reg_code.replace(db_old, db_new)

# Update CustomTextField to support password hide/show
field_old = """@Composable
fun CustomTextField(
    label: String, 
    placeholder: String, 
    value: String, 
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false,
    onValueChange: (String) -> Unit
) {
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val inputBg = Color.White.copy(alpha = 0.92f)

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
        Spacer(modifier = Modifier.height(7.dp))
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            visualTransformation = if (isPassword) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
            textStyle = TextStyle(fontSize = 13.sp, color = motoBlack),
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .height(47.dp)
                .background(inputBg, RoundedCornerShape(14.dp))
                .border(1.dp, lineCol, RoundedCornerShape(14.dp))
                .padding(horizontal = 14.dp, vertical = 14.dp)
        )
    }
}"""
field_new = """@Composable
fun CustomTextField(
    label: String, 
    placeholder: String, 
    value: String, 
    keyboardType: KeyboardType = KeyboardType.Text,
    isPassword: Boolean = false,
    onValueChange: (String) -> Unit
) {
    val motoBlack = Color(0xFF101217)
    val lineCol = Color(0xFFE8EBF0)
    val inputBg = Color.White.copy(alpha = 0.92f)
    var passwordVisible by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxWidth()) {
        Text(label, fontSize = 11.sp, fontWeight = FontWeight.Black, color = Color(0xFF2A2F38))
        Spacer(modifier = Modifier.height(7.dp))
        BasicTextField(
            value = value,
            onValueChange = onValueChange,
            keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
            visualTransformation = if (isPassword && !passwordVisible) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
            textStyle = TextStyle(fontSize = 13.sp, color = motoBlack),
            singleLine = true,
            modifier = Modifier
                .fillMaxWidth()
                .height(47.dp)
                .background(inputBg, RoundedCornerShape(14.dp))
                .border(1.dp, lineCol, RoundedCornerShape(14.dp)),
            decorationBox = { innerTextField ->
                Row(
                    modifier = Modifier.fillMaxSize().padding(horizontal = 14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(modifier = Modifier.weight(1f)) {
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
                    }
                }
            }
        )
    }
}"""
reg_code = reg_code.replace(field_old, field_new)

with open('app/src/main/java/com/example/motolock/RegistrationScreens.kt', 'w', encoding='utf-8') as f:
    f.write(reg_code)

