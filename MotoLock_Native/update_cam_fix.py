# coding=utf-8
with open('app/src/main/java/com/example/motolock/CameraScreen.kt', 'r', encoding='utf-8') as f:
    code = f.read()

view_old = """                    },
                    modifier = Modifier.fillMaxSize()
                )
            }
            Spacer(modifier = Modifier.height(20.dp))
            Text("Position your face", fontSize = 22.sp, fontWeight = FontWeight.Black, color = motoBlack, modifier = Modifier.align(Alignment.CenterHorizontally))
            Spacer(modifier = Modifier.height(8.dp))
            Text("No rider detected", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = motoRed, modifier = Modifier.align(Alignment.CenterHorizontally))
            }"""
view_new = """                    },
                    modifier = Modifier.fillMaxSize()
                )
            }
            Column(modifier = Modifier.align(Alignment.BottomCenter).padding(bottom = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Position your face", fontSize = 22.sp, fontWeight = FontWeight.Black, color = motoBlack)
                Spacer(modifier = Modifier.height(8.dp))
                Text("No rider detected", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = motoRed)
            }
            }"""
code = code.replace(view_old, view_new)

with open('app/src/main/java/com/example/motolock/CameraScreen.kt', 'w', encoding='utf-8') as f:
    f.write(code)
