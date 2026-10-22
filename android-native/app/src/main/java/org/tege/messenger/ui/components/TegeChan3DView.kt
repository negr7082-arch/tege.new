package org.tege.messenger.ui.components

import android.content.Context
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.Matrix
import android.view.MotionEvent
import android.view.View
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin
import kotlin.random.Random
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10

/**
 * Lightweight, procedural 3D mascot prototype. It uses OpenGL ES 2.0 only,
 * so no model download or additional rendering dependency is needed.
 */
class TegeChan3DView(
    context: Context,
    private val onReaction: (String) -> Unit
) : GLSurfaceView(context) {
    private val mascotRenderer = MascotRenderer()

    private var downX = 0f
    private var downY = 0f
    private var dragged = false

    init {
        // Explicit RGBA/depth config avoids devices choosing an incompatible default
        // EGL surface for GLSurfaceView embedded in a Compose AlertDialog.
        setEGLConfigChooser(8, 8, 8, 8, 16, 0)
        setEGLContextClientVersion(2)
        preserveEGLContextOnPause = true
        setRenderer(mascotRenderer)
        // Keep the decorative scene light on phones; the render loop is capped below.
        renderMode = RENDERMODE_CONTINUOUSLY
        setBackgroundColor(android.graphics.Color.rgb(12, 20, 42))
        contentDescription = "Интерактивная трёхмерная TEGE-тянка. Проведи пальцем, чтобы повернуть."
        setOnTouchListener { _: View, event: MotionEvent ->
            when (event.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    downX = event.x
                    downY = event.y
                    dragged = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.x - downX
                    val dy = event.y - downY
                    if (kotlin.math.abs(dx) + kotlin.math.abs(dy) > 8f) dragged = true
                    if (dragged) {
                        mascotRenderer.drag(dx * 0.55f, dy * 0.18f)
                        downX = event.x
                        downY = event.y
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!dragged) {
                        mascotRenderer.react()
                        onReaction(
                            listOf(
                                "Ой! Ты меня заметил 💙",
                                "Эй-эй, щекотно! ✨",
                                "Хи-хи~ Я тут вообще-то живу 👀",
                                "Ня? Поверни меня пальцем!",
                                "Ладно, только не теряй меня 💫",
                                "А-а, не смотри так… я смущаюсь 🙈",
                                "Хм! Всё, теперь я отвернусь… ну почти 💙",
                                "Ты хотел привлечь моё внимание? Получилось ✨"
                            ).random()
                        )
                    }
                    performClick()
                    true
                }
                else -> true
            }
        }
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }

    private class MascotRenderer : Renderer {
        private val projection = FloatArray(16)
        private val view = FloatArray(16)
        private val vp = FloatArray(16)
        private val global = FloatArray(16)
        private val model = FloatArray(16)
        private val rotated = FloatArray(16)
        private val mvp = FloatArray(16)
        private lateinit var program: ShaderProgram
        private lateinit var sphere: SphereMesh

        @Volatile private var userYaw = -8f
        @Volatile private var userPitch = 0f
        @Volatile private var reactionAt = 0L
        @Volatile private var reactionYaw = 0f

        fun drag(dx: Float, dy: Float) {
            userYaw = (userYaw + dx).coerceIn(-70f, 70f)
            userPitch = (userPitch + dy).coerceIn(-12f, 12f)
        }

        fun react() {
            reactionYaw = if (Random.nextBoolean()) 24f else -24f
            reactionAt = android.os.SystemClock.uptimeMillis()
        }

        override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
            GLES20.glClearColor(0.047f, 0.078f, 0.16f, 1f)
            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
            GLES20.glEnable(GLES20.GL_DEPTH_TEST)
            GLES20.glEnable(GLES20.GL_BLEND)
            GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA)
            program = ShaderProgram()
            sphere = SphereMesh()
            Matrix.setLookAtM(view, 0, 0f, 0.15f, 4.1f, 0f, 0.15f, 0f, 0f, 1f, 0f)
        }

        override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
            GLES20.glViewport(0, 0, width, height)
            val ratio = width.toFloat() / height.coerceAtLeast(1)
            Matrix.perspectiveM(projection, 0, 35f, ratio, 0.1f, 30f)
        }

        override fun onDrawFrame(gl: GL10?) {
            GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
            // Do not sleep on the GL thread: some device drivers stall surface
            // creation when the renderer blocks. GLSurfaceView owns frame pacing.
            val now = android.os.SystemClock.uptimeMillis()
            val idle = sin(now / 720.0).toFloat()
            val elapsed = ((now - reactionAt).coerceAtLeast(0L) / 1000f)
            val reaction = if (reactionAt == 0L) 0f else (1f - elapsed / 0.7f).coerceIn(0f, 1f)
            val blink = if (now % 4300L in 0L..145L) 0.28f else 1f
            // Tiny gaze drift keeps the mascot from looking like a static figurine.
            val gazeX = sin(now / 1250.0).toFloat() * 0.009f
            val bodySway = sin(now / 880.0).toFloat() * 0.008f
            Matrix.setIdentityM(global, 0)
            Matrix.rotateM(global, 0, userPitch + idle * 1.2f, 1f, 0f, 0f)
            Matrix.rotateM(global, 0, userYaw + idle * 2.1f + reactionYaw * reaction, 0f, 1f, 0f)
            Matrix.multiplyMM(vp, 0, projection, 0, view, 0)

            // Rear hair and long side locks, with cool-blue strands for a layered silhouette.
            part(0f, 0.91f, -0.13f, 0.36f, 0.43f, 0.25f, 0.055f, 0.09f, 0.20f)
            part(-0.265f, 0.64f, -0.035f, 0.105f, 0.34f, 0.13f, 0.055f, 0.09f, 0.20f)
            part(0.265f, 0.64f, -0.035f, 0.105f, 0.34f, 0.13f, 0.055f, 0.09f, 0.20f)
            part(-0.285f, 0.69f, 0.045f, 0.025f, 0.25f, 0.018f, 0.12f, 0.25f, 0.43f)
            part(0.285f, 0.69f, 0.045f, 0.025f, 0.25f, 0.018f, 0.12f, 0.25f, 0.43f)

            // Hoodie torso, collar and relaxed arms.
            part(bodySway, 0.02f + idle * 0.012f, 0f, 0.32f, 0.43f, 0.20f, 0.12f, 0.36f, 0.72f)
            part(0f, 0.38f, 0.015f, 0.15f, 0.13f, 0.14f, 0.18f, 0.39f, 0.78f)
            part(-0.36f, 0.00f, 0f, 0.115f, 0.32f, 0.12f, 0.10f, 0.29f, 0.61f)
            part(0.36f, 0.00f, 0f, 0.115f, 0.32f, 0.12f, 0.10f, 0.29f, 0.61f)
            // Small bright drawstrings and a central zipper detail on the hoodie.
            part(-0.055f, 0.23f, 0.188f, 0.012f, 0.105f, 0.012f, 0.36f, 0.72f, 0.96f)
            part(0.055f, 0.23f, 0.188f, 0.012f, 0.105f, 0.012f, 0.36f, 0.72f, 0.96f)
            part(0f, 0.015f, 0.201f, 0.008f, 0.13f, 0.008f, 0.24f, 0.56f, 0.82f)
            part(0f, -0.12f, 0.205f, 0.018f, 0.018f, 0.009f, 0.55f, 0.82f, 1f)
            part(-0.37f, -0.27f, 0.035f, 0.105f, 0.105f, 0.105f, 0.96f, 0.75f, 0.67f)
            part(0.37f, -0.27f, 0.035f, 0.105f, 0.105f, 0.105f, 0.96f, 0.75f, 0.67f)
            part(-0.14f, -0.51f, 0f, 0.13f, 0.27f, 0.14f, 0.07f, 0.10f, 0.19f)
            part(0.14f, -0.51f, 0f, 0.13f, 0.27f, 0.14f, 0.07f, 0.10f, 0.19f)
            part(-0.14f, -0.75f, 0.045f, 0.14f, 0.09f, 0.21f, 0.12f, 0.15f, 0.25f)
            part(0.14f, -0.75f, 0.045f, 0.14f, 0.09f, 0.21f, 0.12f, 0.15f, 0.25f)

            // Twin side ribbons and rounded hair ties make her silhouette read clearly in 3D.
            part(-0.345f, 0.83f, -0.045f, 0.105f, 0.13f, 0.11f, 0.045f, 0.075f, 0.17f)
            part(0.345f, 0.83f, -0.045f, 0.105f, 0.13f, 0.11f, 0.045f, 0.075f, 0.17f)
            part(-0.345f, 0.77f, 0.015f, 0.065f, 0.09f, 0.065f, 0.20f, 0.72f, 0.98f)
            part(0.345f, 0.77f, 0.015f, 0.065f, 0.09f, 0.065f, 0.20f, 0.72f, 0.98f)
            // Soft inner ears and little ear highlights.
            part(-0.292f, 0.79f, 0.075f, 0.018f, 0.038f, 0.012f, 0.98f, 0.48f, 0.57f)
            part(0.292f, 0.79f, 0.075f, 0.018f, 0.038f, 0.012f, 0.98f, 0.48f, 0.57f)
            // Neck, face and hair cap.
            part(0f, 0.48f, 0.02f, 0.09f, 0.13f, 0.09f, 0.96f, 0.75f, 0.67f)
            part(0f, 0.80f, 0.02f, 0.29f, 0.34f, 0.25f, 0.98f, 0.79f, 0.72f)
            part(0f, 1.015f, -0.015f, 0.315f, 0.225f, 0.285f, 0.045f, 0.075f, 0.17f)
            part(-0.18f, 0.91f, 0.205f, 0.10f, 0.20f, 0.08f, 0.045f, 0.075f, 0.17f)
            part(0.03f, 0.965f, 0.245f, 0.13f, 0.10f, 0.06f, 0.045f, 0.075f, 0.17f)
            part(0.17f, 0.91f, 0.205f, 0.095f, 0.18f, 0.075f, 0.045f, 0.075f, 0.17f)
            // Swept fringe locks frame the face and give the silhouette a clearer anime style.
            part(-0.105f, 1.015f, 0.245f, 0.13f, 0.105f, 0.07f, 0.055f, 0.085f, 0.19f)
            part(0.075f, 1.045f, 0.248f, 0.12f, 0.09f, 0.065f, 0.055f, 0.085f, 0.19f)
            part(0.015f, 0.965f, 0.292f, 0.045f, 0.105f, 0.025f, 0.075f, 0.12f, 0.23f)
            // Small ears peek out from under the hair.
            part(-0.285f, 0.79f, 0.035f, 0.045f, 0.075f, 0.045f, 0.92f, 0.63f, 0.58f)
            part(0.285f, 0.79f, 0.035f, 0.045f, 0.075f, 0.045f, 0.92f, 0.63f, 0.58f)
            // Small cyan hair clips catch the light and make the silhouette more distinctive.
            part(-0.245f, 0.955f, 0.235f, 0.055f, 0.018f, 0.012f, 0.20f, 0.72f, 0.98f)
            part(-0.235f, 0.935f, 0.242f, 0.040f, 0.010f, 0.010f, 0.70f, 0.91f, 1f)
            // Matching clip on the opposite side keeps the hair silhouette balanced.
            part(0.245f, 0.955f, 0.235f, 0.055f, 0.018f, 0.012f, 0.20f, 0.72f, 0.98f)
            part(0.235f, 0.935f, 0.242f, 0.040f, 0.010f, 0.010f, 0.70f, 0.91f, 1f)
            // Hoodie pocket, seam piping and cuff accents add readable clothing details.
            part(0f, -0.105f, 0.188f, 0.145f, 0.075f, 0.018f, 0.075f, 0.27f, 0.55f)
            part(-0.125f, -0.075f, 0.196f, 0.010f, 0.035f, 0.009f, 0.22f, 0.49f, 0.76f)
            part(0.125f, -0.075f, 0.196f, 0.010f, 0.035f, 0.009f, 0.22f, 0.49f, 0.76f)
            part(-0.36f, -0.19f, 0.06f, 0.12f, 0.045f, 0.13f, 0.22f, 0.49f, 0.76f)
            part(0.36f, -0.19f, 0.06f, 0.12f, 0.045f, 0.13f, 0.22f, 0.49f, 0.76f)
            // White-blue sneaker soles and lace marks.
            part(-0.14f, -0.81f, 0.075f, 0.145f, 0.028f, 0.22f, 0.55f, 0.82f, 1f)
            part(0.14f, -0.81f, 0.075f, 0.145f, 0.028f, 0.22f, 0.55f, 0.82f, 1f)
            part(-0.14f, -0.75f, 0.245f, 0.052f, 0.009f, 0.009f, 0.83f, 0.93f, 1f)
            part(0.14f, -0.75f, 0.245f, 0.052f, 0.009f, 0.009f, 0.83f, 0.93f, 1f)
            // Tiny collar badge, with a bright center and a soft lower glint.
            part(0f, 0.31f, 0.153f, 0.040f, 0.035f, 0.018f, 0.20f, 0.72f, 0.98f)
            part(0f, 0.313f, 0.174f, 0.014f, 0.014f, 0.008f, 0.78f, 0.94f, 1f)
            part(0f, 0.294f, 0.171f, 0.010f, 0.004f, 0.006f, 0.62f, 0.84f, 1f)

            // A tiny star charm on the hoodie pocket catches the ambient cyan light.
            part(0.055f, -0.10f, 0.215f, 0.022f, 0.022f, 0.010f, 0.72f, 0.91f, 1f)
            part(0.055f, -0.10f, 0.227f, 0.009f, 0.009f, 0.006f, 1f, 1f, 1f)
            // Tiny floating cyan motes make the secret scene feel alive without textures or assets.
            val sparklePulse = 0.5f + 0.5f * sin(now / 260.0).toFloat()
            val sparkleSide = sin(now / 510.0).toFloat() * 0.018f
            part(-0.39f + sparkleSide, 1.10f, 0.08f, 0.018f, 0.018f, 0.018f, 0.20f, 0.72f, 0.98f)
            part(0.39f - sparkleSide, 0.99f, 0.10f, 0.012f + sparklePulse * 0.006f, 0.012f + sparklePulse * 0.006f, 0.012f, 0.48f, 0.83f, 1f)
            part(-0.34f, 0.56f + sparkleSide, 0.12f, 0.010f, 0.010f, 0.010f, 0.38f, 0.78f, 1f)

            // Brows, layered irises and eye glints add readable expression at phone size.
            part(-0.105f, 0.895f, 0.258f, 0.047f, 0.009f, 0.012f, 0.16f, 0.09f, 0.13f)
            part(0.105f, 0.895f, 0.258f, 0.047f, 0.009f, 0.012f, 0.16f, 0.09f, 0.13f)
            // Big glossy eyes; a short scale pulse simulates blinking.
            val eyeHeight = 0.052f * blink
            part(-0.105f, 0.82f, 0.267f, 0.040f, eyeHeight, 0.024f, 0.12f, 0.16f, 0.25f)
            part(0.105f, 0.82f, 0.267f, 0.040f, eyeHeight, 0.024f, 0.12f, 0.16f, 0.25f)
            part(-0.101f + gazeX, 0.822f, 0.293f, 0.018f, eyeHeight * 0.65f, 0.012f, 0.22f, 0.72f, 0.98f)
            part(0.109f + gazeX, 0.822f, 0.293f, 0.018f, eyeHeight * 0.65f, 0.012f, 0.22f, 0.72f, 0.98f)
            part(-0.114f + gazeX, 0.842f, 0.305f, 0.009f, 0.012f, 0.008f, 1f, 1f, 1f)
            part(0.096f + gazeX, 0.842f, 0.305f, 0.009f, 0.012f, 0.008f, 1f, 1f, 1f)
            // A tiny nose and subtle lower-eye highlights give the face more depth.
            part(0f, 0.785f, 0.284f, 0.010f, 0.009f, 0.009f, 0.88f, 0.56f, 0.52f)
            part(-0.075f, 0.775f, 0.274f, 0.012f, 0.006f, 0.006f, 0.98f, 0.80f, 0.77f)
            part(0.135f, 0.775f, 0.274f, 0.012f, 0.006f, 0.006f, 0.98f, 0.80f, 0.77f)
            // A gentle smile with a slightly darker center makes the neutral face less blank.
            part(0f, 0.725f, 0.282f, 0.038f, 0.008f, 0.010f, 0.56f, 0.20f, 0.25f)
            part(0f, 0.729f, 0.291f, 0.023f, 0.004f, 0.006f, 0.96f, 0.43f, 0.47f)
            // Mouth changes shape/color briefly after a tap to suggest a surprised reaction.
            val mouthOpen = 0.022f + reaction * 0.018f
            part(0f, 0.755f, 0.269f, 0.018f, mouthOpen, 0.015f, 0.88f - reaction * 0.12f, 0.39f, 0.43f)
            // Blush intensifies for a moment when she reacts, then fades back to idle.
            val blush = 0.045f + reaction * 0.012f
            part(-0.205f, 0.745f, 0.225f, blush, 0.018f, 0.012f, 0.98f, 0.49f, 0.55f)
            part(0.205f, 0.745f, 0.225f, blush, 0.018f, 0.012f, 0.98f, 0.49f, 0.55f)
        }

        private fun part(
            x: Float, y: Float, z: Float,
            sx: Float, sy: Float, sz: Float,
            r: Float, g: Float, b: Float
        ) {
            Matrix.setIdentityM(model, 0)
            Matrix.translateM(model, 0, x, y, z)
            Matrix.scaleM(model, 0, sx, sy, sz)
            Matrix.multiplyMM(rotated, 0, global, 0, model, 0)
            Matrix.multiplyMM(mvp, 0, vp, 0, rotated, 0)
            program.draw(sphere, mvp, rotated, r, g, b)
        }
    }

    private class ShaderProgram {
        private val program: Int
        private val position: Int
        private val normal: Int
        private val mvpLocation: Int
        private val modelLocation: Int
        private val colorLocation: Int

        init {
            val vertex = """
                uniform mat4 uMvp;
                uniform mat4 uModel;
                attribute vec3 aPosition;
                attribute vec3 aNormal;
                varying float vLight;
                void main() {
                    vec3 n = normalize(mat3(uModel) * aNormal);
                    vec3 lightDir = normalize(vec3(-0.35, 0.75, 0.9));
                    vLight = 0.48 + 0.52 * max(dot(n, lightDir), 0.0);
                    gl_Position = uMvp * vec4(aPosition, 1.0);
                }
            """.trimIndent()
            val fragment = """
                precision mediump float;
                uniform vec3 uColor;
                varying float vLight;
                void main() {
                    gl_FragColor = vec4(uColor * vLight, 1.0);
                }
            """.trimIndent()
            program = GLES20.glCreateProgram().also { p ->
                GLES20.glAttachShader(p, compile(GLES20.GL_VERTEX_SHADER, vertex))
                GLES20.glAttachShader(p, compile(GLES20.GL_FRAGMENT_SHADER, fragment))
                GLES20.glLinkProgram(p)
                val status = IntArray(1)
                GLES20.glGetProgramiv(p, GLES20.GL_LINK_STATUS, status, 0)
                check(status[0] == GLES20.GL_TRUE) { "3D mascot shader link failed" }
            }
            position = GLES20.glGetAttribLocation(program, "aPosition")
            normal = GLES20.glGetAttribLocation(program, "aNormal")
            mvpLocation = GLES20.glGetUniformLocation(program, "uMvp")
            modelLocation = GLES20.glGetUniformLocation(program, "uModel")
            colorLocation = GLES20.glGetUniformLocation(program, "uColor")
        }

        fun draw(mesh: SphereMesh, mvp: FloatArray, model: FloatArray, r: Float, g: Float, b: Float) {
            GLES20.glUseProgram(program)
            GLES20.glUniformMatrix4fv(mvpLocation, 1, false, mvp, 0)
            GLES20.glUniformMatrix4fv(modelLocation, 1, false, model, 0)
            GLES20.glUniform3f(colorLocation, r, g, b)
            mesh.bind(position, normal)
            mesh.draw()
        }

        private fun compile(type: Int, source: String): Int {
            val shader = GLES20.glCreateShader(type)
            GLES20.glShaderSource(shader, source)
            GLES20.glCompileShader(shader)
            val status = IntArray(1)
            GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, status, 0)
            check(status[0] == GLES20.GL_TRUE) {
                "3D mascot shader compile failed: " + GLES20.glGetShaderInfoLog(shader)
            }
            return shader
        }
    }

    private class SphereMesh {
        private val vertexBuffer: java.nio.FloatBuffer
        private val normalBuffer: java.nio.FloatBuffer
        private val indexBuffer: java.nio.ShortBuffer
        private val indexCount: Int

        init {
            val stacks = 18
            val slices = 24
            val vertices = ArrayList<Float>()
            val indices = ArrayList<Short>()
            for (stack in 0..stacks) {
                val phi = PI * stack / stacks
                val y = cos(phi).toFloat()
                val ring = sin(phi).toFloat()
                for (slice in 0..slices) {
                    val theta = 2.0 * PI * slice / slices
                    val x = ring * cos(theta).toFloat()
                    val z = ring * sin(theta).toFloat()
                    vertices.add(x); vertices.add(y); vertices.add(z)
                }
            }
            for (stack in 0 until stacks) {
                for (slice in 0 until slices) {
                    val first = (stack * (slices + 1) + slice).toShort()
                    val second = (first.toInt() + slices + 1).toShort()
                    indices.add(first); indices.add(second); indices.add((first + 1).toShort())
                    indices.add(second); indices.add((second + 1).toShort()); indices.add((first + 1).toShort())
                }
            }
            indexCount = indices.size
            vertexBuffer = java.nio.ByteBuffer.allocateDirect(vertices.size * 4)
                .order(java.nio.ByteOrder.nativeOrder()).asFloatBuffer().apply {
                    vertices.forEach { put(it) }; position(0)
                }
            normalBuffer = java.nio.ByteBuffer.allocateDirect(vertices.size * 4)
                .order(java.nio.ByteOrder.nativeOrder()).asFloatBuffer().apply {
                    vertices.forEach { put(it) }; position(0)
                }
            indexBuffer = java.nio.ByteBuffer.allocateDirect(indices.size * 2)
                .order(java.nio.ByteOrder.nativeOrder()).asShortBuffer().apply {
                    indices.forEach { put(it) }; position(0)
                }
        }

        fun bind(positionLocation: Int, normalLocation: Int) {
            vertexBuffer.position(0)
            GLES20.glEnableVertexAttribArray(positionLocation)
            GLES20.glVertexAttribPointer(positionLocation, 3, GLES20.GL_FLOAT, false, 0, vertexBuffer)
            normalBuffer.position(0)
            GLES20.glEnableVertexAttribArray(normalLocation)
            GLES20.glVertexAttribPointer(normalLocation, 3, GLES20.GL_FLOAT, false, 0, normalBuffer)
        }

        fun draw() {
            indexBuffer.position(0)
            GLES20.glDrawElements(GLES20.GL_TRIANGLES, indexCount, GLES20.GL_UNSIGNED_SHORT, indexBuffer)
        }
    }
}
