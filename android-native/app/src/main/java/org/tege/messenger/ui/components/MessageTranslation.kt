package org.tege.messenger.ui.components

import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

@Composable
fun MessageTranslation(text: String) {
    Text(text = "Переводчик будет подключён после настройки сервиса: " + text)
}
