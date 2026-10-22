package org.tege.messenger

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.TextView
import org.tege.messenger.ui.components.TegeChan3DView

/**
 * Hosts the OpenGL mascot in its own window. Keeping GLSurfaceView out of a
 * Compose dialog avoids the separate-surface bug that could blank the main UI.
 */
class TegeChanActivity : Activity() {
    private var mascot: TegeChan3DView? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(12, 20, 42)
        window.navigationBarColor = Color.rgb(12, 20, 42)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setBackgroundColor(Color.rgb(12, 20, 42))
            setPadding(dp(20), dp(12), dp(20), dp(20))
        }

        val back = TextView(this).apply {
            text = "‹   Назад"
            textSize = 18f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(4), dp(8), dp(12), dp(12))
            contentDescription = "Вернуться в TEGE"
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

        mascot = TegeChan3DView(this) { message ->
            runOnUiThread { reaction.text = message }
        }
        root.addView(mascot, LinearLayout.LayoutParams(-1, 0, 1f))
        root.addView(reaction, LinearLayout.LayoutParams(-1, dp(64)))
        setContentView(root)
    }

    override fun onResume() {
        super.onResume()
        mascot?.onResume()
    }

    override fun onPause() {
        mascot?.onPause()
        super.onPause()
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()
}
