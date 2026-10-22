package org.tege.messenger.ui.components

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.AudioFile
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Gif
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

/**
 * Telegram-like attachment sheet. Uses Android's Storage Access Framework, so
 * the user chooses a real file and the app receives a content:// URI without
 * broad storage permissions.
 */
data class PickedTelegramMedia(
    val uri: Uri,
    val displayName: String,
    val mimeType: String,
    val sizeBytes: Long?
) {
    val kind: TelegramMediaKind
        get() = when {
            mimeType.startsWith("image/") -> TelegramMediaKind.IMAGE
            mimeType.startsWith("video/") -> TelegramMediaKind.VIDEO
            mimeType.startsWith("audio/") -> TelegramMediaKind.AUDIO
            mimeType == "application/pdf" -> TelegramMediaKind.PDF
            mimeType.startsWith("text/") -> TelegramMediaKind.TEXT
            else -> TelegramMediaKind.DOCUMENT
        }
}

enum class TelegramMediaKind { IMAGE, VIDEO, AUDIO, PDF, TEXT, DOCUMENT }

fun readPickedTelegramMedia(context: Context, uri: Uri): PickedTelegramMedia {
    val resolver = context.contentResolver
    val mime = resolver.getType(uri) ?: "application/octet-stream"
    var name = "Файл"
    var size: Long? = null
    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
        ?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (nameIndex >= 0) name = cursor.getString(nameIndex) ?: name
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (sizeIndex >= 0 && !cursor.isNull(sizeIndex)) size = cursor.getLong(sizeIndex)
            }
        }
    return PickedTelegramMedia(uri, name, mime, size)
}

@Composable
fun TelegramAttachmentSheet(
    onDismiss: () -> Unit,
    onPicked: (PickedTelegramMedia) -> Unit
) {
    val context = LocalContext.current
    var pendingType by remember { mutableStateOf("*/*") }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
            onPicked(readPickedTelegramMedia(context, uri))
        }
        onDismiss()
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Прикрепить") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                AttachmentRow(Icons.Default.Image, "Фото", "Выбрать изображения") {
                    pendingType = "image/*"; picker.launch(arrayOf("image/*"))
                }
                AttachmentRow(Icons.Default.VideoLibrary, "Видео", "Выбрать видеофайл") {
                    pendingType = "video/*"; picker.launch(arrayOf("video/*"))
                }
                AttachmentRow(Icons.Default.AudioFile, "Музыка и аудио", "Аудио и голосовые файлы") {
                    pendingType = "audio/*"; picker.launch(arrayOf("audio/*"))
                }
                AttachmentRow(Icons.Default.Description, "Файл", "PDF, документы и другие файлы") {
                    pendingType = "*/*"; picker.launch(arrayOf("*/*"))
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Закрыть") }
        }
    )
}

@Composable
private fun AttachmentRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f)
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 11.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Column {
                Text(title, style = MaterialTheme.typography.titleSmall)
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
