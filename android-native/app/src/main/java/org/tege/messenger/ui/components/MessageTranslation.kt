package org.tege.messenger.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.*
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.nl.languageid.LanguageIdentification
import com.google.mlkit.nl.translate.TranslateLanguage
import com.google.mlkit.nl.translate.Translation
import com.google.mlkit.nl.translate.TranslatorOptions

private val languages = listOf(
    "ru" to "Русский", "en" to "English", "de" to "Deutsch",
    "es" to "Español", "fr" to "Français", "it" to "Italiano",
    "pt" to "Português", "tr" to "Türkçe", "uk" to "Українська",
    "ar" to "العربية", "zh" to "中文", "ja" to "日本語",
    "ko" to "한국어", "hi" to "हिन्दी"
)

/** Translates text on-device. ML Kit downloads required language models on demand. */
@Composable
fun MessageTranslation(text: String) {
    var target by remember { mutableStateOf("ru" to "Русский") }
    var menuOpen by remember { mutableStateOf(false) }
    var result by remember(text) { mutableStateOf<String?>(null) }
    var message by remember(text) { mutableStateOf<String?>(null) }
    var loading by remember(text) { mutableStateOf(false) }

    Column {
        Row {
            TextButton(onClick = { menuOpen = true }) { Text("Язык: ${target.second}") }
            DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                languages.forEach { language ->
                    DropdownMenuItem(text = { Text(language.second) }, onClick = {
                        target = language
                        result = null
                        message = null
                        menuOpen = false
                    })
                }
            }
            Button(enabled = !loading && text.isNotBlank(), onClick = {
                loading = true
                result = null
                message = null
                LanguageIdentification.getClient().identifyLanguage(text)
                    .addOnSuccessListener { detected ->
                        val source = if (detected == "und") null else TranslateLanguage.fromLanguageTag(detected)
                        val destination = TranslateLanguage.fromLanguageTag(target.first)
                        if (source == null || destination == null) {
                            loading = false
                            message = "Не удалось определить язык"
                        } else if (source == destination) {
                            loading = false
                            message = "Сообщение уже на выбранном языке"
                        } else {
                            val translator = Translation.getClient(
                                TranslatorOptions.Builder().setSourceLanguage(source)
                                    .setTargetLanguage(destination).build()
                            )
                            translator.downloadModelIfNeeded(DownloadConditions.Builder().build())
                                .addOnSuccessListener {
                                    translator.translate(text)
                                        .addOnSuccessListener { translated ->
                                            result = translated
                                            loading = false
                                            translator.close()
                                        }
                                        .addOnFailureListener {
                                            message = "Ошибка перевода. Попробуйте ещё раз."
                                            loading = false
                                            translator.close()
                                        }
                                }
                                .addOnFailureListener {
                                    message = "Не удалось загрузить языковую модель. Проверьте интернет."
                                    loading = false
                                    translator.close()
                                }
                        }
                    }
                    .addOnFailureListener {
                        loading = false
                        message = "Не удалось определить язык"
                    }
            }) {
                if (loading) CircularProgressIndicator() else Text("Перевести")
            }
        }
        result?.let { Text(it) }
        message?.let { Text(it) }
    }
}
