package org.tege.messenger.viewmodel

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
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
    private val profilePrefs = application.getSharedPreferences("tege_local_profile", Context.MODE_PRIVATE)
    private val settingsPrefs = application.getSharedPreferences("tege_local_settings", Context.MODE_PRIVATE)

    private fun loadLocalAccount(): UserAccount? {
        val name = profilePrefs.getString("name", null)?.trim().orEmpty()
        if (name.isBlank()) return null
        return UserAccount(
            id = profilePrefs.getLong("id", System.currentTimeMillis()),
            email = "",
            name = name,
            username = profilePrefs.getString("username", "").orEmpty(),
            bio = profilePrefs.getString("bio", "").orEmpty(),
            phone = profilePrefs.getString("phone", "").orEmpty(),
            country = "",
            registrationDate = profilePrefs.getString("created_at", "").orEmpty(),
            isOnline = false
        )
    }

    private val savedLocalAccount: UserAccount? = loadLocalAccount()

    private fun persistLocalAccount(account: UserAccount?) {
        val editor = profilePrefs.edit()
        if (account == null) editor.clear().apply()
        else editor.putLong("id", account.id)
            .putString("name", account.name)
            .putString("username", account.username)
            .putString("bio", account.bio)
            .putString("phone", account.phone)
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
            language = language
        )
    }

    private fun persistAppSettings(settings: AppSettings) {
        settingsPrefs.edit()
            .putBoolean("dark_mode", settings.isDarkMode)
            .putString("wallpaper", settings.wallpaper.name)
            .putString("text_size", settings.textSize.name)
            .putString("language", settings.language.name)
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
                    .put("isMuted", chat.isMuted).put("online", chat.online)
                    .put("color", chat.color).put("isSavedMessages", chat.isSavedMessages)
                chat.username?.let { item.put("username", it) }
                item.put("subscribersCount", chat.subscribersCount)
                val messages = JSONArray()
                chat.messages.forEach { message ->
                    val m = JSONObject().put("id", message.id).put("text", message.text)
                        .put("time", message.time).put("isMine", message.isMine)
                        .put("isVoice", message.isVoice).put("isPinned", message.isPinned).put("views", message.views)
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
            chatPrefs.edit().putString(persistedChatsKey, array.toString()).apply()
        } catch (_: Exception) {
            // A storage failure must not crash the chat UI.
        }
    }

    private fun restoreChats() {
        val saved = chatPrefs.getString(persistedChatsKey, null) ?: return
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
                        isPinned = m.optBoolean("isPinned"), views = m.optInt("views", 0),
                        reactions = reactions, userReactions = userReactions, replyTo = reply, poll = poll
                    )
                }
                item.optLong("id") to (item to messages)
            }
            val existingIds = _chats.value.map { it.id }.toSet()
            val restoredDrafts = restoredById.filterKeys { it !in existingIds }.map { (id, savedEntry) ->
                val item = savedEntry.first
                val restoredType = runCatching {
                    ChatType.valueOf(item.optString("type", ChatType.DIRECT.name))
                }.getOrDefault(ChatType.DIRECT)
                Chat(
                    id = id,
                    type = restoredType,
                    name = item.optString("name", "Локальный чат"),
                    username = item.optString("username").takeIf { it.isNotBlank() },
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
                    subscribersCount = item.optInt("subscribersCount", 0)
                )
            }
            val restoredInitial = _chats.value.map { chat ->
                val savedEntry = restoredById[chat.id] ?: return@map chat
                val item = savedEntry.first
                chat.copy(lastMessage = item.optString("lastMessage", chat.lastMessage),
                    time = item.optString("time", chat.time), unread = item.optInt("unread", chat.unread),
                    isPinned = item.optBoolean("isPinned", chat.isPinned),
                    isMuted = item.optBoolean("isMuted", chat.isMuted), messages = savedEntry.second)
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

    init {
        restoreChats()
        viewModelScope.launch { _chats.collect { chats -> persistChats(chats) } }
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
        val existing = _chats.value.firstOrNull {
            !it.isSavedMessages && it.name.equals(cleanTitle, ignoreCase = true)
        }
        if (existing != null) {
            _currentRoute.value = ScreenRoute.ChatDetail(existing.id)
            return existing.id
        }
        val id = System.currentTimeMillis()
        val chat = Chat(
            id = id,
            type = ChatType.DIRECT,
            name = cleanTitle,
            description = "Локальный черновик",
            lastMessage = "",
            time = "",
            unread = 0,
            online = false,
            color = "#2AABEE",
            messages = emptyList()
        )
        _chats.value = listOf(chat) + _chats.value
        _currentRoute.value = ScreenRoute.ChatDetail(id)
        return id
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
        _accounts.value = _accounts.value.map { if (it.id == current.id) updated else it }
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
        val remaining = _accounts.value.filter { it.id != _currentAccount.value?.id }
        _accounts.value = remaining
        _currentAccount.value = remaining.firstOrNull()
        persistLocalAccount(_currentAccount.value)
    }

    fun sendMessage(chatId: Long, text: String, replyTo: MessageReplyInfo? = null) {
        if (text.isBlank()) return
        val nowTime = timeFormat.format(Date())
        val message = Message(
            id = System.currentTimeMillis(),
            text = text.trim(),
            time = nowTime,
            isMine = true,
            senderId = _currentAccount.value?.id,
            senderName = _currentAccount.value?.name,
            replyTo = replyTo
        )

        _chats.value = _chats.value.map { chat ->
            if (chat.id == chatId) {
                val updatedStreak = StreakManager.updateStreakOnMessage(chat.streak, isMine = true)
                chat.copy(
                    lastMessage = text.trim(),
                    time = nowTime,
                    messages = chat.messages + message,
                    streak = updatedStreak
                )
            } else chat
        }
    }

    /** Edit a locally stored text message authored by the current user. */
    fun editMessage(chatId: Long, messageId: Long, newText: String) {
        val text = newText.trim()
        if (text.isBlank()) return
        val nowTime = timeFormat.format(Date())
        _chats.value = _chats.value.map { chat ->
            if (chat.id != chatId) return@map chat
            val updatedMessages = chat.messages.map { message ->
                if (message.id == messageId && message.isMine) message.copy(text = text, time = nowTime) else message
            }
            val last = updatedMessages.lastOrNull()
            chat.copy(
                messages = updatedMessages,
                lastMessage = if (last?.id == messageId) text else chat.lastMessage,
                time = if (last?.id == messageId) nowTime else chat.time
            )
        }
    }

    /** Delete a locally stored message authored by the current user. */
    fun deleteMessage(chatId: Long, messageId: Long) {
        _chats.value = _chats.value.map { chat ->
            if (chat.id != chatId) return@map chat
            val target = chat.messages.find { it.id == messageId }
            if (target == null || !target.isMine) return@map chat
            val updatedMessages = chat.messages.filterNot { it.id == messageId }
            val last = updatedMessages.lastOrNull()
            chat.copy(
                messages = updatedMessages,
                lastMessage = last?.let { if (it.poll != null) "📊 ${it.poll.question}" else it.text }.orEmpty(),
                time = last?.time.orEmpty()
            )
        }
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
            if (chat.id == chatId) {
                chat.copy(
                    messages = chat.messages.map { msg ->
                        if (msg.id == messageId) {
                            val reactions = msg.reactions.toMutableMap()
                            val count = reactions[emoji] ?: 0
                            val userReactions = msg.userReactions.toMutableMap()
                            if (userReactions[currentUserId] == emoji) {
                                userReactions.remove(currentUserId)
                                if (count <= 1) reactions.remove(emoji) else reactions[emoji] = count - 1
                            } else {
                                userReactions[currentUserId] = emoji
                                reactions[emoji] = count + 1
                            }
                            msg.copy(reactions = reactions, userReactions = userReactions)
                        } else msg
                    }
                )
            } else chat
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
