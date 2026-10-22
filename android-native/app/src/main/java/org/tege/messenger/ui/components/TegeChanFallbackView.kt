package org.tege.messenger.ui.components

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.sin

/**
 * Device-safe visual fallback for the TEGE easter egg.
 *
 * This is deliberately a regular Canvas view (not a SurfaceView), so the secret
 * screen still has a usable character if the device cannot create an EGL surface.
 */
class TegeChanFallbackView(
    context: Context,
    private val onTap: () -> Unit = {}
) : View(context) {
    private var yaw = 0f
    private var lastX = 0f
    private var moved = false

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val bounds = RectF()

    init {
        contentDescription = "Запасной режим TEGE-тянки. Проведи пальцем, чтобы повернуть."
        isClickable = true
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat().coerceAtLeast(1f)
        val h = height.toFloat().coerceAtLeast(1f)

        paint.shader = LinearGradient(
            0f, 0f, 0f, h,
            Color.rgb(12, 20, 42), Color.rgb(24, 39, 76), Shader.TileMode.CLAMP
        )
        canvas.drawRect(0f, 0f, w, h, paint)
        paint.shader = null

        val scale = minOf(w / 360f, h / 590f)
        canvas.save()
        canvas.translate((w - 360f * scale) / 2f, (h - 590f * scale) / 2f)
        canvas.scale(scale, scale)

        // Quiet cyan particles behind the mascot.
        val t = SystemClock.uptimeMillis() / 800f
        drawGlow(canvas, 180f, 277f + sin(t) * 5f, 115f, 0x382A9DFF)
        drawSparkle(canvas, 67f, 142f + sin(t * 1.3f) * 5f, 9f, 0xFF77D8FF.toInt())
        drawSparkle(canvas, 292f, 204f + cos(t) * 6f, 7f, 0xFF77D8FF.toInt())
        drawSparkle(canvas, 78f, 370f + cos(t * 0.8f) * 4f, 5f, 0xFF77D8FF.toInt())
        drawSparkle(canvas, 281f, 414f + sin(t * 0.7f) * 4f, 6f, 0xFF77D8FF.toInt())

        val yawScale = maxOf(0.42f, abs(cos(Math.toRadians(yaw.toDouble()))).toFloat())
        val idle = sin(t * 0.9f).toFloat() * 2.2f
        canvas.save()
        canvas.scale(yawScale, 1f, 180f, 300f)
        canvas.rotate(idle, 180f, 294f)
        drawMascot(canvas)
        canvas.restore()

        drawText(canvas, "TEGE-чан", 180f, 558f, 25f, Color.WHITE, true)
        drawText(canvas, "проведи пальцем, чтобы повернуть", 180f, 581f, 12f, 0xFFB9D9F5.toInt(), false)
        canvas.restore()

        // A low-cost idle repaint keeps the fallback from feeling frozen.
        postInvalidateOnAnimation()
    }

    private fun drawMascot(canvas: Canvas) {
        // Hair silhouette and side locks, with soft highlights.
        oval(canvas, 94f, 82f, 266f, 260f, 0xFF222A4F.toInt())
        ovalGradient(canvas, 100f, 91f, 260f, 242f, 0xFF303963.toInt(), 0xFF151C37.toInt())
        path(canvas, 0xFF242C52.toInt(),
            106f to 126f, 90f to 174f, 102f to 265f, 128f to 294f,
            153f to 264f, 137f to 174f, 153f to 116f)
        path(canvas, 0xFF242C52.toInt(),
            254f to 126f, 270f to 174f, 258f to 265f, 232f to 294f,
            207f to 264f, 223f to 174f, 207f to 116f)

        // Legs and shoes.
        roundRect(canvas, 146f, 399f, 170f, 492f, 10f, 0xFF202847.toInt())
        roundRect(canvas, 190f, 399f, 214f, 492f, 10f, 0xFF202847.toInt())
        roundRectGradient(canvas, 139f, 476f, 177f, 504f, 10f, 0xFF25395D.toInt(), 0xFF101A32.toInt())
        roundRectGradient(canvas, 183f, 476f, 221f, 504f, 10f, 0xFF25395D.toInt(), 0xFF101A32.toInt())
        roundRect(canvas, 133f, 496f, 180f, 512f, 7f, 0xFFB8E8FF.toInt())
        roundRect(canvas, 181f, 496f, 228f, 512f, 7f, 0xFFB8E8FF.toInt())
        line(canvas, 151f, 489f, 164f, 489f, 0xFF8EDBFF.toInt(), 3f)
        line(canvas, 195f, 489f, 208f, 489f, 0xFF8EDBFF.toInt(), 3f)

        // Hoodie arms, cuffs, body, collar, pocket and center seam.
        ovalGradient(canvas, 107f, 256f, 151f, 375f, 0xFF426DB1.toInt(), 0xFF192E58.toInt())
        ovalGradient(canvas, 209f, 256f, 253f, 375f, 0xFF426DB1.toInt(), 0xFF192E58.toInt())
        roundRect(canvas, 108f, 354f, 150f, 376f, 9f, 0xFF85C8F6.toInt())
        roundRect(canvas, 210f, 354f, 252f, 376f, 9f, 0xFF85C8F6.toInt())
        path(canvas, 0xFF28508A.toInt(),
            136f to 238f, 224f to 238f, 248f to 284f,
            236f to 402f, 124f to 402f, 112f to 284f)
        path(canvas, 0xFF3F75B8.toInt(),
            142f to 243f, 218f to 243f, 235f to 286f,
            224f to 386f, 136f to 386f, 125f to 286f)
        path(canvas, 0xFF8CCEFF.toInt(),
            155f to 245f, 180f to 257f, 205f to 245f,
            192f to 273f, 168f to 273f)
        line(canvas, 180f, 275f, 180f, 387f, 0xFF9BD8FF.toInt(), 2f)
        roundRect(canvas, 145f, 338f, 215f, 370f, 9f, 0xFF28538D.toInt())
        line(canvas, 151f, 339f, 151f, 362f, 0xFF7AB7EC.toInt(), 2f)
        line(canvas, 209f, 339f, 209f, 362f, 0xFF7AB7EC.toInt(), 2f)
        drawSparkle(canvas, 194f, 350f, 5f, 0xFFC5F0FF.toInt())

        // Neck, face, ears and anime hair.
        roundRect(canvas, 165f, 209f, 195f, 252f, 9f, 0xFFE8B6A6.toInt())
        ovalGradient(canvas, 119f, 111f, 241f, 235f, 0xFFFFDCCB.toInt(), 0xFFE6A998.toInt())
        oval(canvas, 107f, 159f, 126f, 192f, 0xFFF0B9A8.toInt())
        oval(canvas, 234f, 159f, 253f, 192f, 0xFFF0B9A8.toInt())
        oval(canvas, 112f, 163f, 121f, 184f, 0xFFFFCFC3.toInt())
        oval(canvas, 239f, 163f, 248f, 184f, 0xFFFFCFC3.toInt())

        // Long side-swept fringe.
        path(canvas, 0xFF242C52.toInt(),
            109f to 151f, 108f to 105f, 145f to 85f, 186f to 95f,
            224f to 86f, 252f to 112f, 242f to 159f, 218f to 133f,
            192f to 154f, 180f to 126f, 156f to 155f, 139f to 134f)
        path(canvas, 0xFF485A91.toInt(),
            125f to 111f, 153f to 93f, 172f to 99f, 154f to 127f)
        path(canvas, 0xFF485A91.toInt(),
            192f to 99f, 218f to 94f, 240f to 118f, 219f to 111f)
        roundRect(canvas, 119f, 131f, 145f, 139f, 3f, 0xFF65D5FF.toInt())
        roundRect(canvas, 216f, 131f, 242f, 139f, 3f, 0xFF65D5FF.toInt())

        // Eyebrows, glossy blue eyes, pupils and tiny highlights.
        line(canvas, 137f, 154f, 160f, 151f, 0xFF613D4C.toInt(), 3f)
        line(canvas, 200f, 151f, 223f, 154f, 0xFF613D4C.toInt(), 3f)
        oval(canvas, 136f, 158f, 166f, 193f, 0xFF38283F.toInt())
        oval(canvas, 194f, 158f, 224f, 193f, 0xFF38283F.toInt())
        ovalGradient(canvas, 140f, 161f, 163f, 191f, 0xFF70D9FF.toInt(), 0xFF2261B7.toInt())
        ovalGradient(canvas, 197f, 161f, 220f, 191f, 0xFF70D9FF.toInt(), 0xFF2261B7.toInt())
        oval(canvas, 148f, 169f, 158f, 183f, 0xFF172546.toInt())
        oval(canvas, 205f, 169f, 215f, 183f, 0xFF172546.toInt())
        oval(canvas, 145f, 164f, 152f, 171f, Color.WHITE)
        oval(canvas, 202f, 164f, 209f, 171f, Color.WHITE)
        oval(canvas, 156f, 182f, 161f, 187f, 0xFFB7F4FF.toInt())
        oval(canvas, 213f, 182f, 218f, 187f, 0xFFB7F4FF.toInt())
        oval(canvas, 128f, 193f, 151f, 204f, 0x55FF718F)
        oval(canvas, 209f, 193f, 232f, 204f, 0x55FF718F)
        oval(canvas, 177f, 190f, 183f, 195f, 0xFFE09D91.toInt())
        path(canvas, 0xFF9A5267.toInt(),
            167f to 207f, 180f to 213f, 193f to 207f, 190f to 214f, 180f to 218f, 170f to 214f)

        // Twin ribbons add the recognizable TEGE silhouette.
        oval(canvas, 100f, 115f, 130f, 145f, 0xFF2B345E.toInt())
        oval(canvas, 230f, 115f, 260f, 145f, 0xFF2B345E.toInt())
        path(canvas, 0xFF7CD9FF.toInt(),
            113f to 128f, 91f to 111f, 101f to 143f, 115f to 133f, 131f to 144f)
        path(canvas, 0xFF7CD9FF.toInt(),
            247f to 128f, 269f to 111f, 259f to 143f, 245f to 133f, 229f to 144f)
        oval(canvas, 110f, 121f, 122f, 133f, 0xFFD7F7FF.toInt())
        oval(canvas, 238f, 121f, 250f, 133f, 0xFFD7F7FF.toInt())
    }

    private fun drawGlow(canvas: Canvas, cx: Float, cy: Float, radius: Float, color: Int) {
        paint.shader = android.graphics.RadialGradient(
            cx, cy, radius, color, Color.TRANSPARENT, Shader.TileMode.CLAMP
        )
        canvas.drawCircle(cx, cy, radius, paint)
        paint.shader = null
    }

    private fun drawSparkle(canvas: Canvas, cx: Float, cy: Float, size: Float, color: Int) {
        paint.color = color
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = 1.7f
        paint.strokeCap = Paint.Cap.ROUND
        canvas.drawLine(cx - size, cy, cx + size, cy, paint)
        canvas.drawLine(cx, cy - size, cx, cy + size, paint)
        canvas.drawLine(cx - size * 0.55f, cy - size * 0.55f, cx + size * 0.55f, cy + size * 0.55f, paint)
        canvas.drawLine(cx - size * 0.55f, cy + size * 0.55f, cx + size * 0.55f, cy - size * 0.55f, paint)
        paint.style = Paint.Style.FILL
    }

    private fun oval(canvas: Canvas, l: Float, t: Float, r: Float, b: Float, color: Int) {
        paint.shader = null
        paint.style = Paint.Style.FILL
        paint.color = color
        canvas.drawOval(l, t, r, b, paint)
    }

    private fun ovalGradient(canvas: Canvas, l: Float, t: Float, r: Float, b: Float, top: Int, bottom: Int) {
        paint.shader = LinearGradient(l, t, r, b, top, bottom, Shader.TileMode.CLAMP)
        paint.style = Paint.Style.FILL
        canvas.drawOval(l, t, r, b, paint)
        paint.shader = null
    }

    private fun roundRect(canvas: Canvas, l: Float, t: Float, r: Float, b: Float, radius: Float, color: Int) {
        paint.shader = null
        paint.style = Paint.Style.FILL
        paint.color = color
        canvas.drawRoundRect(l, t, r, b, radius, radius, paint)
    }

    private fun roundRectGradient(canvas: Canvas, l: Float, t: Float, r: Float, b: Float, radius: Float, top: Int, bottom: Int) {
        paint.shader = LinearGradient(l, t, r, b, top, bottom, Shader.TileMode.CLAMP)
        paint.style = Paint.Style.FILL
        canvas.drawRoundRect(l, t, r, b, radius, radius, paint)
        paint.shader = null
    }

    private fun path(canvas: Canvas, color: Int, vararg points: Pair<Float, Float>) {
        if (points.isEmpty()) return
        val shape = Path().apply {
            moveTo(points.first().first, points.first().second)
            points.drop(1).forEach { lineTo(it.first, it.second) }
            close()
        }
        paint.shader = null
        paint.style = Paint.Style.FILL
        paint.color = color
        canvas.drawPath(shape, paint)
    }

    private fun line(canvas: Canvas, x1: Float, y1: Float, x2: Float, y2: Float, color: Int, width: Float) {
        paint.shader = null
        paint.style = Paint.Style.STROKE
        paint.strokeWidth = width
        paint.strokeCap = Paint.Cap.ROUND
        paint.color = color
        canvas.drawLine(x1, y1, x2, y2, paint)
        paint.style = Paint.Style.FILL
    }

    private fun drawText(canvas: Canvas, text: String, x: Float, y: Float, size: Float, color: Int, bold: Boolean) {
        paint.shader = null
        paint.color = color
        paint.textSize = size
        paint.textAlign = Paint.Align.CENTER
        paint.typeface = if (bold) android.graphics.Typeface.create("sans-serif-rounded", android.graphics.Typeface.BOLD)
            else android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.NORMAL)
        paint.style = Paint.Style.FILL
        canvas.drawText(text, x, y, paint)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                lastX = event.x
                moved = false
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val dx = event.x - lastX
                if (abs(dx) > 2f) {
                    moved = true
                    yaw = (yaw + dx * 0.9f) % 360f
                    lastX = event.x
                    invalidate()
                }
                return true
            }
            MotionEvent.ACTION_UP -> {
                if (!moved) onTap()
                performClick()
                return true
            }
            MotionEvent.ACTION_CANCEL -> return true
        }
        return true
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }
}
