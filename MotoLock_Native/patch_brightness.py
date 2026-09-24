# coding=utf-8
import os

files = [
    'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens/VerifyIdentityScreen.kt',
    'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens/VerifyHelmetScreen.kt'
]

brightness_effect = """
@Composable
fun MaxBrightnessEffect() {
    val context = androidx.compose.ui.platform.LocalContext.current
    DisposableEffect(Unit) {
        val activity = context as? android.app.Activity
        val window = activity?.window
        val originalBrightness = window?.attributes?.screenBrightness
        
        if (window != null) {
            val layoutParams = window.attributes
            layoutParams.screenBrightness = android.view.WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL
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

for file_path in files:
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Insert MaxBrightnessEffect at the end of the file if not already present
        if "fun MaxBrightnessEffect" not in content:
            content += "\n" + brightness_effect
        
        # Inject the call inside the main composable
        if "MaxBrightnessEffect()" not in content:
            # Find the start of the Column and inject it right before
            if "Column(" in content:
                content = content.replace("Column(", "MaxBrightnessEffect()\n\n    Column(", 1)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

print("MaxBrightnessEffect injected successfully")
