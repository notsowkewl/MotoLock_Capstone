# coding=utf-8
import os

supabase_path = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/data/SupabaseManager.kt'
with open(supabase_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix loginWith to signInWith
content = content.replace("client.auth.loginWith", "client.auth.signInWith")
# Fix logout to signOut
content = content.replace("client.auth.logout()", "client.auth.signOut()")

with open(supabase_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("SupabaseManager updated with correct v2+ Auth syntax")
