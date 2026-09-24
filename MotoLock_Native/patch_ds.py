# coding=utf-8
import os

datastore_path = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/data/MotoLockDataStore.kt'
with open(datastore_path, 'r', encoding='utf-8') as f:
    content = f.read()

new_flows = """
    val securityPinFlow: Flow<String?> = context.dataStore.data.map { preferences ->
        preferences[SECURITY_PIN]
    }
"""

content = content.replace("val riderPhoneFlow:", new_flows + "\n    val riderPhoneFlow:")

with open(datastore_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("DataStore updated with securityPinFlow")
