package org.tege.messenger.ui.screens

import android.annotation.SuppressLint
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView

private const val TELEGRAM_WEB_URL = "https://web.telegram.org/k/"

/**
 * Embeds Telegram's official web client. Telegram authentication remains in the
 * Android WebView cookie/storage profile and is never sent to the TEGE backend.
 */
@SuppressLint("SetJavaScriptEnabled")
@androidx.compose.runtime.Composable
fun TelegramWebScreen(onBack: () -> Unit) {
    var webView by remember { mutableStateOf<WebView?>(null) }
    var loadingProgress by remember { mutableIntStateOf(0) }

    DisposableEffect(Unit) {
        onDispose {
            webView?.stopLoading()
        }
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Surface(
            color = MaterialTheme.colorScheme.surface,
            tonalElevation = 2.dp,
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 4.dp, vertical = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                }
                Column(
                    modifier = Modifier.weight(1f),
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("Telegram", style = MaterialTheme.typography.titleMedium)
                    Text(
                        "Официальный веб-клиент",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                IconButton(onClick = { webView?.reload() }) {
                    Icon(Icons.Default.Refresh, contentDescription = "Обновить")
                }
            }
        }

        if (loadingProgress in 1..99) {
            LinearProgressIndicator(
                progress = loadingProgress / 100f,
                modifier = Modifier.fillMaxWidth()
            )
        }

        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { context ->
                WebView(context).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.loadsImagesAutomatically = true
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    CookieManager.getInstance().setAcceptCookie(true)
                    CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)
                    webViewClient = WebViewClient()
                    webChromeClient = object : WebChromeClient() {
                        override fun onProgressChanged(view: WebView?, newProgress: Int) {
                            loadingProgress = newProgress
                        }
                    }
                    loadUrl(TELEGRAM_WEB_URL)
                }.also { webView = it }
            },
            update = { view ->
                if (webView !== view) webView = view
            }
        )
    }
}
