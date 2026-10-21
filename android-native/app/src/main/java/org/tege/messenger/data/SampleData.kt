package org.tege.messenger.data

import org.tege.messenger.model.*

object SampleData {
    // Neutral local profile; no impersonation or fabricated personal details.
    val defaultAccounts = listOf(
        UserAccount(
            id = 112201L,
            email = "",
            name = "Мой аккаунт",
            username = "user",
            bio = "",
            phone = "",
            country = "",
            registrationDate = "",
            isOnline = true
        )
    )

    fun getInitialChats(): List<Chat> {
        // Keep the chat list free of fabricated demo conversations.
        // Real chats can be created by the user; Saved Messages remains available.
        return listOf(
            Chat(
                id = 1L,
                type = ChatType.DIRECT,
                name = "Избранное",
                username = "saved",
                description = "Ваше личное облачное хранилище",
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
