# coding=utf-8
with open('app/src/main/java/com/example/motolock/CameraScreen.kt', 'r', encoding='utf-8') as f:
    code = f.read()

# Make the camera viewport circular
box_old = """            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
                    .shadow(32.dp, RoundedCornerShape(24.dp), spotColor = if (isUnlocked) motoGreen.copy(alpha = 0.4f) else motoRed.copy(alpha = 0.2f))
                    .clip(RoundedCornerShape(24.dp))
                    .border(2.dp, if (isUnlocked) motoGreen else lineCol, RoundedCornerShape(24.dp))
            ) {"""
box_new = """            Box(modifier = Modifier.fillMaxWidth().weight(1f), contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier
                        .size(300.dp)
                        .shadow(32.dp, androidx.compose.foundation.shape.CircleShape, spotColor = if (isUnlocked) motoGreen.copy(alpha = 0.4f) else motoRed.copy(alpha = 0.2f))
                        .clip(androidx.compose.foundation.shape.CircleShape)
                        .border(4.dp, if (isUnlocked) motoGreen else motoRed, androidx.compose.foundation.shape.CircleShape)
                ) {"""
code = code.replace(box_old, box_new)

# Add text overlays
view_old = """                    },
                    modifier = Modifier.fillMaxSize()
                )
            }"""
view_new = """                    },
                    modifier = Modifier.fillMaxSize()
                )
            }
            Spacer(modifier = Modifier.height(20.dp))
            Text("Position your face", fontSize = 22.sp, fontWeight = FontWeight.Black, color = motoBlack, modifier = Modifier.align(Alignment.CenterHorizontally))
            Spacer(modifier = Modifier.height(8.dp))
            Text("No rider detected", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = motoRed, modifier = Modifier.align(Alignment.CenterHorizontally))
            }"""
code = code.replace(view_old, view_new)

with open('app/src/main/java/com/example/motolock/CameraScreen.kt', 'w', encoding='utf-8') as f:
    f.write(code)
