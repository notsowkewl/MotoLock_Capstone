# coding=utf-8
import os
import re

files = [
    'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens/VerifyIdentityScreen.kt',
    'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens/VerifyHelmetScreen.kt'
]

effect_kt = """package com.example.motolock.ui.components

import android.app.Activity
import android.view.WindowManager
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.ui.platform.LocalContext

@Composable
fun MaxBrightnessEffect() {
    val context = LocalContext.current
    DisposableEffect(Unit) {
        val activity = context as? Activity
        val window = activity?.window
        val originalBrightness = window?.attributes?.screenBrightness
        
        if (window != null) {
            val layoutParams = window.attributes
            layoutParams.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL
            window.attributes = layoutParams
        }
        
        onDispose {
            if (window != null && originalBrightness != null) {
                val layoutParams = window.attributes
                layoutParams.screenBrightness = originalBrightness
                window.attributes = layoutParams
            }
        }
    }
}
"""

with open('C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/ui/components/MaxBrightnessEffect.kt', 'w', encoding='utf-8') as f:
    f.write(effect_kt)

for file_path in files:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Remove the injected function from the bottom
        content = re.sub(r'@Composable\s*\nfun MaxBrightnessEffect\(\).*?\}\n\}\n', '', content, flags=re.DOTALL)
        
        # Change LocalLifecycleOwner import
        content = content.replace("import androidx.compose.ui.platform.LocalLifecycleOwner", "import androidx.lifecycle.compose.LocalLifecycleOwner")
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

print("Fixed overloads and LocalLifecycleOwner")
