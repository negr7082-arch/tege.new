package org.tege.messenger.ui.components

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import androidx.compose.ui.platform.LocalContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.URL

/**
 * Telegram-style circular avatar that supports data URIs (the format used by TEGE),
 * Android content/file URIs and HTTPS image URLs. A coloured initials fallback remains
 * visible if an image is absent or cannot be loaded.
 */
@Composable
fun TegeAvatar(
    avatarUri: String?,
    displayName: String,
    color: Color,
    modifier: Modifier = Modifier,
    savedMessages: Boolean = false
) {
    val context = LocalContext.current
    val bitmapState = produceState<Bitmap?>(initialValue = null, avatarUri) {
        value = if (avatarUri.isNullOrBlank()) null else withContext(Dispatchers.IO) {
            runCatching { loadAvatarBitmap(context, avatarUri) }.getOrNull()
        }
    }
    Box(
        modifier = modifier.clip(CircleShape).background(color),
        contentAlignment = Alignment.Center
    ) {
        val bitmap = bitmapState.value
        if (bitmap != null) {
            Image(
                bitmap = bitmap.asImageBitmap(),
                contentDescription = displayName,
                contentScale = ContentScale.Crop,
                modifier = Modifier.matchParentSize()
            )
        } else if (savedMessages) {
            Icon(Icons.Default.Bookmark, contentDescription = "Сохранённые сообщения", tint = Color.White)
        } else {
            Text(
                text = displayName.firstOrNull()?.uppercase() ?: "?",
                color = Color.White,
                fontSize = 21.sp,
                fontWeight = FontWeight.Medium
            )
        }
    }
}

private fun loadAvatarBitmap(context: android.content.Context, source: String): Bitmap? {
    val bytes = when {
        source.startsWith("data:image/", ignoreCase = true) -> {
            val comma = source.indexOf(',')
            if (comma < 0 || source.length > 12_000_000) return null
            val encoded = source.substring(comma + 1)
            Base64.decode(encoded, Base64.DEFAULT)
        }
        source.startsWith("content://", ignoreCase = true) ->
            context.contentResolver.openInputStream(Uri.parse(source))?.use { it.readBytes() }
        source.startsWith("file://", ignoreCase = true) ->
            File(Uri.parse(source).path ?: return null).takeIf { it.isFile }?.readBytes()
        source.startsWith("https://", ignoreCase = true) ->
            (URL(source).openConnection().apply {
                connectTimeout = 5_000
                readTimeout = 5_000
            }).getInputStream().use { it.readBytes() }
        else -> null
    } ?: return null
    if (bytes.isEmpty() || bytes.size > 10_000_000) return null
    return BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
}
