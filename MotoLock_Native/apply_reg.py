# coding=utf-8
import os

with open('app/src/main/java/com/example/motolock/RegistrationScreens.kt', 'r', encoding='utf-8') as f:
    reg_code = f.read()

# 1. Remove Phone number
phone_field = """        CustomTextField("Email", "Enter email", email, KeyboardType.Email) { email = it }
        Spacer(modifier = Modifier.height(13.dp))
        CustomTextField("Phone Number", "Enter phone number", phone, KeyboardType.Phone) { phone = it }
        Spacer(modifier = Modifier.height(13.dp))"""
phone_field_new = """        CustomTextField("Email", "Enter email", email, KeyboardType.Email) { email = it }
        Spacer(modifier = Modifier.height(13.dp))"""
reg_code = reg_code.replace(phone_field, phone_field_new)

# Remove 'var phone' state
reg_code = reg_code.replace('var phone by remember { mutableStateOf("") }\n', '')

# Remove phone validation
phone_val = """                if (fullName.isBlank() || email.isBlank() || password.isBlank()) {"""
# it didn't check phone anyway! Wait, the original code had:
# if (fullName.isBlank() || email.isBlank() || password.isBlank())
# So no changes needed for validation.

# 2. Update Terms & Privacy Modal
terms_old = """                            "MotoLock ensures your motorcycle is securely locked and accessible only to you through Face ID and Helmet verification.\\n\\nData is securely stored in our cloud infrastructure. By continuing, you agree to these terms.",
                            fontSize = 13.sp, color = textGray, lineHeight = 20.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Center"""

terms_new = """                            "1. Rider Responsibility\\nThe rider is responsible for using MotoLock properly and honestly. The system is designed to support rider safety before motorcycle use.\\n\\n" +
                            "2. Identity Verification\\nThe rider must complete Face ID verification before unlocking your motorcycle. MotoLock may require both no-helmet and with-helmet verification to confirm the registered rider.\\n\\n" +
                            "3. Sobriety Test Requirement\\nThe rider must complete the alcohol detection test using the helmet sensor. Motorcycle ignition will only be allowed if the rider passes the sobriety check.\\n\\n" +
                            "4. Alcohol Detection and Ignition Lock\\nIf alcohol is detected above the allowed limit, MotoLock will lock the ignition and prevent the rider from starting the motorcycle for safety reasons.\\n\\n" +
                            "5. Emergency Alerts\\nIn safety-related situations, such as alcohol detection or ignition lock events, MotoLock may send alerts to the rider's registered emergency contacts.\\n\\n" +
                            "6. Device and Bluetooth Connection\\nThe rider must ensure that the MotoLock hardware is properly connected through Bluetooth before using the system. Pairing a new device may replace the current connected hardware.\\n\\n" +
                            "7. System Limitations\\nMotoLock is a safety support system and should not replace responsible riding behavior. The rider should not attempt to bypass verification or ignition lock features.\\n\\n" +
                            "8. Agreement\\nBy using MotoLock, the rider agrees to follow the system's safety process, provide accurate information, and accept the app's identity and sobriety verification requirements.",
                            fontSize = 11.sp, color = textGray, lineHeight = 16.sp, textAlign = androidx.compose.ui.text.style.TextAlign.Start,
                            modifier = Modifier.fillMaxHeight(0.6f).verticalScroll(rememberScrollState())"""

reg_code = reg_code.replace(terms_old, terms_new)

with open('app/src/main/java/com/example/motolock/RegistrationScreens.kt', 'w', encoding='utf-8') as f:
    f.write(reg_code)

