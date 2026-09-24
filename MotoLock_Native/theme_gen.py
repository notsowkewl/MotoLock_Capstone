# coding=utf-8
import os

color_kt = """package com.example.motolock.ui.theme

import androidx.compose.ui.graphics.Color

val MotoRed = Color(0xFFED1C24)
val MotoRedDark = Color(0xFFC9151C)
val MotoRedSoft = Color(0xFFFFF1F2)
val MotoGreen = Color(0xFF1FA35B)
val MotoGreenSoft = Color(0xFFECFDF3)
val MotoBlue = Color(0xFF2563EB)
val MotoBlueSoft = Color(0xFFEEF4FF)
val MotoOrange = Color(0xFFF59E0B)
val MotoOrangeSoft = Color(0xFFFFF7E8)
val MotoBlack = Color(0xFF101217)
val MotoGray = Color(0xFF737987)
val MotoMuted = Color(0xFFA1A8B3)
val MotoLine = Color(0xFFE8EBF0)
val MotoBg = Color(0xFFF3F5F9)
val MotoWhite = Color(0xFFFFFFFF)
"""

type_kt = """package com.example.motolock.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// We simulate Inter/Poppins styling via default typography with precise letterSpacing and lineHeights.
val MotoTypography = Typography(
    headlineLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Black,
        fontSize = 26.sp,
        letterSpacing = (-0.08).sp,
        lineHeight = 32.sp
    ),
    headlineMedium = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Black,
        fontSize = 22.sp,
        letterSpacing = (-0.04).sp,
        lineHeight = 25.sp
    ),
    titleLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Black,
        fontSize = 18.sp,
        letterSpacing = (-0.04).sp,
        lineHeight = 22.sp
    ),
    bodyLarge = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Normal,
        fontSize = 13.sp,
        lineHeight = 19.sp,
        color = MotoGray
    ),
    labelSmall = TextStyle(
        fontFamily = FontFamily.Default,
        fontWeight = FontWeight.Black,
        fontSize = 11.sp,
        color = MotoBlack
    )
)
"""

theme_kt = """package com.example.motolock.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColorScheme = lightColorScheme(
    primary = MotoRed,
    secondary = MotoGray,
    tertiary = MotoBlack,
    background = MotoBg,
    surface = MotoWhite,
    onPrimary = MotoWhite,
    onSecondary = MotoWhite,
    onTertiary = MotoWhite,
    onBackground = MotoBlack,
    onSurface = MotoBlack,
)

@Composable
fun MotoLockTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = MotoTypography,
        content = content
    )
}
"""

with open('C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/ui/theme/Color.kt', 'w', encoding='utf-8') as f:
    f.write(color_kt)

with open('C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/ui/theme/Type.kt', 'w', encoding='utf-8') as f:
    f.write(type_kt)

with open('C:/Users/OEM/Downloads/MotoLock_Native/app/src/main/java/com/example/motolock/ui/theme/Theme.kt', 'w', encoding='utf-8') as f:
    f.write(theme_kt)

print("Color.kt, Type.kt, and Theme.kt generated successfully")
