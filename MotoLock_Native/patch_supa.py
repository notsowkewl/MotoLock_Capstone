# coding=utf-8
import os

supabase_path = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/data/SupabaseManager.kt'
with open(supabase_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("io.github.jan.supabase.gotrue.GoTrue", "io.github.jan.supabase.gotrue.Auth")
content = content.replace("io.github.jan.supabase.gotrue.gotrue", "io.github.jan.supabase.gotrue.auth")
content = content.replace("install(GoTrue)", "install(Auth)")
content = content.replace("client.gotrue", "client.auth")

with open(supabase_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("SupabaseManager updated with Auth")
