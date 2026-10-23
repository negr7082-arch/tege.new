package org.tege.messenger.model

enum class Language { RU, EN }
enum class TextSize { SMALL, MEDIUM, LARGE, XLARGE }
enum class WallpaperId { PATTERN, DARK, EMERALD, SUNSET, OCEAN, MINIMAL }
enum class ChatType { DIRECT, GROUP, CHANNEL }
enum class StreakStatus { LOCKED, ELIGIBLE, PENDING_APPROVAL, ACTIVE, BURNED_OUT }

data class AppSettings(
    val isDarkMode: Boolean = false,
    val language: Language = Language.RU,
    val textSize: TextSize = TextSize.MEDIUM,
    val wallpaper: WallpaperId = WallpaperId.PATTERN,
    val soundEnabled: Boolean = true,
    val notificationsEnabled: Boolean = true,
    val lastSeenPrivacy: String = "everyone",
    val photoPrivacy: String = "everyone",
    val twoFactorEnabled: Boolean = false,
    val twoFactorPassword: String = "",
    val animationsEnabled: Boolean = true,
    val blockedUsers: List<BlockedUser> = emptyList()
)

data class BlockedUser(
    val id: Long,
    val name: String,
    val username: String,
    val avatarUri: String? = null,
    val blockedAt: Long = System.currentTimeMillis()
)

data class GroupVideoChatParticipant(
    val id: Long,
    val name: String,
    val avatarUri: String? = null,
    val isSpeaking: Boolean = false,
    val isMuted: Boolean = false,
    val isVideoOn: Boolean = false,
    val isHost: Boolean = false
)

data class GroupVideoChatInfo(
    val isActive: Boolean = true,
    val title: String,
    val startedAt: Long = System.currentTimeMillis(),
    val startedById: Long,
    val startedByName: String,
    val participants: List<GroupVideoChatParticipant> = emptyList()
)

data class ChatStreak(
    val chatId: Long,
    val userId: Long,
    val chatDaysCount: Int = 1,
    val lastChatDate: String = "",
    val status: StreakStatus = StreakStatus.LOCKED,
    val streakCount: Int = 0,
    val lastStreakDate: String = "",
    val requestedByUserId: Long? = null
)

data class PollOption(
    val id: Int,
    val text: String,
    val votes: Int = 0,
    val votedUserIds: List<Long> = emptyList()
)

data class Poll(
    val question: String,
    val options: List<PollOption>,
    val totalVotes: Int = 0,
    val isClosed: Boolean = false,
    val allowsMultiple: Boolean = false
)

data class Comment(
    val id: Long,
    val authorId: Long,
    val authorName: String,
    val authorUsername: String? = null,
    val authorAvatarUri: String? = null,
    val text: String,
    val time: String
)

data class MessageReplyInfo(
    val id: Long,
    val senderName: String,
    val text: String
)

data class Message(
    val id: Long,
    val text: String,
    val time: String,
    val isMine: Boolean,
    val attachmentUri: String? = null,
    val videoUri: String? = null,
    val videoNoteUri: String? = null, // кружочек
    val audioUri: String? = null,
    val isVoice: Boolean = false, // голосовое сообщение
    val voiceDuration: String? = null,
    val fileName: String? = null,
    val fileSize: String? = null,
    val senderId: Long? = null,
    val senderName: String? = null,
    val senderAvatarUri: String? = null,
    val asChannel: Boolean = false,
    val isSystemBotMessage: Boolean = false,
    val reactions: Map<String, Int> = emptyMap(),
    val userReactions: Map<Long, String> = emptyMap(),
    val views: Int = 1,
    val isPinned: Boolean = false,
    val poll: Poll? = null,
    val comments: List<Comment> = emptyList(),
    val replyTo: MessageReplyInfo? = null
)

data class AdminMember(
    val id: Long,
    val name: String,
    val username: String,
    val avatarUri: String? = null,
    val isOwner: Boolean = false,
    val customTitle: String? = null
)

data class ContactUser(
    val id: Long,
    val name: String,
    val username: String,
    val bio: String = "",
    val phone: String = "",
    val country: String = "Russia",
    val registrationDate: String = "",
    val online: Boolean = false,
    val avatarUri: String? = null,
    val color: String = "#2AABEE",
    val volunteerRole: String? = null,
    val isVerified: Boolean = false
)

data class Chat(
    val id: Long,
    val type: ChatType = ChatType.DIRECT,
    val userId: Long? = null,
    val username: String? = null,
    val name: String,
    val description: String = "",
    val lastMessage: String = "",
    val time: String = "",
    val unread: Int = 0,
    val online: Boolean = false,
    val color: String = "#2AABEE",
    val avatarUri: String? = null,
    val messages: List<Message> = emptyList(),
    val isSavedMessages: Boolean = false,
    val isPinned: Boolean = false,
    val isMuted: Boolean = false,
    val isArchived: Boolean = false,
    val streak: ChatStreak? = null,
    val subscribersCount: Int = 0,
    val membersCount: Int = 0,
    val activeVideoChat: GroupVideoChatInfo? = null,
    val isOwner: Boolean = false,
    val isAdmin: Boolean = false
)

data class Channel(
    val id: Long,
    val name: String,
    val description: String,
    val subscribersCount: Int,
    val avatarUri: String? = null,
    val color: String = "#2AABEE",
    val isSubscribed: Boolean = false,
    val isPublic: Boolean = true,
    val channelLink: String = "",
    val isOwner: Boolean = false,
    val activeVideoChat: GroupVideoChatInfo? = null
)

data class UserAccount(
    val id: Long,
    val email: String,
    val password: String = "",
    val name: String,
    val username: String,
    val bio: String = "",
    val phone: String = "",
    val country: String = "Russia",
    val registrationDate: String = "",
    val avatarUri: String? = null,
    val isOnline: Boolean = true
)

data class Story(
    val id: Long,
    val authorId: Long,
    val authorName: String,
    val authorUsername: String? = null,
    val authorAvatarUri: String? = null,
    val mediaUri: String? = null,
    val text: String? = null,
    val backgroundColor: String = "#2AABEE",
    val createdAt: Long = System.currentTimeMillis(),
    val expiresAt: Long = System.currentTimeMillis() + 86400000,
    val viewsCount: Int = 0,
    val reactions: Map<String, Int> = emptyMap(),
    val isMine: Boolean = false
)

sealed class ScreenRoute {
    object ChatList : ScreenRoute()
    data class ChatDetail(val chatId: Long) : ScreenRoute()
    object Profile : ScreenRoute()
    object Channels : ScreenRoute()
    object CreateChat : ScreenRoute()
    object Contacts : ScreenRoute()
    object Calls : ScreenRoute()
    object Settings : ScreenRoute()
    object Security : ScreenRoute()
}
