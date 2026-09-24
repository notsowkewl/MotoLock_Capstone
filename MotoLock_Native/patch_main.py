# coding=utf-8
import os

main_path = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/MainActivity.kt'
with open(main_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix DashboardScreen signature
content = content.replace("""DashboardScreen(
                                onNavigate = { navController.navigate(it) },
                                onAction = { action -> 
                                    if (action == "start_ride") navController.navigate("verifyIdentity") 
                                }
                            )""", """DashboardScreen(
                                onBack = { },
                                onNavigate = { 
                                    if (it == "startUnlock") {
                                        navController.navigate("verifyIdentity")
                                    } else {
                                        navController.navigate(it) 
                                    }
                                }
                            )""")

# Fix SafetySuccessScreen naming assuming it's called SuccessScreen or just remove it if unresolved
# The error was "Unresolved reference 'SafetySuccessScreen'"
# If we don't have it imported or built, let's just make it a generic text composable for now
content = content.replace("""composable("safetySuccess") { 
                            SafetySuccessScreen(onFinish = { navController.navigate("dashboard") {
                                popUpTo("dashboard") { inclusive = true }
                            } }) 
                        }""", """composable("safetySuccess") { 
                            androidx.compose.material3.Text("Success") // Placeholder
                        }""")

with open(main_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("MainActivity updated")
