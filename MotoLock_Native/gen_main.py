# coding=utf-8
import os

main_kt = """package com.example.motolock

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.motolock.screens.*
import com.example.motolock.ui.theme.MotoLockTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MotoLockTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()
                    
                    NavHost(navController = navController, startDestination = "login") {
                        // Auth & Security
                        composable("login") { LoginScreen(onNavigate = { navController.navigate(it) }) }
                        
                        // Dashboard
                        composable("dashboard") { 
                            DashboardScreen(
                                onNavigate = { navController.navigate(it) },
                                onAction = { action -> 
                                    if (action == "start_ride") navController.navigate("verifyIdentity") 
                                }
                            ) 
                        }
                        
                        // Pre-Ride Safety Sequence
                        composable("verifyIdentity") { 
                            VerifyIdentityScreen(
                                onBack = { navController.popBackStack() },
                                onNavigate = { navController.navigate(it) }
                            ) 
                        }
                        composable("verifyHelmet") { 
                            VerifyHelmetScreen(
                                onBack = { navController.popBackStack() },
                                onNavigate = { navController.navigate(it) }
                            ) 
                        }
                        composable("sobrietyTest") { 
                            SobrietyTestScreen(
                                onBack = { navController.popBackStack() },
                                onNavigate = { navController.navigate(it) }
                            ) 
                        }
                        composable("safetySuccess") { 
                            SafetySuccessScreen(onFinish = { navController.navigate("dashboard") }) 
                        }
                        
                        // Settings & Profile
                        composable("settings") { 
                            SettingsScreen(
                                onBack = { navController.popBackStack() },
                                onNavigate = { navController.navigate(it) }
                            ) 
                        }
                        composable("riderProfile") { 
                            RiderProfileScreen(
                                onBack = { navController.popBackStack() },
                                onNavigate = { navController.navigate(it) }
                            ) 
                        }
                        composable("motorcycleConfig") { 
                            MotorcycleConfigScreen(
                                onBack = { navController.popBackStack() },
                                onNavigate = { navController.navigate(it) }
                            ) 
                        }
                        composable("emergencyContacts") { 
                            EmergencyContactsScreen(
                                onBack = { navController.popBackStack() },
                                onNavigate = { navController.navigate(it) }
                            ) 
                        }
                        
                        // Catch-all for unimplemented screens
                        composable("createAccount") { LoginScreen(onNavigate = { navController.navigate(it) }) }
                    }
                }
            }
        }
    }
}
"""

with open('C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/MainActivity.kt', 'w', encoding='utf-8') as f:
    f.write(main_kt)
print("MainActivity updated with NavHost")
