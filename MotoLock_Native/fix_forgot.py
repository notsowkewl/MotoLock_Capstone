with open('app/src/main/java/com/example/motolock/ForgotPasswordScreen.kt', 'r', encoding='utf-8') as f:
    code = f.read()
code = code.replace(r'Toast.makeText(context, "Failed to send link: \", Toast.LENGTH_LONG).show()', r'Toast.makeText(context, "Failed to send link: ${e.message}", Toast.LENGTH_LONG).show()')
with open('app/src/main/java/com/example/motolock/ForgotPasswordScreen.kt', 'w', encoding='utf-8') as f:
    f.write(code)
