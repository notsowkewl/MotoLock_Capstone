import os

with open('app/src/main/java/com/example/motolock/RegistrationScreens.kt', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    if "MotoLock ensures your motorcycle is securely locked and accessible only to you through Face ID and Helmet verification." in line:
        continue
    if "Data is securely stored in our cloud infrastructure. By continuing, you agree to these terms.\"," in line:
        new_lines.append('                            "MotoLock ensures your motorcycle is securely locked and accessible only to you through Face ID and Helmet verification.\\n\\nData is securely stored in our cloud infrastructure. By continuing, you agree to these terms.",\n')
    else:
        new_lines.append(line)

with open('app/src/main/java/com/example/motolock/RegistrationScreens.kt', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
