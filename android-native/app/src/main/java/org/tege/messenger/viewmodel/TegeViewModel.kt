package org.tege.messenger.viewmodel

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import okhttp3.WebSocket
import org.tege.messenger.service.BackendClient
import org.tege.messenger.service.TegeSocketListener
import org.tege.messenger.data.SampleData
import org.tege.messenger.model.*
import org.tege.messenger.service.StreakManager
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.*

class TegeViewModel(application: Application) : AndroidViewModel(application) {
    private val chatPrefs = application.getSharedPreferences("tege_local_chats", Context.MODE_PRIVATE)
    private val persistedChatsKey = "chats_json"
    private fun chatStorageKey(accountId: Long? = _currentAccount.value?.id): String =
        persistedChatsKey + "_" + (accountId?.toString() ?: "device")
    private val profilePrefs = application.getSharedPreferences("tege_local_profile", Context.MODE_PRIVATE)
    private val settingsPrefs = application.getSharedPreferences("tege_local_settings", Context.MODE_PRIVATE)

    private fun loadLocalAccount(): UserAccount? {
        // A saved display name is not an authenticated account. Restore only a server session.
        if (profilePrefs.getString("auth_token", null).isNullOrBlank()) return null
        val name = profilePrefs.getString("name", null)?.trim().orEmpty()
        if (name.isBlank()) return null
        return UserAccount(
            id = profilePrefs.getLong("id", 0L),
            email = profilePrefs.getString("email", "").orEmpty(),
            name = name,
            username = profilePrefs.getString("username", "").orEmpty(),
            bio = profilePrefs.getString("bio", "").orEmpty(),
            phone = profilePrefs.getString("phone", "").orEmpty(),
            country = profilePrefs.getString("country", "").orEmpty(),
            registrationDate = profilePrefs.getString("created_at", "").orEmpty(),
            avatarUri = profilePrefs.getString("avatar_uri", null),
            isOnline = false
        )
    }

    private val savedLocalAccount: UserAccount? = loadLocalAccount()

    private fun persistLocalAccount(account: UserAccount?) {
        val editor = profilePrefs.edit()
        if (account == null) editor.clear().apply()
        else editor.putLong("id", account.id)
            .putString("email", account.email)
            .putString("name", account.name)
            .putString("username", account.username)
            .putString("bio", account.bio)
            .putString("phone", account.phone)
            .putString("country", account.country)
            .putString("avatar_uri", account.avatarUri)
            .putString("created_at", account.registrationDate)
            .apply()
    }

    private fun loadAppSettings(): AppSettings {
        val defaultWallpaper = WallpaperId.PATTERN.name
        val wallpaper = runCatching {
            WallpaperId.valueOf(settingsPrefs.getString("wallpaper", defaultWallpaper) ?: defaultWallpaper)
        }.getOrDefault(WallpaperId.PATTERN)
        val defaultTextSize = TextSize.MEDIUM.name
        val textSize = runCatching {
            TextSize.valueOf(settingsPrefs.getString("text_size", defaultTextSize) ?: defaultTextSize)
        }.getOrDefault(TextSize.MEDIUM)
        val defaultLanguage = Language.RU.name
        val language = runCatching {
            Language.valueOf(settingsPrefs.getString("language", defaultLanguage) ?: defaultLanguage)
        }.getOrDefault(Language.RU)
        return AppSettings(
            isDarkMode = settingsPrefs.getBoolean("dark_mode", false),
            wallpaper = wallpaper,
            textSize = textSize,
            language = language,
            soundEnabled = settingsPrefs.getBoolean("sound_enabled", true),
            notificationsEnabled = settingsPrefs.getBoolean("notifications_enabled", true),
            lastSeenPrivacy = settingsPrefs.getString("last_seen_privacy", "everyone") ?: "everyone",
            photoPrivacy = settingsPrefs.getString("photo_privacy", "everyone") ?: "everyone",
            animationsEnabled = settingsPrefs.getBoolean("animations_enabled", true)
        )
    }

    private fun persistAppSettings(settings: AppSettings) {
        settingsPrefs.edit()
            .putBoolean("dark_mode", settings.isDarkMode)
            .putString("wallpaper", settings.wallpaper.name)
            .putString("text_size", settings.textSize.name)
            .putString("language", settings.language.name)
            .putBoolean("sound_enabled", settings.soundEnabled)
            .putBoolean("notifications_enabled", settings.notificationsEnabled)
            .putString("last_seen_privacy", settings.lastSeenPrivacy)
            .putString("photo_privacy", settings.photoPrivacy)
            .putBoolean("animations_enabled", settings.animationsEnabled)
            .apply()
    }

    private fun persistChats(chats: List<Chat>) {
        try {
            val array = JSONArray()
            chats.forEach { chat ->
                val item = JSONObject().put("id", chat.id).put("type", chat.type.name)
                    .put("name", chat.name).put("description", chat.description)
                    .put("lastMessage", chat.lastMessage).put("time", chat.time)
                    .put("unread", chat.unread).put("isPinned", chat.isPinned)
                    .put("isMuted", chat.isMuted).put("isArchived", chat.isArchived).put("online", chat.online)
                    .put("color", chat.color).put("isSavedMessages", chat.isSavedMessages)
                chat.userId?.let { item.put("userId", it) }
                chat.avatarUri?.let { item.put("avatarUri", it) }
                chat.username?.let { item.put("username", it) }
                item.put("subscribersCount", chat.subscribersCount)
                val messages = JSONArray()
                chat.messages.forEach { message ->
                    val m = JSONObject().put("id", message.id).put("text", message.text)
                        .put("time", message.time).put("isMine", message.isMine)
                        .put("isVoice", message.isVoice).put("isPinned", message.isPinned)
                        .put("isSystemBotMessage", message.isSystemBotMessage).put("views", message.views)
                    listOf(
                        "attachmentUri" to message.attachmentUri, "videoUri" to message.videoUri,
                        "videoNoteUri" to message.videoNoteUri, "audioUri" to message.audioUri,
                        "voiceDuration" to message.voiceDuration, "fileName" to message.fileName,
                        "fileSize" to message.fileSize, "senderName" to message.senderName
                    ).forEach { (key, value) -> if (value != null) m.put(key, value) }
                    message.senderId?.let { m.put("senderId", it) }
                    val reactions = JSONObject()
                    message.reactions.forEach { (emoji, count) -> reactions.put(emoji, count) }
                    m.put("reactions", reactions)
                    val userReactions = JSONObject()
                    message.userReactions.forEach { (userId, emoji) -> userReactions.put(userId.toString(), emoji) }
                    m.put("userReactions", userReactions)
                    message.replyTo?.let { reply -> m.put("replyTo", JSONObject()
                        .put("id", reply.id).put("senderName", reply.senderName).put("text", reply.text)) }
                    message.poll?.let { poll ->
                        val options = JSONArray()
                        poll.options.forEach { option ->
                            val voters = JSONArray()
                            option.votedUserIds.forEach { voters.put(it) }
                            options.put(JSONObject().put("id", option.id).put("text", option.text)
                                .put("votes", option.votes).put("votedUserIds", voters))
                        }
                        m.put("poll", JSONObject().put("question", poll.question).put("options", options)
                            .put("totalVotes", poll.totalVotes).put("isClosed", poll.isClosed)
                            .put("allowsMultiple", poll.allowsMultiple))
                    }
                    messages.put(m)
                }
                item.put("messages", messages)
                array.put(item)
            }
            chatPrefs.edit().putString(chatStorageKey(), array.toString()).apply()
        } catch (_: Exception) {
            // A storage failure must not crash the chat UI.
        }
    }


    private fun restoreChats(savedOverride: String? = null, useOverride: Boolean = false) {
        val saved = if (useOverride) savedOverride else chatPrefs.getString(chatStorageKey(), null)
        if (saved == null) return
        try {
            val array = JSONArray(saved)
            val restoredById = (0 until array.length()).associate { index ->
                val item = array.getJSONObject(index)
                val messagesJson = item.optJSONArray("messages") ?: JSONArray()
                val messages = (0 until messagesJson.length()).map { messageIndex ->
                    val m = messagesJson.getJSONObject(messageIndex)
                    val reactionsJson = m.optJSONObject("reactions") ?: JSONObject()
                    val reactions = reactionsJson.keys().asSequence().associateWith { reactionsJson.optInt(it) }
                    val userReactionsJson = m.optJSONObject("userReactions") ?: JSONObject()
                    val userReactions = userReactionsJson.keys().asSequence().mapNotNull { key ->
                        key.toLongOrNull()?.let { it to userReactionsJson.optString(key) }
                    }.toMap()
                    val replyJson = m.optJSONObject("replyTo")
                    val reply = replyJson?.let { MessageReplyInfo(it.optLong("id"), it.optString("senderName"), it.optString("text")) }
                    val pollJson = m.optJSONObject("poll")
                    val poll = pollJson?.let { p ->
                        val optionsJson = p.optJSONArray("options") ?: JSONArray()
                        val options = (0 until optionsJson.length()).map { optionIndex ->
                            val option = optionsJson.getJSONObject(optionIndex)
                            val voters = option.optJSONArray("votedUserIds") ?: JSONArray()
                            PollOption(option.optInt("id"), option.optString("text"), option.optInt("votes"),
                                (0 until voters.length()).map { voters.optLong(it) })
                        }
                        Poll(p.optString("question"), options, p.optInt("totalVotes"), p.optBoolean("isClosed"), p.optBoolean("allowsMultiple"))
                    }
                    Message(
                        id = m.optLong("id"), text = m.optString("text"), time = m.optString("time"),
                        isMine = m.optBoolean("isMine"),
                        attachmentUri = m.optString("attachmentUri").takeIf { m.has("attachmentUri") },
                        videoUri = m.optString("videoUri").takeIf { m.has("videoUri") },
                        videoNoteUri = m.optString("videoNoteUri").takeIf { m.has("videoNoteUri") },
                        audioUri = m.optString("audioUri").takeIf { m.has("audioUri") },
                        isVoice = m.optBoolean("isVoice"),
                        voiceDuration = m.optString("voiceDuration").takeIf { m.has("voiceDuration") },
                        fileName = m.optString("fileName").takeIf { m.has("fileName") },
                        fileSize = m.optString("fileSize").takeIf { m.has("fileSize") },
                        senderId = if (m.has("senderId")) m.optLong("senderId") else null,
                        senderName = m.optString("senderName").takeIf { m.has("senderName") },
                        isSystemBotMessage = m.optBoolean("isSystemBotMessage", false),
                        isPinned = m.optBoolean("isPinned"), views = m.optInt("views", 0),
                        reactions = reactions, userReactions = userReactions, replyTo = reply, poll = poll
                    )
                }
                val restoredId = if (item.optBoolean("isSavedMessages", false)) {
                    SampleData.SAVED_MESSAGES_CHAT_ID
                } else {
                    item.optLong("id")
                }
                restoredId to (item to messages)
            }
            // Never delete a user's local conversation based on its display name or message text.
            // The initial state contains no demo conversations; legacy user data is preserved.
            val cleanRestoredById = restoredById

            val existingIds = _chats.value.map { it.id }.toSet()
            val restoredDrafts = cleanRestoredById.filterKeys { it !in existingIds }.map { (id, savedEntry) ->
                val item = savedEntry.first
                val restoredType = runCatching {
                    ChatType.valueOf(item.optString("type", ChatType.DIRECT.name))
                }.getOrDefault(ChatType.DIRECT)
                Chat(
                    id = id,
                    type = restoredType,
                    userId = item.optLong("userId").takeIf { it > 0L },
                    name = item.optString("name", "Локальный черновик"),
                    username = item.optString("username").takeIf { it.isNotBlank() },
                    avatarUri = item.optString("avatarUri").takeIf { it.isNotBlank() },
                    description = item.optString("description", "Локальный черновик"),
                    lastMessage = item.optString("lastMessage"),
                    time = item.optString("time"),
                    unread = item.optInt("unread", 0),
                    online = item.optBoolean("online", false),
                    color = item.optString("color", "#2AABEE"),
                    messages = savedEntry.second,
                    isSavedMessages = item.optBoolean("isSavedMessages", false),
                    isPinned = item.optBoolean("isPinned", false),
                    isMuted = item.optBoolean("isMuted", false),
                    isArchived = item.optBoolean("isArchived", false),
                    subscribersCount = item.optInt("subscribersCount", 0)
                )
            }
            val restoredInitial = _chats.value.map { chat ->
                val savedEntry = cleanRestoredById[chat.id] ?: return@map chat
                val item = savedEntry.first
                chat.copy(lastMessage = item.optString("lastMessage", chat.lastMessage),
                    time = item.optString("time", chat.time), unread = item.optInt("unread", chat.unread),
                    isPinned = item.optBoolean("isPinned", chat.isPinned),
                    isMuted = item.optBoolean("isMuted", chat.isMuted),
                    isArchived = item.optBoolean("isArchived", chat.isArchived),
                    messages = savedEntry.second)
            }
            _chats.value = restoredDrafts + restoredInitial
        } catch (_: Exception) {
            // Ignore corrupted or outdated local data and keep the initial local chat list.
        }
    }

    private val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())

    private val _accounts = MutableStateFlow(savedLocalAccount?.let { listOf(it) } ?: emptyList())
    val accounts: StateFlow<List<UserAccount>> = _accounts.asStateFlow()

    private val _currentAccount = MutableStateFlow<UserAccount?>(savedLocalAccount)
    val currentAccount: StateFlow<UserAccount?> = _currentAccount.asStateFlow()

    private val _settings = MutableStateFlow(loadAppSettings())
    val settings: StateFlow<AppSettings> = _settings.asStateFlow()

    private val _chats = MutableStateFlow<List<Chat>>(SampleData.getInitialChats())
    val chats: StateFlow<List<Chat>> = _chats.asStateFlow()

    private val _channels = MutableStateFlow<List<Channel>>(SampleData.defaultChannels)
    val channels: StateFlow<List<Channel>> = _channels.asStateFlow()

    private val _stories = MutableStateFlow<List<Story>>(SampleData.defaultStories)
    val stories: StateFlow<List<Story>> = _stories.asStateFlow()

    private val _currentRoute = MutableStateFlow<ScreenRoute>(ScreenRoute.ChatList)
    val currentRoute: StateFlow<ScreenRoute> = _currentRoute.asStateFlow()

    private val _searchQuery = MutableStateFlow("")
    val searchQuery: StateFlow<String> = _searchQuery.asStateFlow()

    private val _contacts = MutableStateFlow<List<ContactUser>>(emptyList())
    val contacts: StateFlow<List<ContactUser>> = _contacts.asStateFlow()
    private val _connectionState = MutableStateFlow("Не подключено")
    val connectionState: StateFlow<String> = _connectionState.asStateFlow()
    private val _messageError = MutableStateFlow<String?>(null)
    val messageError: StateFlow<String?> = _messageError.asStateFlow()

    private var activeSocket: WebSocket? = null
    private var reconnectScheduled = false
    private val savedServerUrl: String
        get() = profilePrefs.getString("api_base_url", BackendClient.DEFAULT_BASE_URL)
            ?: BackendClient.DEFAULT_BASE_URL
    private val savedToken: String?
        get() = profilePrefs.getString("auth_token", null)?.takeIf { it.isNotBlank() }

    init {
        restoreChats()
        viewModelScope.launch { _chats.collect { chats -> persistChats(chats) } }
        val token = savedToken
        if (token != null && savedLocalAccount != null) connectToServer(savedServerUrl, token)
    }

    suspend fun authenticate(
        serverUrl: String,
        email: String,
        password: String,
        displayName: String,
        username: String,
        register: Boolean
    ): String? {
        val normalizedUrl = BackendClient.normalizeBaseUrl(serverUrl)
            ?: return "Укажи адрес сервера в формате https://example.com"
        if (email.isBlank() || password.isBlank()) return "Введи почту и пароль"
        if (register && displayName.isBlank()) return "Введи имя"
        val result = BackendClient.authenticate(
            normalizedUrl, register, email, password, displayName, username
        )
        val json = result.user
        if (json == null) return authErrorText(result.error, result.requiresTwoFactor)
        val token = json.optString("token")
        if (token.isBlank()) return "Сервер не вернул токен сессии. Попробуй ещё раз."

        val account = UserAccount(
            id = json.optLong("id"),
            email = json.optString("email", email.trim()),
            name = json.optString("name", displayName.trim()),
            username = json.optString("username").removePrefix("@"),
            bio = json.optString("bio"),
            phone = json.optString("phone"),
            country = json.optString("country"),
            registrationDate = json.optString("registrationDate"),
            avatarUri = json.optString("avatarUri").takeIf { it.isNotBlank() },
            isOnline = true
        )
        val accountChats = chatPrefs.getString(chatStorageKey(account.id), null)
        profilePrefs.edit()
            .putString("auth_token", token)
            .putString("api_base_url", normalizedUrl)
            .apply()
        activeSocket?.close(1000, "New session")
        _accounts.value = listOf(account)
        _currentAccount.value = account
        persistLocalAccount(account)
        // Each server account gets an isolated local history; never leak one account's chats into another.
        _chats.value = SampleData.getInitialChats()
        restoreChats(accountChats, useOverride = true)
        _connectionState.value = "Подключение…"
        connectToServer(normalizedUrl, token)
        return null
    }

    private fun authErrorText(error: String?, twoFactor: Boolean = false): String = when {
        twoFactor || error == "two_factor_not_supported" ->
            "Для аккаунта с облачным паролем вход в Android пока не поддерживается."
        error == "bad_server_url" -> "Неверный адрес сервера."
        error == "bad_email" -> "Проверь адрес электронной почты."
        error == "short_password" -> "Пароль должен содержать не меньше 7 символов."
        error == "no_name" -> "Введи имя."
        error == "email_taken" -> "Этот адрес уже зарегистрирован. Войди в аккаунт."
        error == "username_taken" -> "Это имя пользователя уже занято."
        error == "bad_username" -> "Username должен содержать 3–32 символа: латиницу, цифры или подчёркивание."
        error == "bad_credentials" -> "Неверная почта или пароль."
        error == "too_many_requests" -> "Слишком много попыток. Попробуй позже."
        error == "connection_failed" -> "Не удалось связаться с сервером. Проверь адрес и интернет."
        else -> "Не удалось выполнить вход. Проверь данные и попробуй ещё раз."
    }

    private fun connectToServer(baseUrl: String, token: String) {
        _connectionState.value = "Подключение…"
        val socket = BackendClient.connect(baseUrl, token, object : TegeSocketListener {
            override fun onStatus(connected: Boolean, detail: String?) {
                _connectionState.value = if (connected) "Соединение установлено" else "Нет соединения"
                if (!connected && savedToken == token && !reconnectScheduled) {
                    reconnectScheduled = true
                    viewModelScope.launch {
                        delay(3_000)
                        reconnectScheduled = false
                        if (savedToken == token) connectToServer(baseUrl, token)
                    }
                }
            }

            override fun onEvent(event: JSONObject) {
                handleServerEvent(event)
            }
        })
        if (socket == null) {
            _connectionState.value = "Неверный адрес сервера"
        } else {
            activeSocket = socket
        }
    }

    private fun handleServerEvent(event: JSONObject) {
        when (event.optString("type")) {
            "snapshot" -> {
                val users = event.optJSONArray("users") ?: JSONArray()
                val selfId = _currentAccount.value?.id
                _contacts.value = (0 until users.length()).mapNotNull { index ->
                    val user = users.optJSONObject(index) ?: return@mapNotNull null
                    val id = user.optLong("id")
                    if (id == 0L || id == selfId) return@mapNotNull null
                    ContactUser(
                        id = id,
                        name = user.optString("name", "Пользователь"),
                        username = user.optString("username"),
                        bio = user.optString("bio"),
                        phone = user.optString("phone"),
                        country = user.optString("country"),
                        registrationDate = user.optString("registrationDate"),
                        online = user.optBoolean("online"),
                        avatarUri = user.optString("avatarUri").takeIf { it.isNotBlank() }
                    )
                }.sortedBy { it.name.lowercase(Locale.ROOT) }
                _connectionState.value = "Подключено"
            }
            "user_upsert" -> {
                val user = event.optJSONObject("user") ?: return
                val id = user.optLong("id")
                if (id == 0L) return
                if (id == _currentAccount.value?.id) {
                    val current = _currentAccount.value ?: return
                    val updated = current.copy(
                        name = user.optString("name", current.name),
                        username = user.optString("username", current.username).removePrefix("@"),
                        bio = user.optString("bio", current.bio),
                        phone = user.optString("phone", current.phone),
                        country = user.optString("country", current.country),
                        avatarUri = user.optString("avatarUri").takeIf { it.isNotBlank() },
                        isOnline = user.optBoolean("online")
                    )
                    _currentAccount.value = updated
                    _accounts.value = listOf(updated)
                    persistLocalAccount(updated)
                    return
                }
                val contact = ContactUser(
                    id = id, name = user.optString("name", "Пользователь"),
                    username = user.optString("username"), bio = user.optString("bio"),
                    phone = user.optString("phone"), country = user.optString("country"),
                    registrationDate = user.optString("registrationDate"),
                    online = user.optBoolean("online"),
                    avatarUri = user.optString("avatarUri").takeIf { it.isNotBlank() }
                )
                _contacts.value = (_contacts.value.filterNot { it.id == id } + contact)
                    .sortedBy { it.name.lowercase(Locale.ROOT) }
            }
            "presence" -> {
                val id = event.optLong("userId")
                val online = event.optBoolean("online")
                _contacts.value = _contacts.value.map { if (it.id == id) it.copy(online = online) else it }
                _chats.value = _chats.value.map { if (it.userId == id) it.copy(online = online) else it }
            }
            "message" -> handleIncomingMessage(event.optJSONObject("payload") ?: return)
            "profile_result" -> {
                if (!event.optBoolean("ok", true) && event.optString("error") == "username_taken") {
                    _messageError.value = "Username занят. Сервер сохранил остальные изменения профиля, а username оставил прежним."
                }
            }
            "send_result" -> {
                if (!event.optBoolean("ok", true)) {
                    val id = event.optLong("id", -1L)
                    val reason = when (event.optString("reason")) {
                        "no_user" -> "Пользователь не найден."
                        "blocked" -> "Пользователь ограничил получение сообщений."
                        "self" -> "Нельзя отправить сообщение самому себе."
                        "forbidden" -> "У тебя нет прав писать в этот канал."
                        else -> "Сервер не принял сообщение. Попробуй ещё раз."
                    }
                    if (id > 0L) {
                        _chats.value = _chats.value.map { chat ->
                            if (chat.messages.any { it.id == id && it.isMine }) {
                                val updated = chat.messages.filterNot { it.id == id && it.isMine }
                                val last = updated.lastOrNull()
                                chat.copy(messages = updated, lastMessage = last?.text.orEmpty(), time = last?.time.orEmpty())
                            } else chat
                        }
                    }
                    _messageError.value = reason
                }
            }
            "auth_error" -> {
                activeSocket?.close(1000, "Authentication expired")
                activeSocket = null
                profilePrefs.edit().remove("auth_token").apply()
                _currentAccount.value = null
                _accounts.value = emptyList()
                _contacts.value = emptyList()
                _connectionState.value = "Сессия завершена — войди снова"
            }
        }
    }

    private fun handleIncomingMessage(payload: JSONObject) {
        if (payload.optString("chatType", "direct") != "direct") return
        val sender = payload.optJSONObject("fromUser") ?: return
        val senderId = sender.optLong("id")
        val ownId = _currentAccount.value?.id ?: return
        if (senderId == 0L || senderId == ownId) return
        val chatId = payload.optLong("chatId")
        if (chatId == 0L) return
        val messageJson = payload.optJSONObject("message") ?: return
        val action = payload.optString("action")
        if (action == "edit" || action == "delete") {
            val targetId = payload.optLong("targetId")
            _chats.value = _chats.value.map { chat ->
                if (chat.id != chatId) return@map chat
                val updated = if (action == "delete") {
                    chat.messages.filterNot { it.id == targetId }
                } else {
                    chat.messages.map { message ->
                        if (message.id == targetId) message.copy(
                            text = messageJson.optString("text"),
                            time = messageJson.optString("time", message.time)
                        ) else message
                    }
                }
                val last = updated.lastOrNull()
                chat.copy(
                    messages = updated,
                    lastMessage = last?.text.orEmpty(),
                    time = last?.time.orEmpty()
                )
            }
            BackendClient.acknowledge(activeSocket, payload.optString("deliveryId"))
            return
        }
        val messageId = messageJson.optLong("id", System.currentTimeMillis())
        val replyJson = messageJson.optJSONObject("replyTo")
        val incoming = Message(
            id = messageId,
            text = messageJson.optString("text"),
            time = messageJson.optString("time", timeFormat.format(Date())),
            isMine = false,
            senderId = senderId,
            senderName = sender.optString("name", "Пользователь"),
            replyTo = replyJson?.let {
                MessageReplyInfo(it.optLong("id"), it.optString("senderName"), it.optString("text"))
            }
        )
        val currentRoute = _currentRoute.value
        _chats.value = _chats.value.toMutableList().let { current ->
            val index = current.indexOfFirst { it.id == chatId }
            if (index >= 0) {
                val chat = current[index]
                if (chat.messages.any { it.id == messageId }) return@let current
                current[index] = chat.copy(
                    lastMessage = incoming.text,
                    time = incoming.time,
                    messages = chat.messages + incoming,
                    unread = if (currentRoute == ScreenRoute.ChatDetail(chatId)) 0 else chat.unread + 1,
                    online = true
                )
            } else {
                val name = sender.optString("name", "Пользователь")
                current.add(0, Chat(
                    id = chatId, type = ChatType.DIRECT, userId = senderId,
                    name = name, username = sender.optString("username"),
                    description = sender.optString("bio"), lastMessage = incoming.text,
                    time = incoming.time, unread = if (currentRoute == ScreenRoute.ChatDetail(chatId)) 0 else 1,
                    online = true, avatarUri = sender.optString("avatarUri").takeIf { it.isNotBlank() },
                    messages = listOf(incoming)
                ))
            }
            current
        }
        BackendClient.acknowledge(activeSocket, payload.optString("deliveryId"))
    }

    fun clearMessageError() {
        _messageError.value = null
    }

    fun reconnect() {
        val token = savedToken ?: run {
            _connectionState.value = "Сначала войди в аккаунт"
            return
        }
        activeSocket?.cancel()
        connectToServer(savedServerUrl, token)
    }

    fun openDirectChat(contact: ContactUser): Long {
        val accountId = _currentAccount.value?.id ?: return -1L
        if (contact.id == accountId) return -1L
        val low = minOf(accountId, contact.id)
        val high = maxOf(accountId, contact.id)
        val chatId = low * 1_000_000_000L + high
        val existing = _chats.value.firstOrNull { it.id == chatId || it.userId == contact.id }
        val chat = existing ?: Chat(
            id = chatId, type = ChatType.DIRECT, userId = contact.id,
            username = contact.username, name = contact.name, description = contact.bio,
            lastMessage = "", time = "", unread = 0, online = contact.online,
            avatarUri = contact.avatarUri, color = "#2AABEE", messages = emptyList()
        )
        if (existing == null) _chats.value = listOf(chat) + _chats.value
        _currentRoute.value = ScreenRoute.ChatDetail(chat.id)
        return chat.id
    }

    fun navigateTo(route: ScreenRoute) {
        _currentRoute.value = route
    }

    fun navigateBack() {
        _currentRoute.value = ScreenRoute.ChatList
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
    }

    fun createLocalChat(title: String): Long? {
        val cleanTitle = title.trim()
        if (cleanTitle.isBlank()) return null
        val normalizedQuery = cleanTitle.removePrefix("@").trim()
        val contact = _contacts.value.firstOrNull { user ->
            user.name.equals(normalizedQuery, ignoreCase = true) ||
                user.username.equals(normalizedQuery, ignoreCase = true) ||
                user.username.removePrefix("@").equals(normalizedQuery, ignoreCase = true)
        }
        if (contact == null) {
            _messageError.value = "Пользователь не найден на сервере. Создать фальшивый диалог нельзя."
            return null
        }
        val existing = _chats.value.firstOrNull { !it.isSavedMessages && it.userId == contact.id }
        if (existing != null) {
            _currentRoute.value = ScreenRoute.ChatDetail(existing.id)
            return existing.id
        }
        val chat = Chat(
            id = contact.id,
            type = ChatType.DIRECT,
            userId = contact.id,
            username = contact.username,
            name = contact.name,
            description = contact.bio,
            lastMessage = "",
            time = "",
            unread = 0,
            online = contact.online,
            color = contact.color,
            avatarUri = contact.avatarUri,
            messages = emptyList()
        )
        _chats.value = listOf(chat) + _chats.value
        _currentRoute.value = ScreenRoute.ChatDetail(chat.id)
        return chat.id
    }

    fun clearChatHistory(chatId: Long) {
        _chats.value = _chats.value.map { chat ->
            if (chat.id == chatId) {
                chat.copy(messages = emptyList(), lastMessage = "", unread = 0)
            } else {
                chat
            }
        }
    }

    fun toggleChatPin(chatId: Long) {
        _chats.value = _chats.value.map { chat ->
            if (chat.id == chatId) chat.copy(isPinned = !chat.isPinned) else chat
        }
    }

    /** Mute or unmute notifications for a single chat locally. */
    fun toggleChatMute(chatId: Long) {
        _chats.value = _chats.value.map { chat ->
            if (chat.id == chatId) chat.copy(isMuted = !chat.isMuted) else chat
        }
    }

    /** Move a chat into or out of the local archive. The state survives app restarts. */
    fun toggleChatArchived(chatId: Long) {
        _chats.value = _chats.value.map { chat ->
            if (chat.id == chatId) chat.copy(isArchived = !chat.isArchived) else chat
        }
    }

    /** Mark the currently opened chat as read in local app state. */
    fun markChatRead(chatId: Long) {
        _chats.value = _chats.value.map { chat ->
            if (chat.id == chatId && chat.unread != 0) chat.copy(unread = 0) else chat
        }
    }

    /** Mark a chat as unread locally and keep it visible in the unread filter. */
    fun markChatUnread(chatId: Long) {
        _chats.value = _chats.value.map { chat ->
            if (chat.id == chatId) chat.copy(unread = maxOf(chat.unread, 1)) else chat
        }
    }

    /** Adds a locally recorded voice note. It is not uploaded or synced to a server. */
    fun sendVoiceMessage(chatId: Long, localPath: String, durationSeconds: Int) {
        val targetChat = _chats.value.firstOrNull { it.id == chatId } ?: return
        if (!targetChat.isSavedMessages && targetChat.userId != null) {
            _messageError.value = "Голосовые сообщения пока не загружаются на сервер. Запись не отправлена."
            return
        }
        val nowTime = timeFormat.format(Date())
        val duration = "%d:%02d".format(durationSeconds / 60, durationSeconds % 60)
        val message = Message(
            id = System.currentTimeMillis(),
            text = "Голосовое сообщение ($duration)",
            time = nowTime,
            isMine = true,
            audioUri = localPath,
            isVoice = true,
            voiceDuration = duration,
            senderId = _currentAccount.value?.id,
            senderName = _currentAccount.value?.name
        )
        _chats.value = _chats.value.map { chat ->
            if (chat.id == chatId) chat.copy(
                lastMessage = "🎤 Голосовое сообщение ($duration)",
                time = nowTime,
                messages = chat.messages + message
            ) else chat
        }
    }

    fun switchAccount(accountId: Long) {
        _accounts.value.find { it.id == accountId }?.let {
            _currentAccount.value = it
            persistLocalAccount(it)
        }
    }

    fun updateProfile(name: String, username: String, bio: String, phone: String) {
        val current = _currentAccount.value ?: return
        val updated = current.copy(
            name = name.trim().ifBlank { current.name },
            username = username.trim().removePrefix("@").ifBlank { current.username },
            bio = bio.trim(),
            phone = phone.trim()
        )
        if (savedToken != null) {
            val sent = BackendClient.updateProfile(
                activeSocket, updated.name, "@" + updated.username.removePrefix("@"), updated.bio, updated.phone
            )
            if (!sent) _messageError.value = "Нет соединения с сервером. Профиль не отправлен."
            return
        }
        _accounts.value = listOf(updated)
        _currentAccount.value = updated
        persistLocalAccount(updated)
    }

    fun addAccount(name: String, username: String, phone: String) {
        val newAcc = UserAccount(
            id = System.currentTimeMillis(),
            email = "",
            name = name.trim(),
            username = username.trim().removePrefix("@"),
            phone = phone.trim(),
            country = "",
            registrationDate = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault()).format(Date()),
            isOnline = false
        )
        val updated = (_accounts.value + newAcc).take(5)
        _accounts.value = updated
        _currentAccount.value = newAcc
        persistLocalAccount(newAcc)
    }

    fun createLocalProfile(displayName: String): Boolean {
        val cleanName = displayName.trim()
        if (cleanName.isBlank()) return false
        val account = UserAccount(
            id = System.currentTimeMillis(),
            email = "",
            name = cleanName,
            username = "",
            bio = "",
            phone = "",
            country = "",
            registrationDate = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault()).format(Date()),
            isOnline = false
        )
        _accounts.value = (_accounts.value + account).takeLast(5)
        _currentAccount.value = account
        persistLocalAccount(account)
        return true
    }

    fun logout() {
        activeSocket?.close(1000, "Signed out")
        activeSocket = null
        _accounts.value = emptyList()
        _currentAccount.value = null
        _contacts.value = emptyList()
        _connectionState.value = "Не подключено"
        profilePrefs.edit().clear().apply()
        _chats.value = SampleData.getInitialChats()
        _searchQuery.value = ""
    }

    fun sendMessage(chatId: Long, text: String, replyTo: MessageReplyInfo? = null): Boolean {
        if (text.isBlank()) return false
        val chat = _chats.value.firstOrNull { it.id == chatId } ?: return false
        val cleanText = text.trim()
        val nowTime = timeFormat.format(Date())
        val messageId = System.currentTimeMillis()

        // Never turn a device-only draft into a pretend conversation with a real person.
        if (!chat.isSavedMessages && chat.userId == null) {
            _messageError.value = "Это локальный черновик, а не чат с зарегистрированным пользователем. Создайте диалог через поиск пользователей."
            return false
        }
        if (!chat.isSavedMessages) {
            val recipientId = chat.userId ?: return false
            val sent = BackendClient.sendDirectMessage(
                activeSocket, chat.id, recipientId, messageId, cleanText, nowTime,
                replyTo?.id, replyTo?.senderName, replyTo?.text
            )
            if (!sent) {
                _messageError.value = "Нет соединения с сервером. Сообщение не отправлено."
                return false
            }
        }

        val message = Message(
            id = messageId, text = cleanText, time = nowTime, isMine = true,
            senderId = _currentAccount.value?.id, senderName = _currentAccount.value?.name,
            replyTo = replyTo
        )
        _chats.value = _chats.value.map { current ->
            if (current.id == chatId) {
                val updatedStreak = StreakManager.updateStreakOnMessage(current.streak, isMine = true)
                current.copy(
                    lastMessage = cleanText, time = nowTime,
                    messages = current.messages + message, streak = updatedStreak
                )
            } else current
        }
        return true
    }

    /** Edit a message locally or send the edit event to the other account on the server. */
    fun editMessage(chatId: Long, messageId: Long, newText: String): Boolean {
        val text = newText.trim()
        if (text.isBlank()) return false
        val chat = _chats.value.firstOrNull { it.id == chatId } ?: return false
        val target = chat.messages.firstOrNull { it.id == messageId && it.isMine } ?: return false
        val nowTime = timeFormat.format(Date())
        if (!chat.isSavedMessages && chat.userId == null) {
            _messageError.value = "Локальный черновик не является серверным диалогом."
            return false
        }
        if (!chat.isSavedMessages &&
            !BackendClient.sendDirectAction(activeSocket, chat.id, chat.userId ?: return false, "edit", messageId, text, nowTime)
        ) {
            _messageError.value = "Нет соединения с сервером. Изменение не отправлено."
            return false
        }
        _chats.value = _chats.value.map { current ->
            if (current.id != chatId) current else {
                val updatedMessages = current.messages.map { message ->
                    if (message.id == target.id) message.copy(text = text, time = nowTime) else message
                }
                val last = updatedMessages.lastOrNull()
                current.copy(
                    messages = updatedMessages,
                    lastMessage = if (last?.id == messageId) text else current.lastMessage,
                    time = if (last?.id == messageId) nowTime else current.time
                )
            }
        }
        return true
    }

    /** Delete a message locally or notify the other participant when it is a real direct chat. */
    fun deleteMessage(chatId: Long, messageId: Long): Boolean {
        val chat = _chats.value.firstOrNull { it.id == chatId } ?: return false
        val target = chat.messages.find { it.id == messageId && it.isMine } ?: return false
        val nowTime = timeFormat.format(Date())
        if (!chat.isSavedMessages && chat.userId == null) {
            _messageError.value = "Локальный черновик не является серверным диалогом."
            return false
        }
        if (!chat.isSavedMessages &&
            !BackendClient.sendDirectAction(activeSocket, chat.id, chat.userId ?: return false, "delete", messageId, time = nowTime)
        ) {
            _messageError.value = "Нет соединения с сервером. Удаление не отправлено."
            return false
        }
        _chats.value = _chats.value.map { current ->
            if (current.id != chatId) return@map current
            val updatedMessages = current.messages.filterNot { it.id == target.id }
            val last = updatedMessages.lastOrNull()
            current.copy(
                messages = updatedMessages,
                lastMessage = last?.let { if (it.poll != null) "📊 ${it.poll.question}" else it.text }.orEmpty(),
                time = last?.time.orEmpty()
            )
        }
        return true
    }

    fun sendPoll(chatId: Long, question: String, options: List<String>) {
        if (question.isBlank() || options.size < 2) return
        val nowTime = timeFormat.format(Date())
        val poll = Poll(
            question = question,
            options = options.mapIndexed { index, opt ->
                PollOption(id = index + 1, text = opt, votes = 0)
            }
        )
        val message = Message(
            id = System.currentTimeMillis(),
            text = "📊 $question",
            time = nowTime,
            isMine = true,
            poll = poll
        )
        _chats.value = _chats.value.map { chat ->
            if (chat.id == chatId) {
                chat.copy(
                    lastMessage = "📊 Опрос: $question",
                    time = nowTime,
                    messages = chat.messages + message
                )
            } else chat
        }
    }

    fun votePoll(chatId: Long, messageId: Long, optionId: Int) {
        val currentUserId = _currentAccount.value?.id ?: 112201L
        _chats.value = _chats.value.map { chat ->
            if (chat.id == chatId) {
                chat.copy(
                    messages = chat.messages.map { msg ->
                        if (msg.id == messageId && msg.poll != null) {
                            val poll = msg.poll
                            val updatedOptions = poll.options.map { opt ->
                                if (opt.id == optionId) {
                                    val isVoted = opt.votedUserIds.contains(currentUserId)
                                    val newVotes = if (isVoted) opt.votes - 1 else opt.votes + 1
                                    val newUsers = if (isVoted) opt.votedUserIds - currentUserId else opt.votedUserIds + currentUserId
                                    opt.copy(votes = maxOf(0, newVotes), votedUserIds = newUsers)
                                } else opt
                            }
                            msg.copy(poll = poll.copy(options = updatedOptions, totalVotes = updatedOptions.sumOf { it.votes }))
                        } else msg
                    }
                )
            } else chat
        }
    }

    fun toggleReaction(chatId: Long, messageId: Long, emoji: String) {
        val currentUserId = _currentAccount.value?.id ?: 112201L
        _chats.value = _chats.value.map { chat ->
            if (chat.id != chatId) {
                chat
            } else {
                chat.copy(
                    messages = chat.messages.map { msg ->
                        if (msg.id != messageId) {
                            msg
                        } else {
                            val reactions = msg.reactions.toMutableMap()
                            val userReactions = msg.userReactions.toMutableMap()
                            val previousEmoji = userReactions[currentUserId]

                            fun adjustCount(reactionEmoji: String, delta: Int) {
                                val nextCount = (reactions[reactionEmoji] ?: 0) + delta
                                if (nextCount <= 0) reactions.remove(reactionEmoji)
                                else reactions[reactionEmoji] = nextCount
                            }

                            if (previousEmoji == emoji) {
                                // Tapping the selected reaction removes it.
                                userReactions.remove(currentUserId)
                                adjustCount(emoji, -1)
                            } else {
                                // Keep one reaction per user and message.
                                if (previousEmoji != null) adjustCount(previousEmoji, -1)
                                userReactions[currentUserId] = emoji
                                adjustCount(emoji, 1)
                            }
                            msg.copy(reactions = reactions, userReactions = userReactions)
                        }
                    }
                )
            }
        }
    }

    fun pinMessage(chatId: Long, messageId: Long) {
        _chats.value = _chats.value.map { chat ->
            if (chat.id == chatId) {
                chat.copy(
                    messages = chat.messages.map { msg ->
                        if (msg.id == messageId) msg.copy(isPinned = !msg.isPinned) else msg
                    }
                )
            } else chat
        }
    }

    fun toggleDarkMode() {
        _settings.value = _settings.value.copy(isDarkMode = !_settings.value.isDarkMode)
        persistAppSettings(_settings.value)
    }

    fun setWallpaper(wallpaper: WallpaperId) {
        _settings.value = _settings.value.copy(wallpaper = wallpaper)
        persistAppSettings(_settings.value)
    }

    fun setTextSize(size: TextSize) {
        _settings.value = _settings.value.copy(textSize = size)
        persistAppSettings(_settings.value)
    }

    fun setLanguage(lang: Language) {
        _settings.value = _settings.value.copy(language = lang)
        persistAppSettings(_settings.value)
    }

    fun setNotificationsEnabled(enabled: Boolean) {
        _settings.value = _settings.value.copy(notificationsEnabled = enabled)
        persistAppSettings(_settings.value)
    }

    fun setSoundEnabled(enabled: Boolean) {
        _settings.value = _settings.value.copy(soundEnabled = enabled)
        persistAppSettings(_settings.value)
    }

    fun setAnimationsEnabled(enabled: Boolean) {
        _settings.value = _settings.value.copy(animationsEnabled = enabled)
        persistAppSettings(_settings.value)
    }

    fun setLastSeenPrivacy(value: String) {
        _settings.value = _settings.value.copy(lastSeenPrivacy = value)
        persistAppSettings(_settings.value)
    }

    fun setPhotoPrivacy(value: String) {
        _settings.value = _settings.value.copy(photoPrivacy = value)
        persistAppSettings(_settings.value)
    }

    fun createStory(text: String, color: String = "#2AABEE") {
        val account = _currentAccount.value ?: return
        val newStory = Story(
            id = System.currentTimeMillis(),
            authorId = account.id,
            authorName = account.name,
            authorUsername = account.username,
            text = text,
            backgroundColor = color,
            isMine = true
        )
        _stories.value = listOf(newStory) + _stories.value
    }

    fun toggleChannelSubscription(channelId: Long) {
        _channels.value = _channels.value.map { channel ->
            if (channel.id == channelId) {
                val newSub = !channel.isSubscribed
                val countDiff = if (newSub) 1 else -1
                channel.copy(
                    isSubscribed = newSub,
                    subscribersCount = maxOf(0, channel.subscribersCount + countDiff)
                )
            } else channel
        }
    }

    fun blockUser(userId: Long, name: String, username: String) {
        val currentBlocked = _settings.value.blockedUsers
        if (currentBlocked.none { it.id == userId }) {
            val newBlocked = currentBlocked + BlockedUser(id = userId, name = name, username = username)
            _settings.value = _settings.value.copy(blockedUsers = newBlocked)
        }
    }

    fun unblockUser(userId: Long) {
        val newBlocked = _settings.value.blockedUsers.filter { it.id != userId }
        _settings.value = _settings.value.copy(blockedUsers = newBlocked)
    }


}
