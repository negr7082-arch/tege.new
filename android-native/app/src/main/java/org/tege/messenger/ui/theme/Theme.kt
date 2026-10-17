package org.tege.messenger.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val TelegramBlue = Color(0xFF2AABEE)
val TelegramLightBlue = Color(0xFF50B9EC)
val TelegramDarkBackground = Color(0xFF0F172A)
val TelegramDarkSurface = Color(0xFF1E293B)
val TelegramLightBackground = Color(0xFFF1F5F9)
val TelegramLightSurface = Color(0xFFFFFFFF)

private val DarkColorScheme = darkColorScheme(
    primary = TelegramBlue,
    secondary = TelegramLightBlue,
    tertiary = Color(0xFF38BDF8),
    background = TelegramDarkBackground,
    surface = TelegramDarkSurface,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = Color(0xFFF8FAFC),
    onSurface = Color(0xFFF8FAFC)
)

private val LightColorScheme = lightColorScheme(
    primary = TelegramBlue,
    secondary = Color(0xFF0284C7),
    tertiary = Color(0xFF0EA5E9),
    background = TelegramLightBackground,
    surface = TelegramLightSurface,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onBackground = Color(0xFF0F172A),
    onSurface = Color(0xFF0F172A)
)

@Composable
fun TegeTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography(),
        content = content
    )
}
