# coding=utf-8
with open('app/src/main/java/com/example/motolock/MainActivity.kt', 'r', encoding='utf-8') as f:
    main_code = f.read()

# Add auth import
if 'import io.github.jan.supabase.gotrue.auth' not in main_code:
    main_code = main_code.replace('import com.example.motolock.ui.theme.MotoLockTheme', 
                                  'import com.example.motolock.ui.theme.MotoLockTheme\nimport com.example.motolock.network.SupabaseClientManager\nimport io.github.jan.supabase.gotrue.auth')

# Change start destination
start_old = """    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = "login") {"""
start_new = """    val navController = rememberNavController()
    val startDest = if (SupabaseClientManager.client.auth.currentSessionOrNull() != null) "dashboard" else "login"

    NavHost(navController = navController, startDestination = startDest) {"""
main_code = main_code.replace(start_old, start_new)

# Update esp32_pairing to navigate to pin_setup
esp_old = """        composable("esp32_pairing") {
            ESP32PairingScreen(
                onComplete = { navController.navigate("dashboard") { popUpTo("login") { inclusive = true } } },
                onBack = { navController.popBackStack() }
            )
        }"""
esp_new = """        composable("esp32_pairing") {
            ESP32PairingScreen(
                onComplete = { navController.navigate("pin_setup") },
                onBack = { navController.popBackStack() }
            )
        }
        composable("pin_setup") {
            PinSetupScreen(
                onBack = { navController.popBackStack() },
                onComplete = { navController.navigate("dashboard") { popUpTo("login") { inclusive = true } } }
            )
        }"""
main_code = main_code.replace(esp_old, esp_new)

with open('app/src/main/java/com/example/motolock/MainActivity.kt', 'w', encoding='utf-8') as f:
    f.write(main_code)
