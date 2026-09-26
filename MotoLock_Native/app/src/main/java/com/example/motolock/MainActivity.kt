package com.example.motolock

import android.os.Bundle
import android.content.Intent
import android.widget.Toast
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.CancellationException
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
        handleAuthCallback(intent)
        setContent {
            MotoLockTheme {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    MotoLockApp()
                }
            }
        }
    }
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleAuthCallback(intent)
    }

    private fun handleAuthCallback(intent: Intent) {
        val uri = intent.data ?: return
        if (uri.scheme != "com.example.motolock" || uri.host != "auth-callback") return
        // Consume the callback so configuration changes cannot exchange the code twice.
        intent.data = null
        val fragmentParams = android.net.Uri.parse("https://callback.invalid/?${uri.encodedFragment.orEmpty()}")
        fun errorParam(name: String): String? =
            uri.getQueryParameter(name) ?: fragmentParams.getQueryParameter(name)
        val error = errorParam("error")
        val errorCode = errorParam("error_code")
        if (error != null || errorCode != null) {
            val description = errorParam("error_description")
                ?.replace(Regex("[\r\n\t]+"), " ")
                ?.take(500)
            android.app.AlertDialog.Builder(this)
                .setTitle("Google sign-in failed")
                .setMessage(listOfNotNull(errorCode ?: error, description).joinToString("\n\n"))
                .setPositiveButton("OK", null)
                .show()
            return
        }
        val code = uri.getQueryParameter("code")
        if (code.isNullOrBlank()) {
            Toast.makeText(this, "Google sign-in did not return a valid login code.", Toast.LENGTH_LONG).show()
            return
        }
        lifecycleScope.launch {
            try {
                SupabaseClientManager.client.auth.awaitInitialization()
                SupabaseClientManager.client.auth.exchangeCodeForSession(code)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                Toast.makeText(this@MainActivity, "Could not finish Google sign-in. Please try again.", Toast.LENGTH_LONG).show()
            }
        }
    }
}

@Composable
fun MotoLockApp() {
    val navController = rememberNavController()
    val startDest = if (SupabaseClientManager.client.auth.currentSessionOrNull() != null) "pin_unlock" else "login"

    NavHost(navController = navController, startDestination = startDest) {

        composable("pin_unlock") {
            PinUnlockScreen(
                onUnlockSuccess = {
                    navController.navigate("dashboard") { popUpTo("pin_unlock") { inclusive = true } }
                },
                onLogout = {
                    navController.navigate("login") { popUpTo(0) }
                }
            )
        }

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
