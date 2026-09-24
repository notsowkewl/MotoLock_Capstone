import sys

file_path = r'C:\Users\OEM\Downloads\MotoLock_Native\app\src\main\java\com\example\motolock\DashboardScreen.kt'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace the LaunchedEffect finally block
old_effect_1 = '''        } finally {
            isLoading = false
            if (!isSetupComplete) showSetupModal = true
        }'''
old_effect_2 = old_effect_1.replace('\n', '\r\n')
new_effect = '''        } finally {
            isLoading = false
            if (!isSetupComplete && SessionState.isFirstDashboardLoad) {
                showSetupModal = true
                SessionState.isFirstDashboardLoad = false
            }
        }'''

if old_effect_1 in content:
    content = content.replace(old_effect_1, new_effect)
elif old_effect_2 in content:
    content = content.replace(old_effect_2, new_effect)

# 2. Replace the Settings Box
import re
box_pattern = r'Box\(\s*modifier = Modifier\s*\.size\(36\.dp\)\s*\.background[^)]*\)\s*\.border[^)]*\)\s*\.shadow[^)]*\)\s*\.clickable \{ onSettingsClick\(\) \},\s*contentAlignment = Alignment\.Center\s*\)\s*\{\s*Icon\(\s*Icons\.Default\.Settings,\s*contentDescription = "Settings",\s*modifier = Modifier\.size\(20\.dp\),\s*tint = motoBlack\s*\)\s*\}'

content = re.sub(box_pattern, 'Spacer(modifier = Modifier.size(36.dp))', content)

with open(file_path, 'w', encoding='utf-8', newline='') as f:
    f.write(content)

print('Replacement complete.')