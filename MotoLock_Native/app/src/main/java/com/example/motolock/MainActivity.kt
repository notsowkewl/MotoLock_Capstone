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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.compose.currentBackStackEntryAsState
import com.example.motolock.ui.theme.MotoLockTheme
import com.example.motolock.network.SupabaseClientManager
import io.github.jan.supabase.gotrue.auth
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

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
    var startDest by remember { mutableStateOf<String?>(null) }
    
    val navBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route

    LaunchedEffect(Unit) {
        SupabaseClientManager.client.auth.awaitInitialization()
        startDest = if (SupabaseClientManager.client.auth.currentSessionOrNull() != null) {
            "pin_unlock"
        } else {
            "login"
        }
    }

    if (startDest == null) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = Color(0xFFED1C24))
        }
        return
    }

    val showBottomBar = currentRoute in listOf("dashboard", "ride_history", "settings")

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        containerColor = Color.Transparent,
        bottomBar = {
            if (showBottomBar) {
                NavigationBar(
                    containerColor = Color.White,
                    tonalElevation = 0.dp,
                    modifier = Modifier
                        .border(1.dp, Color(0xFFE8EBF0))
                        .height(64.dp)
                ) {
                    val motoRed = Color(0xFFED1C24)
                    val textGray = Color(0xFF737987)
                    
                    NavigationBarItem(
                        selected = currentRoute == "dashboard",
                        onClick = { navController.navigate("dashboard") { launchSingleTop = true; restoreState = true } },
                        icon = { Icon(Icons.Default.Home, "Home", modifier = Modifier.size(22.dp)) },
                        label = { Text("Home", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = motoRed, selectedTextColor = motoRed,
                            indicatorColor = Color(0xFFFFEDEE),
                            unselectedIconColor = textGray, unselectedTextColor = textGray
                        )
                    )
                    NavigationBarItem(
                        selected = currentRoute == "ride_history",
                        onClick = { navController.navigate("ride_history") { launchSingleTop = true; restoreState = true } },
                        icon = { Icon(Icons.Default.History, "Ride History", modifier = Modifier.size(22.dp)) },
                        label = { Text("History", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = motoRed, selectedTextColor = motoRed,
                            indicatorColor = Color(0xFFFFEDEE),
                            unselectedIconColor = textGray, unselectedTextColor = textGray
                        )
                    )
                    NavigationBarItem(
                        selected = currentRoute == "settings",
                        onClick = { navController.navigate("settings") { launchSingleTop = true; restoreState = true } },
                        icon = { Icon(Icons.Default.Person, "Profile", modifier = Modifier.size(22.dp)) },
                        label = { Text("Profile", fontSize = 11.sp, fontWeight = FontWeight.SemiBold) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = motoRed, selectedTextColor = motoRed,
                            indicatorColor = Color(0xFFFFEDEE),
                            unselectedIconColor = textGray, unselectedTextColor = textGray
                        )
                    )
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController, 
            startDestination = startDest!!,
            modifier = Modifier.padding(innerPadding)
        ) {
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
            
            composable("ride_history") {
                RideHistoryScreen(onBack = { navController.navigate("dashboard") { popUpTo("dashboard") { inclusive = true } } })
            }
            
                        composable("settings") {
                SettingsScreen(
                    onNavigateToContacts = { navController.navigate("contacts") },
                    onNavigateToMotorcycle = { navController.navigate("registered_motorcycles") },
                    onNavigateToProfile = { navController.navigate("rider_profile") },
                    onNavigateToChangePassword = { navController.navigate("change_password") },
                    onNavigateToPin = { navController.navigate("security_pin") },
                    onLogout = { navController.navigate("login") { popUpTo(0) } },
                    onBack = { navController.popBackStack() }
                )
            }
            composable("rider_profile") { RiderProfileScreen(onBack = { navController.popBackStack() }) }
            composable("change_password") { ChangePasswordScreen(onBack = { navController.popBackStack() }) }
            composable("security_pin") { SecurityPinScreen(onBack = { navController.popBackStack() }) }
            
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

            composable("camera") {
                CameraScreen(
                    onBack = { navController.popBackStack() },
                    onRegistrationSuccess = {
                        navController.navigate("setup_router") { popUpTo(0) }
                    }
                )
            }

            composable("contacts") {
                EmergencyContactsScreen(onBack = { navController.navigate("setup_router") { popUpTo(0) } })
            }
        }
    }
}



