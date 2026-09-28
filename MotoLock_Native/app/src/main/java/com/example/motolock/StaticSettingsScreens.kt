package com.example.motolock

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Air
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.History
import androidx.compose.material.icons.filled.NoCrash
import androidx.compose.material.icons.filled.PrivacyTip
import androidx.compose.material.icons.filled.Security
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material.icons.filled.TwoWheeler
import androidx.compose.material.icons.filled.VerifiedUser
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun SimpleInfoCard(title: String, desc: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 12.dp)
            .shadow(16.dp, RoundedCornerShape(16.dp), spotColor = Color(0xFF0F172A).copy(alpha = 0.03f))
            .background(Color.White, RoundedCornerShape(16.dp))
            .border(1.dp, Color(0xFFF0F2F5), RoundedCornerShape(16.dp))
            .padding(20.dp)
    ) {
        Text(title, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color(0xFF101217))
        Spacer(modifier = Modifier.height(6.dp))
        Text(desc, fontSize = 13.sp, color = Color(0xFF737987), lineHeight = 19.sp)
    }
}

@Composable
fun IconInfoCard(title: String, desc: String, icon: ImageVector) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(bottom = 12.dp)
            .shadow(16.dp, RoundedCornerShape(16.dp), spotColor = Color(0xFF0F172A).copy(alpha = 0.03f))
            .background(Color.White, RoundedCornerShape(16.dp))
            .border(1.dp, Color(0xFFF0F2F5), RoundedCornerShape(16.dp))
            .padding(20.dp),
        verticalAlignment = Alignment.Top
    ) {
        Box(
            modifier = Modifier.size(36.dp).background(Color(0xFFFFEDEE), RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center
        ) {
            Icon(icon, contentDescription = null, tint = Color(0xFFED1C24), modifier = Modifier.size(18.dp))
        }
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 15.sp, fontWeight = FontWeight.Bold, color = Color(0xFF101217))
            Spacer(modifier = Modifier.height(4.dp))
            Text(desc, fontSize = 13.sp, color = Color(0xFF737987), lineHeight = 19.sp)
        }
    }
}

@Composable
fun PrivacyPolicyScreen(onBack: () -> Unit) {
    val motoBlack = Color(0xFF101217)
    val textGray = Color(0xFF737987)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F8FA))
            .padding(horizontal = 24.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Spacer(modifier = Modifier.height(48.dp))
        Box(
            modifier = Modifier
                .size(44.dp)
                .background(Color.White.copy(alpha = 0.88f), RoundedCornerShape(14.dp))
                .border(1.dp, Color(0xFFE8EBF0), RoundedCornerShape(14.dp))
                .clickable { onBack() },
            contentAlignment = Alignment.Center
        ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp), tint = motoBlack) }

        Spacer(modifier = Modifier.height(28.dp))
        
        Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .background(Color.White, CircleShape)
                    .shadow(32.dp, CircleShape, spotColor = Color(0xFFED1C24).copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.VerifiedUser, contentDescription = null, tint = Color(0xFFED1C24), modifier = Modifier.size(32.dp))
            }
            Spacer(modifier = Modifier.height(20.dp))
            Text("Privacy Policy", fontSize = 28.sp, fontWeight = FontWeight.Black, color = motoBlack, letterSpacing = (-1).sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text("Learn how MotoLock handles rider data, device information, and safety records.", fontSize = 13.sp, color = textGray, lineHeight = 20.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 20.dp))
        }

        Spacer(modifier = Modifier.height(32.dp))

        SimpleInfoCard("1. Information We Collect", "MotoLock may collect rider account details such as full name, email address, phone number, motorcycle information, emergency contacts, Face ID registration data, Bluetooth device status, and ride safety logs.")
        SimpleInfoCard("2. How We Use Your Data", "The collected information is used to verify rider identity, connect the MotoLock hardware, manage emergency contacts, monitor safety checks, and record ride history for security and accountability.")
        SimpleInfoCard("3. Face ID and Verification", "Face ID is used only for rider identity verification before unlocking your motorcycle. It helps confirm that the registered rider is the one attempting to access the motorcycle.")
        SimpleInfoCard("4. Emergency Contacts", "Emergency contact details are used only when safety alerts are triggered, such as alcohol detection, ignition lock events, or emergency notifications.")
        SimpleInfoCard("5. Ride and Safety Logs", "MotoLock stores ride history, Face ID verification results, helmet verification, BrAC readings, ignition status, and emergency alert records to support safety monitoring.")
        SimpleInfoCard("6. Data Protection", "MotoLock aims to protect user data and only uses collected information for system security, rider safety, and emergency response purposes.")

        Spacer(modifier = Modifier.height(40.dp))
    }
}

@Composable
fun TermsConditionsScreen(onBack: () -> Unit) {
    val motoBlack = Color(0xFF101217)
    val textGray = Color(0xFF737987)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F8FA))
            .padding(horizontal = 24.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Spacer(modifier = Modifier.height(48.dp))
        Box(
            modifier = Modifier
                .size(44.dp)
                .background(Color.White.copy(alpha = 0.88f), RoundedCornerShape(14.dp))
                .border(1.dp, Color(0xFFE8EBF0), RoundedCornerShape(14.dp))
                .clickable { onBack() },
            contentAlignment = Alignment.Center
        ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp), tint = motoBlack) }

        Spacer(modifier = Modifier.height(28.dp))
        
        Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .background(Color.White, CircleShape)
                    .shadow(32.dp, CircleShape, spotColor = Color(0xFFED1C24).copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(Icons.Default.History, contentDescription = null, tint = Color(0xFFED1C24), modifier = Modifier.size(32.dp))
            }
            Spacer(modifier = Modifier.height(20.dp))
            Text("Terms and Conditions", fontSize = 28.sp, fontWeight = FontWeight.Black, color = motoBlack, letterSpacing = (-1).sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text("Read the rules and safety agreement for using MotoLock.", fontSize = 13.sp, color = textGray, lineHeight = 20.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 20.dp))
        }

        Spacer(modifier = Modifier.height(32.dp))

        SimpleInfoCard("1. Rider Responsibility", "The rider is responsible for using MotoLock properly and honestly. The system is designed to support rider safety before motorcycle use.")
        SimpleInfoCard("2. Identity Verification", "The rider must complete Face ID verification before unlocking your motorcycle. MotoLock may require both no-helmet and with-helmet verification to confirm the registered rider.")
        SimpleInfoCard("3. Sobriety Test Requirement", "The rider must complete the alcohol detection test using the helmet sensor. Motorcycle ignition will only be allowed if the rider passes the sobriety check.")
        SimpleInfoCard("4. Alcohol Detection and Ignition Lock", "If alcohol is detected above the allowed limit, MotoLock will lock the ignition and prevent the rider from starting the motorcycle for safety reasons.")
        SimpleInfoCard("5. Emergency Alerts", "In safety-related situations, such as alcohol detection or ignition lock events, MotoLock may send alerts to the rider's registered emergency contacts.")
        SimpleInfoCard("6. Device and Bluetooth Connection", "The rider must ensure that the MotoLock hardware is properly connected through Bluetooth before using the system. Pairing a new device may replace the current connected hardware.")
        SimpleInfoCard("7. System Limitations", "MotoLock is a safety support system and should not replace responsible riding behavior. The rider should not attempt to bypass verification or ignition lock features.")
        SimpleInfoCard("8. Agreement", "By using MotoLock, the rider agrees to follow the system's safety process, provide accurate information, and accept the app's identity and sobriety verification requirements.")

        Spacer(modifier = Modifier.height(40.dp))
    }
}

@Composable
fun AboutAppScreen(onBack: () -> Unit) {
    val motoBlack = Color(0xFF101217)
    val textGray = Color(0xFF737987)

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F8FA))
            .padding(horizontal = 24.dp)
            .verticalScroll(rememberScrollState())
    ) {
        Spacer(modifier = Modifier.height(48.dp))
        Box(
            modifier = Modifier
                .size(44.dp)
                .background(Color.White.copy(alpha = 0.88f), RoundedCornerShape(14.dp))
                .border(1.dp, Color(0xFFE8EBF0), RoundedCornerShape(14.dp))
                .clickable { onBack() },
            contentAlignment = Alignment.Center
        ) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back", modifier = Modifier.size(20.dp), tint = motoBlack) }

        Spacer(modifier = Modifier.height(28.dp))
        
        Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .background(Color.White, RoundedCornerShape(20.dp))
                    .shadow(32.dp, RoundedCornerShape(20.dp), spotColor = Color(0xFFED1C24).copy(alpha = 0.2f)),
                contentAlignment = Alignment.Center
            ) {
                Image(
                    painter = painterResource(id = R.drawable.logo),
                    contentDescription = "MotoLock logo",
                    modifier = Modifier.size(60.dp)
                )
            }
            Spacer(modifier = Modifier.height(20.dp))
            Text("About MotoLock", fontSize = 28.sp, fontWeight = FontWeight.Black, color = motoBlack, letterSpacing = (-1).sp)
            Spacer(modifier = Modifier.height(8.dp))
            Text("A smart motorcycle safety system for rider verification and alcohol detection.", fontSize = 13.sp, color = textGray, lineHeight = 20.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(horizontal = 20.dp))
        }

        Spacer(modifier = Modifier.height(32.dp))

        IconInfoCard("App Version", "Version 1.0.0", Icons.Default.Settings)
        IconInfoCard("System Purpose", "MotoLock is designed to help prevent unsafe motorcycle use by requiring rider identity verification and sobriety checking before ignition access.", Icons.Default.Shield)
        IconInfoCard("Identity Verification", "The system uses registered Face ID, no-helmet verification, and with-helmet verification to confirm that the registered rider is using the motorcycle.", Icons.Default.CameraAlt)
        IconInfoCard("Alcohol Detection", "MotoLock uses a helmet-based MQ-3 alcohol sensor to check the rider's BrAC reading before allowing ignition access.", Icons.Default.Air)
        IconInfoCard("Hardware Connection", "The app connects to the MotoLock hardware through Bluetooth to manage device status, rider verification, and ignition lock control.", Icons.Default.Bluetooth)
        IconInfoCard("Project Info", "MotoLock is a capstone project focused on motorcycle safety, rider identity verification, alcohol detection, and emergency contact notification.", Icons.Default.TwoWheeler)

        Spacer(modifier = Modifier.height(40.dp))
    }
}
