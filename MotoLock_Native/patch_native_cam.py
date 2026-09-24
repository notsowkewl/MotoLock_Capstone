import os

cam_path = r"C:\Users\OEM\Downloads\MotoLock_Native\app\src\main\java\com\example\motolock\CameraScreen.kt"
with open(cam_path, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Rename AI Verification to Face Registration
code = code.replace('"AI Verification"', '"Face Registration"')

# 2. Re-layout the instruction and add CircularProgressIndicator
# Let's find the Box holding the camera
old_layout = """        if (hasCameraPermission) {
            Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier
                        .size(300.dp)
                        .shadow(32.dp, androidx.compose.foundation.shape.CircleShape, spotColor = if (isUnlocked) motoGreen.copy(alpha = 0.4f) else motoRed.copy(alpha = 0.2f))
                        .clip(androidx.compose.foundation.shape.CircleShape)
                        .border(4.dp, if (isUnlocked) motoGreen else motoRed, androidx.compose.foundation.shape.CircleShape)
                ) {"""

new_layout = """        if (hasCameraPermission) {
            Column(modifier = Modifier.fillMaxWidth().weight(1f), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Text("Position your face", fontSize = 22.sp, fontWeight = FontWeight.Black, color = motoBlack)
                Spacer(modifier = Modifier.height(24.dp))
                Box(
                    modifier = Modifier
                        .size(300.dp)
                        .shadow(32.dp, androidx.compose.foundation.shape.CircleShape, spotColor = if (isUnlocked) motoGreen.copy(alpha = 0.4f) else motoRed.copy(alpha = 0.2f))
                        .clip(androidx.compose.foundation.shape.CircleShape)
                        .border(4.dp, if (isUnlocked) motoGreen else motoRed, androidx.compose.foundation.shape.CircleShape)
                ) {
                    if (scanStatus == "Processing...") {
                        androidx.compose.material3.CircularProgressIndicator(
                            modifier = Modifier.fillMaxSize(),
                            color = motoRed,
                            strokeWidth = 6.dp
                        )
                    } else if (isUnlocked) {
                        androidx.compose.material3.CircularProgressIndicator(
                            progress = 1f,
                            modifier = Modifier.fillMaxSize(),
                            color = motoGreen,
                            strokeWidth = 6.dp
                        )
                    }"""

code = code.replace(old_layout, new_layout)

# Remove the old text below
old_text_below = """            Column(modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Position your face", fontSize = 22.sp, fontWeight = FontWeight.Black, color = motoBlack)
                Spacer(modifier = Modifier.height(8.dp))
                Text("No rider detected", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = motoRed)
            }
            }"""

new_text_below = """            }"""

code = code.replace(old_text_below, new_text_below)

with open(cam_path, "w", encoding="utf-8") as f:
    f.write(code)

print("CameraScreen updated.")
