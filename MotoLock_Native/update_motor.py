# coding=utf-8
with open('app/src/main/java/com/example/motolock/MotorcycleConfigScreen.kt', 'r', encoding='utf-8') as f:
    code = f.read()

# Add image
img_old = """        Spacer(modifier = Modifier.height(30.dp))

        // Screen Title
        Column(modifier = Modifier.fillMaxWidth()) {"""
img_new = """        Spacer(modifier = Modifier.height(10.dp))
        Image(
            painter = androidx.compose.ui.res.painterResource(id = R.drawable.tric),
            contentDescription = "Motorcycle",
            modifier = Modifier.fillMaxWidth().height(160.dp),
            contentScale = androidx.compose.ui.layout.ContentScale.Fit
        )
        Spacer(modifier = Modifier.height(20.dp))

        // Screen Title
        Column(modifier = Modifier.fillMaxWidth()) {"""
code = code.replace(img_old, img_new)
if 'import androidx.compose.foundation.Image' not in code:
    code = code.replace('import androidx.compose.foundation.layout.*', 'import androidx.compose.foundation.layout.*\nimport androidx.compose.foundation.Image')

with open('app/src/main/java/com/example/motolock/MotorcycleConfigScreen.kt', 'w', encoding='utf-8') as f:
    f.write(code)
