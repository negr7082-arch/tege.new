package org.tege.messenger.data

import org.tege.messenger.model.*

object SampleData {
    // The user creates a local profile; no demo identity is pre-filled.
    val defaultAccounts = emptyList<UserAccount>()

    fun getInitialChats(): List<Chat> {
        // Keep the chat list free of fabricated demo conversations.
        // Real chats can be created by the user; Saved Messages remains available.
        return listOf(
            Chat(
                id = 1L,
                type = ChatType.DIRECT,
                name = "Избранное",
                username = "saved",
                description = "Сохранённые сообщения на этом устройстве",
                lastMessage = "",
                time = "",
                unread = 0,
                online = false,
                color = "#2AABEE",
                isSavedMessages = true,
                isPinned = true,
                messages = emptyList()
            )
        )
    }

    // Populate these collections only with channels the user actually discovers or joins.
    val defaultChannels = emptyList<Channel>()

    // No fabricated stories on first launch.
    val defaultStories = emptyList<Story>()
}
