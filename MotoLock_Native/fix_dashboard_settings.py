import sys

file_path = r'C:\Users\OEM\Downloads\MotoLock_Native\app\src\main\java\com\example\motolock\DashboardScreen.kt'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the Settings Box using a simple string replace
settings_box_1 = '''                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .background(Color.White.copy(alpha = 0.88f), RoundedCornerShape(14.dp))
                        .border(1.dp, lineCol, RoundedCornerShape(14.dp))
                        .shadow(18.dp, RoundedCornerShape(14.dp), spotColor = Color(0xFF0F172A).copy(alpha = 0.05f))
                        .clickable { onSettingsClick() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        Icons.Default.Settings,
                        contentDescription = "Settings",
                        modifier = Modifier.size(20.dp),
                        tint = motoBlack
                    )
                }'''
settings_box_2 = settings_box_1.replace('\n', '\r\n')

if settings_box_1 in content:
    content = content.replace(settings_box_1, '                Spacer(modifier = Modifier.size(36.dp))')
elif settings_box_2 in content:
    content = content.replace(settings_box_2, '                Spacer(modifier = Modifier.size(36.dp))')
else:
    print('Could not find Settings Box!')

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print('Settings Box removal complete.')