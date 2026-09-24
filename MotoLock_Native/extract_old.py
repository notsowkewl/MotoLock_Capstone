import json

transcript_path = r"C:\Users\OEM\.gemini\antigravity-ide\brain\1869fd97-6c53-4b2f-9a0e-2730bb415093\.system_generated\logs\transcript_full.jsonl"

auth_versions = []
helmet_versions = []
identity_versions = []

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            content = ""
            if "content" in data:
                content = data["content"]
            elif "tool_calls" in data:
                for tc in data["tool_calls"]:
                    if "args" in tc:
                        content += str(tc["args"])
            
            if "AuthScreens.kt" in content and "class" in content:
                auth_versions.append(content)
            if "VerifyHelmetScreen" in content and "class" in content:
                helmet_versions.append(content)
            if "VerifyIdentityScreen" in content and "class" in content:
                identity_versions.append(content)
        except:
            pass

print(f"Found {len(auth_versions)} AuthScreens, {len(helmet_versions)} Helmet, {len(identity_versions)} Identity")

if helmet_versions:
    with open('helmet_oldest.txt', 'w', encoding='utf-8') as f:
        f.write(helmet_versions[0])
if identity_versions:
    with open('identity_oldest.txt', 'w', encoding='utf-8') as f:
        f.write(identity_versions[0])
if auth_versions:
    with open('auth_oldest.txt', 'w', encoding='utf-8') as f:
        f.write(auth_versions[0])
