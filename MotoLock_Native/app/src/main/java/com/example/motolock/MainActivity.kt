package com.example.motolock

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.example.motolock.ui.theme.MotoLockTheme
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MotoLockTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    MotoLockApp()
                }
            }
        }
    }
}

@Composable
fun MotoLockApp() {
    val navController = rememberNavController()
    val startDest = if (SupabaseClientManager.client.auth.currentSessionOrNull() != null) "dashboard" else "login"

    NavHost(navController = navController, startDestination = startDest) {

        composable("login") {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate("dashboard") { popUpTo("login") { inclusive = true } }
                },
                onSignUpClick = { navController.navigate("create_account") },
                onForgotClick = { navController.navigate("forgot_password") }
            )
        }

        composable("setup_router") {
            SetupRouterScreen(navController = navController)
        }

        composable("forgot_password") {
            ForgotPasswordScreen(onBack = { navController.popBackStack() })
        }

        composable("create_account") {
            CreateAccountScreen(
                onBack = { navController.popBackStack() },
                onNext = { navController.navigate("setup_router") { popUpTo(0) } }
            )
        }

        composable("motorcycle_config") {
            MotorcycleConfigScreen(
                onNext = { navController.navigate("setup_router") { popUpTo(0) } },
                onBack = { navController.popBackStack() }
            )
        }

        composable("esp32_pairing") {
            ESP32PairingScreen(
                onComplete = { navController.navigate("setup_router") { popUpTo(0) } },
                onBack = { navController.popBackStack() }
            )
        }

        composable("pin_setup") {
            PinSetupScreen(
                onBack = { navController.popBackStack() },
                onComplete = { navController.navigate("setup_router") { popUpTo(0) } }
            )
        }

        composable("dashboard") {
            DashboardScreen(
                onSettingsClick = { navController.navigate("settings") },
                onStartUnlock = { navController.navigate("unlock_flow") },
                onStartSetup = { dest -> 
                    if (dest == "pairing_needed") {
                        navController.navigate("unlock_pairing")
                    } else {
                        navController.navigate("setup_router") { popUpTo(0) }
                    }
                },
                onHistoryClick = { navController.navigate("ride_history") }
            )
        }
        
        
        composable("unlock_pairing") {
            ESP32PairingScreen(
                onComplete = { navController.navigate("unlock_flow") { popUpTo("unlock_pairing") { inclusive = true } } },
                onBack = { navController.popBackStack() }
            )
        }
        
        composable("unlock_flow") {
            UnlockScreen(
                onComplete = { navController.navigate("dashboard") { popUpTo("dashboard") { inclusive = true } } },
                onBack = { navController.popBackStack() },
                onPairDevice = { navController.navigate("unlock_pairing") }
            )
        }

        composable("ride_history") {
            RideHistoryScreen(onBack = { navController.popBackStack() })
        }

        composable("camera") {
            CameraScreen(
                onBack = { navController.popBackStack() },
                onRegistrationSuccess = {
                    navController.navigate("setup_router") { popUpTo(0) }
                }
            )
        }

        composable("settings") {
            SettingsScreen(
                onNavigateToContacts = { navController.navigate("contacts") },
                onNavigateToMotorcycle = { navController.navigate("motorcycle_config") },
                onLogout = { navController.navigate("login") { popUpTo(0) } },
                onBack = { navController.popBackStack() }
            )
        }

        composable("contacts") {
            EmergencyContactsScreen(onBack = { navController.navigate("setup_router") { popUpTo(0) } })
        }
    }
}