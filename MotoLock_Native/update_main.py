# coding=utf-8
with open('app/src/main/java/com/example/motolock/MainActivity.kt', 'r', encoding='utf-8') as f:
    main_code = f.read()

nav_old = 'LoginScreen(onLoginSuccess = { navController.navigate("dashboard") { popUpTo("login") { inclusive = true } } }, onSignUpClick = { navController.navigate("create_account") })'
nav_new = 'LoginScreen(onLoginSuccess = { navController.navigate("dashboard") { popUpTo("login") { inclusive = true } } }, onSignUpClick = { navController.navigate("create_account") }, onForgotClick = { navController.navigate("forgot_password") })'
main_code = main_code.replace(nav_old, nav_new)

# Add composable block if not exists
if 'composable("forgot_password")' not in main_code:
    composable_old = """        composable("create_account") {"""
    composable_new = """        composable("forgot_password") {
            ForgotPasswordScreen(onBack = { navController.popBackStack() })
        }
        composable("create_account") {"""
    main_code = main_code.replace(composable_old, composable_new)

with open('app/src/main/java/com/example/motolock/MainActivity.kt', 'w', encoding='utf-8') as f:
    f.write(main_code)
