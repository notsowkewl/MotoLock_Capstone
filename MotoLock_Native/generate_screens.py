import re
import os

html = open('C:/Users/OEM/Downloads/MotoLock_Capstone/index.html', encoding='utf-8').read()
screens = set(re.findall(r'go\([\'"]([a-zA-Z0-9_-]+)[\'"]\)', html))

output_dir = 'C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/screens'
os.makedirs(output_dir, exist_ok=True)

nav_entries = []

for screen in screens:
    # Capitalize first letter for Compose function
    compose_name = screen[0].upper() + screen[1:] + "Screen"
    
    kt_code = f"""package com.example.motolock.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.example.motolock.ui.components.MotoTopBar

@Composable
fun {compose_name}(onBack: () -> Unit, onNavigate: (String) -> Unit) {{
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Brush.linearGradient(listOf(Color(0xFFF8FAFC), Color(0xFFE9EDF5))))
            .padding(24.dp)
    ) {{
        MotoTopBar(title = "{screen}", onBack = onBack)
        Spacer(modifier = Modifier.height(20.dp))
        Text("This screen was auto-generated to match the prototype.")
    }}
}}
"""
    with open(f"{output_dir}/{compose_name}.kt", "w") as f:
        f.write(kt_code)
        
    nav_entries.append(f'        composable("{screen}") {{\n            {compose_name}(\n                onBack = {{ navController.popBackStack() }},\n                onNavigate = {{ dest -> navController.navigate(dest) }}\n            )\n        }}')

print("Generated", len(screens), "screens in", output_dir)

# Now print the NavHost block to insert into MainActivity
print("\n--- NAV HOST ENTRIES ---")
print("\n".join(nav_entries))
