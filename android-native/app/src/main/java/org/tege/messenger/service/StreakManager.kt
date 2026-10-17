package org.tege.messenger.service

import org.tege.messenger.model.ChatStreak
import org.tege.messenger.model.StreakStatus
import java.text.SimpleDateFormat
import java.util.*

object StreakManager {
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd", Locale.getDefault())

    fun getTodayString(): String = dateFormat.format(Date())

    fun updateStreakOnMessage(currentStreak: ChatStreak?, isMine: Boolean): ChatStreak {
        val today = getTodayString()
        val streak = currentStreak ?: ChatStreak(chatId = 0, userId = 0)

        if (streak.lastChatDate == today) {
            return streak
        }

        val newDaysCount = streak.chatDaysCount + 1
        val newStatus = when {
            streak.status == StreakStatus.ACTIVE -> StreakStatus.ACTIVE
            newDaysCount >= 10 -> StreakStatus.ELIGIBLE
            else -> StreakStatus.LOCKED
        }

        val newStreakCount = if (streak.status == StreakStatus.ACTIVE) {
            streak.streakCount + 1
        } else streak.streakCount

        return streak.copy(
            chatDaysCount = newDaysCount,
            lastChatDate = today,
            status = newStatus,
            streakCount = newStreakCount,
            lastStreakDate = today
        )
    }

    fun activateStreak(currentStreak: ChatStreak, initiatorUserId: Long): ChatStreak {
        return currentStreak.copy(
            status = StreakStatus.ACTIVE,
            streakCount = maxOf(1, currentStreak.streakCount),
            requestedByUserId = initiatorUserId,
            lastStreakDate = getTodayString()
        )
    }
}
