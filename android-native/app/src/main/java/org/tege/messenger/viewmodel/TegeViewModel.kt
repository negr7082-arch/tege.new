package org.tege.messenger.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import org.tege.messenger.data.SampleData
import org.tege.messenger.model.*
import org.tege.messenger.service.StreakManager
import java.text.SimpleDateFormat
import java.util.*

class TegeViewModel : ViewModel() {
    private val timeFormat = SimpleDateFormat("HH:mm", Locale.getDefault())

    private val _accounts = MutableStateFlow<List<UserAccount>>(SampleData.defaultAccounts)
    val accounts: StateFlow<List<UserAccount>> = _accounts.asStateFlow()

    private val _currentAccount = MutableStateFlow<UserAccount?>(SampleData.defaultAccounts.firstOrNull())
    val currentAccount: StateFlow<UserAccount?> = _currentAccount.asStateFlow()

    private val _settings = MutableStateFlow(AppSettings())
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

    fun navigateTo(route: ScreenRoute) {
        _currentRoute.value = route
    }

    fun navigateBack() {
        _currentRoute.value = ScreenRoute.ChatList
    }

    fun setSearchQuery(query: String) {
        _searchQuery.value = query
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

    fun switchAccount(accountId: Long) {
        _accounts.value.find { it.id == accountId }?.let {
            _currentAccount.value = it
        }
    }

    fun addAccount(name: String, username: String, phone: String) {
        val newAcc = UserAccount(
            id = System.currentTimeMillis(),
            email = "$username@tege.org",
            name = name,
            username = username.removePrefix("@"),
            phone = phone,
            registrationDate = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault()).format(Date())
        )
        val updated = (_accounts.value + newAcc).take(5)
        _accounts.value = updated
        _currentAccount.value = newAcc
    }

    fun login(usernameOrEmail: String, pass: String): Boolean {
        val found = _accounts.value.find { 
            it.username.equals(usernameOrEmail.removePrefix("@"), ignoreCase = true) || 
            it.email.equals(usernameOrEmail, ignoreCase = true) 
        }
        return if (found != null) {
            _currentAccount.value = found
            true
        } else {
            val created = UserAccount(
                id = System.currentTimeMillis(),
                email = if (usernameOrEmail.contains("@")) usernameOrEmail else "$usernameOrEmail@tege.org",
                name = usernameOrEmail.replace("@", "").capitalize(Locale.getDefault()),
                username = usernameOrEmail.removePrefix("@"),
                registrationDate = SimpleDateFormat("dd.MM.yyyy", Locale.getDefault()).format(Date())
            )
            _accounts.value = _accounts.value + created
            _currentAccount.value = created
            true
        }
    }

    fun logout() {
        val remaining = _accounts.value.filter { it.id != _currentAccount.value?.id }
        _accounts.value = remaining
        _currentAccount.value = remaining.firstOrNull()
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

    fun sendVideoNote(chatId: Long, noteUri: String = "https://assets.mixkit.co/videos/preview/mixkit-young-woman-talking-on-video-call-with-camera-42880-large.mp4") {
        val nowTime = timeFormat.format(Date())
        val message = Message(
            id = System.currentTimeMillis(),
            text = "⚪ Видеосообщение (кружочек)",
            time = nowTime,
            isMine = true,
            videoNoteUri = noteUri,
            senderId = _currentAccount.value?.id,
            senderName = _currentAccount.value?.name
        )
        _chats.value = _chats.value.map { chat ->
            if (chat.id == chatId) {
                chat.copy(
                    lastMessage = "⚪ Видеосообщение",
                    time = nowTime,
                    messages = chat.messages + message
                )
            } else chat
        }
    }

    fun toggleGroupVideoChat(chatId: Long) {
        val account = _currentAccount.value ?: return
        _chats.value = _chats.value.map { chat ->
            if (chat.id == chatId) {
                val currentVideoChat = chat.activeVideoChat
                if (currentVideoChat?.isActive == true) {
                    chat.copy(activeVideoChat = null)
                } else {
                    chat.copy(
                        activeVideoChat = GroupVideoChatInfo(
                            isActive = true,
                            title = chat.name,
                            startedById = account.id,
                            startedByName = account.name,
                            participants = listOf(
                                GroupVideoChatParticipant(
                                    id = account.id,
                                    name = account.name,
                                    isHost = true
                                ),
                                GroupVideoChatParticipant(
                                    id = 3344L,
                                    name = "Анна Смирнова",
                                    isSpeaking = true,
                                    isVideoOn = true
                                )
                            )
                        )
                    )
                }
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
    }

    fun setWallpaper(wallpaper: WallpaperId) {
        _settings.value = _settings.value.copy(wallpaper = wallpaper)
    }

    fun setTextSize(size: TextSize) {
        _settings.value = _settings.value.copy(textSize = size)
    }

    fun setLanguage(lang: Language) {
        _settings.value = _settings.value.copy(language = lang)
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

    fun changePassword(newPass: String) {
        _settings.value = _settings.value.copy(twoFactorEnabled = true, twoFactorPassword = newPass)
        _currentAccount.value = _currentAccount.value?.copy(password = newPass)
    }
}
