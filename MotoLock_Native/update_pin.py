# coding=utf-8
with open('app/src/main/java/com/example/motolock/PinSetupScreen.kt', 'r', encoding='utf-8') as f:
    code = f.read()

# Change PIN circles to hollow circles O O O O
dots_old = """                Box(
                    modifier = Modifier
                        .size(16.dp)
                        .clip(CircleShape)
                        .background(if (isFilled) motoRed else Color(0xFFE8EBF0))
                )"""
dots_new = """                Box(
                    modifier = Modifier
                        .size(18.dp)
                        .clip(CircleShape)
                        .border(2.dp, motoBlack, CircleShape)
                        .background(if (isFilled) motoBlack else Color.Transparent)
                )"""
code = code.replace(dots_old, dots_new)

# Change keys to rounded rectangular buttons
key_old = """                        modifier = Modifier
                            .size(72.dp)
                            .clip(CircleShape)
                            .clickable(enabled = key.isNotEmpty()) {
                                if (key == "DEL") {
                                    if (pin.isNotEmpty()) pin = pin.dropLast(1)
                                } else {
                                    if (pin.length < 4) pin += key
                                }
                            },"""
key_new = """                        modifier = Modifier
                            .width(88.dp)
                            .height(64.dp)
                            .background(Color.Transparent, RoundedCornerShape(12.dp))
                            .border(1.dp, Color(0xFFE8EBF0), RoundedCornerShape(12.dp))
                            .clip(RoundedCornerShape(12.dp))
                            .clickable(enabled = key.isNotEmpty()) {
                                if (key == "DEL") {
                                    if (pin.isNotEmpty()) pin = pin.dropLast(1)
                                } else {
                                    if (pin.length < 4) pin += key
                                }
                            },"""
code = code.replace(key_old, key_new)

# Replace DEL text with an icon
del_old = """                        if (key == "DEL") {
                            Text("DEL", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.Gray)
                        }"""
del_new = """                        if (key == "DEL") {
                            Icon(androidx.compose.material.icons.Icons.AutoMirrored.Filled.Backspace, contentDescription = "Delete", modifier = Modifier.size(24.dp), tint = motoBlack)
                        }"""
code = code.replace(del_old, del_new)
if 'import androidx.compose.material.icons.automirrored.filled.Backspace' not in code:
    code = code.replace('import androidx.compose.material.icons.filled.ArrowBack', 'import androidx.compose.material.icons.filled.ArrowBack\nimport androidx.compose.material.icons.automirrored.filled.Backspace')

with open('app/src/main/java/com/example/motolock/PinSetupScreen.kt', 'w', encoding='utf-8') as f:
    f.write(code)
