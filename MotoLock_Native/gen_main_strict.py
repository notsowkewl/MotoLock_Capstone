# coding=utf-8
import os

main_kt = """package com.example.motolock

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.motolock.data.MotoLockDataStore
import com.example.motolock.data.SupabaseManager
import com.example.motolock.screens.*
import com.example.motolock.ui.theme.MotoLockTheme
import kotlinx.coroutines.delay

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
                    
                    NavHost(navController = navController, startDestination = "splash") {
                        
                        // Boot Routing Logic
                        composable("splash") {
                            val context = LocalContext.current
                            val dataStore = remember { MotoLockDataStore(context) }
                            val savedPin by dataStore.securityPinFlow.collectAsState(initial = null)
                            val isLoggedIn by SupabaseManager.isLoggedIn.collectAsState()

                            LaunchedEffect(savedPin) {
                                delay(500) // Brief loading
                                if (savedPin != null && savedPin != "") {
                                    // Returning User
                                    navController.navigate("enterPin") {
                                        popUpTo("splash") { inclusive = true }
                                    }
                                } else {
                                    // Guest / New / Existing Logged Out
                                    navController.navigate("login") {
                                        popUpTo("splash") { inclusive = true }
                                    }
                                }
                            }
                            
                            Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator()
                            }
                        }

                        // Auth & Security
                        composable("login") { LoginScreen(onNavigate = { navController.navigate(it) }) }
                        composable("createAccount") { CreateAccountScreen(onNavigate = { navController.navigate(it) }) }
                        composable("verifyEmail") { VerifyEmailScreen(onNavigate = { navController.navigate(it) }) }
                        composable("enterPin") { 
                            PinLoginScreen(
                                onNavigate = { navController.navigate(it) }, 
                                onBack = { navController.popBackStack() }
                            ) 
                        }
                        
                        // New User Onboarding sequential flow (registerFaceId -> emergencyContacts -> motorcycleConfig -> setupPin -> dashboard)
                        composable("registerFaceId") { 
                            VerifyIdentityScreen(
                                onBack = { navController.popBackStack() },
                                onNavigate = { navController.navigate("emergencyContacts") } // Custom routing for New User
                            ) 
                        }
                        composable("setupPin") { 
                            CreatePinScreen(
                                onNavigate = { navController.navigate("dashboard") },
                                onBack = { navController.popBackStack() }
                            ) 
                        }
                        
                        // Dashboard
                        composable("dashboard") { 
                            DashboardScreen(
                                onNavigate = { navController.navigate(it) },
                                onAction = { action -> 
                                    if (action == "start_ride") navController.navigate("verifyIdentity") 
                                }
                            ) 
                        }
                        
                        // Pre-Ride Safety Sequence (From Dashboard Unlock)
                        composable("verifyIdentity") { 
                            VerifyIdentityScreen(
                                onBack = { navController.popBackStack() },
                                onNavigate = { navController.navigate("verifyHelmet") }
                            ) 
                        }
                        composable("verifyHelmet") { 
                            VerifyHelmetScreen(
                                onBack = { navController.popBackStack() },
                                onNavigate = { navController.navigate(it) } // Goes to sobrietyTest
                            ) 
                        }
                        composable("sobrietyTest") { 
                            SobrietyTestScreen(
                                onBack = { navController.popBackStack() },
                                onNavigate = { navController.navigate(it) }
                            ) 
                        }
                        composable("safetySuccess") { 
                            SafetySuccessScreen(onFinish = { navController.navigate("dashboard") {
                                popUpTo("dashboard") { inclusive = true }
                            } }) 
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
                                onNavigate = { 
                                    // Dynamic routing based on if they are in onboarding or settings
                                    if (navController.previousBackStackEntry?.destination?.route == "emergencyContacts") {
                                        navController.navigate("setupPin")
                                    } else {
                                        navController.navigate(it)
                                    }
                                }
                            ) 
                        }
                        composable("emergencyContacts") { 
                            EmergencyContactsScreen(
                                onBack = { navController.popBackStack() },
                                onNavigate = { 
                                    if (navController.previousBackStackEntry?.destination?.route == "registerFaceId") {
                                        navController.navigate("motorcycleConfig")
                                    } else {
                                        navController.navigate(it)
                                    }
                                }
                            ) 
                        }
                    }
                }
            }
        }
    }
}
"""

with open('C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/MainActivity.kt', 'w', encoding='utf-8') as f:
    f.write(main_kt)
print("MainActivity updated with strict flow routing logic")
