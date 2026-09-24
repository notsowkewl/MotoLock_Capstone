# coding=utf-8
import os

supabase_path = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/data/SupabaseManager.kt'

with open(supabase_path, 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace(
    'private const val SUPABASE_URL = "https://your-project.supabase.co"',
    'private const val SUPABASE_URL = "https://bafziqymbvhrytziteuo.supabase.co"'
)
content = content.replace(
    'private const val SUPABASE_KEY = "your-anon-key"',
    'private const val SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhZnppcXltYnZocnl0eml0ZXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg0MjAzMzUsImV4cCI6MjEwMzk5NjMzNX0.F1KVSKnN_x-8O2gKlh0d8XPydlBWTcsS0GPbCS6CP_c"'
)

with open(supabase_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Supabase keys inserted")
