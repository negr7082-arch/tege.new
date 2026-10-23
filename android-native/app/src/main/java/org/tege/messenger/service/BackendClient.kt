package org.tege.messenger.service

import android.content.Context
import android.os.Build
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.security.KeyPairGenerator
import java.security.KeyStore
import java.security.MessageDigest
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.util.UUID
import java.util.concurrent.TimeUnit

data class AuthResponse(
    val user: JSONObject? = null,
    val error: String? = null,
    val requiresTwoFactor: Boolean = false
)

interface TegeSocketListener {
    fun onEvent(event: JSONObject)
    fun onStatus(connected: Boolean, detail: String? = null)
}

object BackendClient {
    const val DEFAULT_BASE_URL = "https://tege-new.onrender.com"
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()
    private val client = OkHttpClient.Builder()
        .connectTimeout(12, TimeUnit.SECONDS)
        .readTimeout(25, TimeUnit.SECONDS)
        .writeTimeout(25, TimeUnit.SECONDS)
        .build()
    private val webSocketClient = client.newBuilder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private fun createDeviceProof(context: Context, email: String): JSONObject? = runCatching {
        val alias = "tege.security.device.key.v1"
        val keyStore = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        if (!keyStore.containsAlias(alias)) {
            val generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, "AndroidKeyStore")
            generator.initialize(
                KeyGenParameterSpec.Builder(alias, KeyProperties.PURPOSE_SIGN or KeyProperties.PURPOSE_VERIFY)
                    .setAlgorithmParameterSpec(ECGenParameterSpec("secp256r1"))
                    .setDigests(KeyProperties.DIGEST_SHA256)
                    .build()
            )
            generator.generateKeyPair()
        }
        val privateKey = keyStore.getKey(alias, null) as java.security.PrivateKey
        val publicKey = keyStore.getCertificate(alias).publicKey
        val publicKeyBytes = publicKey.encoded
        val deviceId = MessageDigest.getInstance("SHA-256").digest(publicKeyBytes)
            .joinToString("") { byte -> "%02x".format(byte) }
        val nonce = UUID.randomUUID().toString()
        val timestamp = System.currentTimeMillis()
        val signedPayload = "${'$'}email:${'$'}nonce:${'$'}timestamp"
        val signer = Signature.getInstance("SHA256withECDSA")
        signer.initSign(privateKey)
        signer.update(signedPayload.toByteArray(Charsets.UTF_8))
        val signature = signer.sign()
        val proof = JSONObject()
            .put("publicKey", Base64.encodeToString(publicKeyBytes, Base64.NO_WRAP))
            .put("nonce", nonce)
            .put("timestamp", timestamp)
            .put("signature", Base64.encodeToString(signature, Base64.NO_WRAP))
        JSONObject().put("deviceId", deviceId).put("proof", proof)
    }.getOrNull()
    fun normalizeBaseUrl(input: String): String? {
        var candidate = input.trim().trimEnd('/')
        if (candidate.isBlank()) candidate = DEFAULT_BASE_URL
        if (!candidate.startsWith("https://", true) && !candidate.startsWith("http://", true)) {
            candidate = "https://$candidate"
        }
        val match = Regex(
            "^(https?)://([^/\\s:?#]+)(?::([0-9]{1,5}))?$",
            RegexOption.IGNORE_CASE
        ).matchEntire(candidate) ?: return null
        val scheme = match.groupValues[1].lowercase()
        val host = match.groupValues[2].lowercase()
        val port = match.groupValues[3].toIntOrNull()
        if (port != null && port !in 1..65535) return null

        // Never send credentials or session tokens to an arbitrary plaintext HTTP host.
        // Cleartext is permitted only for local development endpoints.
        if (scheme == "http" && host !in setOf("localhost", "127.0.0.1", "10.0.2.2")) {
            return null
        }
        return "${scheme}://${host}" + if (port != null) ":$port" else ""
    }

    suspend fun authenticate(
        baseUrl: String,
        register: Boolean,
        email: String,
        password: String,
        name: String = "",
        username: String = "",
        context: Context? = null
    ): AuthResponse = withContext(Dispatchers.IO) {
        val normalizedUrl = normalizeBaseUrl(baseUrl)
            ?: return@withContext AuthResponse(error = "bad_server_url")
        val deviceProof = context?.let { createDeviceProof(it, email.trim().lowercase()) }
        val deviceId = deviceProof?.optString("deviceId").orEmpty()
        val deviceInfo = JSONObject()
            .put("platform", "android")
            .put("manufacturer", Build.MANUFACTURER.take(80))
            .put("model", Build.MODEL.take(100))
            .put("androidSdk", Build.VERSION.SDK_INT)
            .put("appVersion", "1.0.0")
        val body = JSONObject()
            .put("email", email.trim())
            .put("password", password)
            .put("device", "Tege Android")
            .put("deviceId", deviceId)
            .put("deviceInfo", deviceInfo)
        if (deviceProof != null) body.put("deviceProof", deviceProof.optJSONObject("proof"))
        if (register) {
            body.put("name", name.trim())
            if (username.isNotBlank()) body.put("username", username.trim().removePrefix("@"))
        }

        val path = if (register) "register" else "login"
        val request = Request.Builder()
            .url("$normalizedUrl/api/$path")
            .post(body.toString().toRequestBody(jsonMediaType))
            .build()

        try {
            client.newCall(request).execute().use { response ->
                val parsed = JSONObject(response.body?.string().orEmpty().ifBlank { "{}" })
                if (!response.isSuccessful || !parsed.optBoolean("ok")) {
                    AuthResponse(error = parsed.optString("error").takeIf { it.isNotBlank() } ?: "server_error")
                } else if (parsed.optBoolean("requiresTwoFactor")) {
                    AuthResponse(error = "two_factor_not_supported", requiresTwoFactor = true)
                } else {
                    AuthResponse(user = parsed.optJSONObject("user"), error = null)
                }
            }
        } catch (_: Exception) {
            AuthResponse(error = "connection_failed")
        }
    }

    fun connect(baseUrl: String, token: String, listener: TegeSocketListener): WebSocket? {
        val normalizedUrl = normalizeBaseUrl(baseUrl) ?: return null
        val wsScheme = if (normalizedUrl.startsWith("https://")) "wss://" else "ws://"
        val hostAndPath = normalizedUrl.substringAfter("://")
        val url = "$wsScheme$hostAndPath/ws?token=$token"
        val request = Request.Builder().url(url).build()
        return webSocketClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: okhttp3.Response) {
                listener.onStatus(true)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                runCatching { JSONObject(text) }.getOrNull()?.let(listener::onEvent)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                listener.onStatus(false, reason.takeIf { it.isNotBlank() })
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
                listener.onStatus(false, t.message)
            }
        })
    }

    fun sendDirectMessage(
        socket: WebSocket?,
        chatId: Long,
        targetUserId: Long,
        messageId: Long,
        text: String,
        time: String,
        replyToId: Long? = null,
        replyToName: String? = null,
        replyToText: String? = null
    ): Boolean {
        socket ?: return false
        val message = JSONObject()
            .put("id", messageId)
            .put("text", text)
            .put("time", time)
            .put("isMine", true)
        if (replyToId != null) {
            message.put("replyTo", JSONObject()
                .put("id", replyToId)
                .put("senderName", replyToName.orEmpty())
                .put("text", replyToText.orEmpty()))
        }
        val payload = JSONObject()
            .put("id", messageId)
            .put("chatId", chatId)
            .put("chatType", "direct")
            .put("toUserId", targetUserId)
            .put("message", message)
        return socket.send(JSONObject().put("type", "send").put("payload", payload).toString())
    }

    fun sendDirectAction(
        socket: WebSocket?,
        chatId: Long,
        targetUserId: Long,
        action: String,
        targetMessageId: Long,
        text: String = "",
        time: String
    ): Boolean {
        socket ?: return false
        if (action != "edit" && action != "delete") return false
        val message = JSONObject()
            .put("id", System.currentTimeMillis())
            .put("text", text)
            .put("time", time)
        val payload = JSONObject()
            .put("id", System.currentTimeMillis())
            .put("chatId", chatId)
            .put("chatType", "direct")
            .put("toUserId", targetUserId)
            .put("action", action)
            .put("targetId", targetMessageId)
            .put("message", message)
        return socket.send(JSONObject().put("type", "send").put("payload", payload).toString())
    }

    fun acknowledge(socket: WebSocket?, deliveryId: String) {
        if (deliveryId.isBlank()) return
        socket?.send(JSONObject().put("type", "ack")
            .put("ids", org.json.JSONArray().put(deliveryId)).toString())
    }

    fun updateProfile(socket: WebSocket?, name: String, username: String, bio: String, phone: String): Boolean {
        socket ?: return false
        val user = JSONObject()
            .put("name", name)
            .put("username", username)
            .put("bio", bio)
            .put("phone", phone)
        return socket.send(JSONObject().put("type", "profile").put("user", user).toString())
    }
}
