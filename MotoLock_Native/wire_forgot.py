# coding=utf-8
import os

# --- LoginScreen.kt ---
with open('app/src/main/java/com/example/motolock/LoginScreen.kt', 'r', encoding='utf-8') as f:
    login_code = f.read()

# signature
login_code = login_code.replace(
    'fun LoginScreen(onLoginSuccess: () -> Unit, onSignUpClick: () -> Unit)',
    'fun LoginScreen(onLoginSuccess: () -> Unit, onSignUpClick: () -> Unit, onForgotClick: () -> Unit)'
)

# click handler
forgot_old = """                    Text(
                        "Forgot Password?", 
                        fontSize = 11.sp, 
                        fontWeight = FontWeight.Black, 
                        color = motoRed,
                        modifier = Modifier.clickable { 
                            Toast.makeText(context, "Forgot Password Clicked", Toast.LENGTH_SHORT).show() 
                        }
                    )"""
forgot_new = """                    Text(
                        "Forgot Password?", 
                        fontSize = 11.sp, 
                        fontWeight = FontWeight.Black, 
                        color = motoRed,
                        modifier = Modifier.clickable { onForgotClick() }
                    )"""
login_code = login_code.replace(forgot_old, forgot_new)

with open('app/src/main/java/com/example/motolock/LoginScreen.kt', 'w', encoding='utf-8') as f:
    f.write(login_code)


# --- MainActivity.kt ---
with open('app/src/main/java/com/example/motolock/MainActivity.kt', 'r', encoding='utf-8') as f:
    main_code = f.read()

nav_old = """composable("login") {
                    LoginScreen(onLoginSuccess = { navController.navigate("dashboard") { popUpTo("login") { inclusive = true } } }, onSignUpClick = { navController.navigate("create_account") })
                }"""
nav_new = """composable("login") {
                    LoginScreen(
                        onLoginSuccess = { navController.navigate("dashboard") { popUpTo("login") { inclusive = true } } }, 
                        onSignUpClick = { navController.navigate("create_account") },
                        onForgotClick = { navController.navigate("forgot_password") }
                    )
                }
                
                composable("forgot_password") {
                    ForgotPasswordScreen(onBack = { navController.popBackStack() })
                }"""
main_code = main_code.replace(nav_old, nav_new)

with open('app/src/main/java/com/example/motolock/MainActivity.kt', 'w', encoding='utf-8') as f:
    f.write(main_code)
