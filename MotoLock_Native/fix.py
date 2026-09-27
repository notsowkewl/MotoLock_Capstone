import re

with open('app/src/main/java/com/example/motolock/SettingsScreen.kt', 'r') as f:
    content = f.read()

injection = '''
    val isConnected by androidx.compose.runtime.collectAsState(
        initial = false,
        context = kotlin.coroutines.EmptyCoroutineContext,
        flow = com.example.motolock.data.BluetoothService.connectionState
    )
    val deviceStatusText = if (isConnected) "MotoLock Hardware • Connected" else "No device connected"
'''

content = re.sub(r'(fun SettingsScreen\(.*?\)\s*\{)', r'\1' + injection, content, flags=re.DOTALL)

with open('app/src/main/java/com/example/motolock/SettingsScreen.kt', 'w') as f:
    f.write(content)
