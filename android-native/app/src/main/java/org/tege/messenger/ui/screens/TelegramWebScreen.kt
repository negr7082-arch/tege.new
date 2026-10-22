package org.tege.messenger.ui.screens

import android.annotation.SuppressLint
import android.webkit.CookieManager
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.weight
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
import androidx.compose.ui.text.style.TextAlign
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
    var loadError by remember { mutableStateOf(false) }

    BackHandler(enabled = webView?.canGoBack() == true) {
        webView?.goBack()
    }

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
                IconButton(onClick = {
                    val currentWebView = webView
                    if (currentWebView?.canGoBack() == true) currentWebView.goBack() else onBack()
                }) {
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

        // The WebView must consume only the remaining height below the toolbar.
        // fillMaxSize() inside a Column can over-measure a native AndroidView on phones.
        Box(modifier = Modifier.fillMaxWidth().weight(1f)) {
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
                    webViewClient = object : WebViewClient() {
                        override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                            loadError = false
                            loadingProgress = 0
                        }

                        override fun onReceivedError(
                            view: WebView?,
                            request: WebResourceRequest?,
                            error: WebResourceError?
                        ) {
                            if (request?.isForMainFrame == true) loadError = true
                        }

                        override fun onReceivedHttpError(
                            view: WebView?,
                            request: WebResourceRequest?,
                            errorResponse: android.webkit.WebResourceResponse?
                        ) {
                            // Network errors can be reported for images and API calls too.
                            // Only replace the whole client when the main document fails.
                            if (request?.isForMainFrame == true &&
                                (errorResponse?.statusCode ?: 0) >= 400
                            ) {
                                loadError = true
                                loadingProgress = 100
                            }
                        }

                        override fun onPageFinished(view: WebView?, url: String?) {
                            loadingProgress = 100
                        }
                    }
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
        if (loadError) {
            Column(
                modifier = Modifier
                    .align(Alignment.Center)
                    .padding(28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    "Не удалось загрузить Telegram",
                    style = MaterialTheme.typography.titleMedium,
                    textAlign = TextAlign.Center
                )
                Text(
                    "Проверь подключение к интернету и попробуй ещё раз.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    textAlign = TextAlign.Center
                )
                androidx.compose.material3.Button(onClick = {
                    loadError = false
                    webView?.reload()
                }) {
                    Text("Повторить")
                }
            }
        }
        }
    }
}
