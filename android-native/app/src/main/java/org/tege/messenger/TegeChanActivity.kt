package org.tege.messenger

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import org.tege.messenger.ui.components.TegeChan3DView
import org.tege.messenger.ui.components.TegeChanFallbackView

/**
 * Owns the mascot scene outside Compose. If a device fails to create its OpenGL
 * surface, a Canvas-based fallback replaces it instead of leaving a white screen.
 */
class TegeChanActivity : Activity() {
    private var mascot: TegeChan3DView? = null
    private var renderHost: FrameLayout? = null
    private var reactionLabel: TextView? = null
    private var rendererReady = false
    private val mainHandler = Handler(Looper.getMainLooper())
    private val renderWatchdog = Runnable {
        if (!rendererReady) showFallback()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val darkBackground = Color.rgb(12, 20, 42)
        window.setBackgroundDrawable(ColorDrawable(darkBackground))
        window.statusBarColor = darkBackground
        window.navigationBarColor = darkBackground
        // The theme uses light system-bar icons for the main app; switch to light
        // icons on this dark easter-egg background.
        window.decorView.systemUiVisibility = 0

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(darkBackground)
            setPadding(dp(20), dp(12), dp(20), dp(20))
        }

        val back = TextView(this).apply {
            text = "‹   Назад"
            textSize = 18f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(4), dp(8), dp(12), dp(12))
            contentDescription = "Вернуться в TEGE"
            isClickable = true
            isFocusable = true
            setOnClickListener { finish() }
        }
        root.addView(back, LinearLayout.LayoutParams(-1, dp(48)))

        root.addView(TextView(this).apply {
            text = "TEGE-чан 💙"
            textSize = 26f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }, LinearLayout.LayoutParams(-1, dp(48)))

        root.addView(TextView(this).apply {
            text = "Проведи пальцем, чтобы повернуть меня"
            textSize = 14f
            setTextColor(Color.rgb(180, 211, 240))
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(-1, dp(36)))

        val reaction = TextView(this).apply {
            text = "Ня! Я снова здесь ✨"
            textSize = 16f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(dp(8), dp(8), dp(8), dp(8))
        }
        reactionLabel = reaction

        val sceneHost = FrameLayout(this).apply {
            setBackgroundColor(darkBackground)
            clipChildren = true
            clipToPadding = true
        }
        renderHost = sceneHost
        root.addView(sceneHost, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(reaction, LinearLayout.LayoutParams(-1, dp(64)))

        // Attach the regular Android UI before creating the GL surface. If the
        // driver/renderer fails to produce a frame, the watchdog installs a view
        // that does not depend on EGL or SurfaceView composition.
        setContentView(root)

        try {
            val sceneView = TegeChan3DView(
                context = this,
                onReaction = { message ->
                    runOnUiThread { reactionLabel?.text = message }
                },
                onFirstFrame = {
                    runOnUiThread {
                        if (mascot == null) return@runOnUiThread
                        rendererReady = true
                        mainHandler.removeCallbacks(renderWatchdog)
                    }
                },
                onRenderFailure = {
                    runOnUiThread {
                        if (mascot != null && !rendererReady) showFallback()
                    }
                }
            )
            mascot = sceneView
            sceneHost.addView(
                sceneView,
                FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
                )
            )
            mainHandler.postDelayed(renderWatchdog, 2200L)
        } catch (_: Exception) {
            showFallback()
        }
    }

    private fun showFallback() {
        mainHandler.removeCallbacks(renderWatchdog)
        if (rendererReady) return
        val host = renderHost ?: return
        mascot?.let { glView ->
            try {
                glView.onPause()
            } catch (_: Exception) {
                // Continue showing the fallback even if the GL lifecycle is broken.
            }
            host.removeView(glView)
        }
        mascot = null
        host.removeAllViews()
        host.addView(
            TegeChanFallbackView(this) {
                reactionLabel?.text = listOf(
                    "Ой! Ты меня заметил 💙",
                    "Эй-эй, щекотно! ✨",
                    "Хи-хи~ Я тут вообще-то живу 👀",
                    "Ня? Поверни меня пальцем!",
                    "А-а, не смотри так… я смущаюсь 🙈"
                ).random()
            },
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        reactionLabel?.text = "Запасной режим активен — проведи пальцем 💙"
    }

    override fun onResume() {
        super.onResume()
        mascot?.onResume()
    }

    override fun onPause() {
        mascot?.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        mainHandler.removeCallbacks(renderWatchdog)
        mascot?.onPause()
        mascot = null
        super.onDestroy()
    }

    private fun dp(value: Int): Int =
        (value * resources.displayMetrics.density).toInt()
}
