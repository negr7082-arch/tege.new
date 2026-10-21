package org.tege.messenger.data

import org.tege.messenger.model.*

object SampleData {
    val defaultAccounts = listOf(
        UserAccount(
            id = 112201L,
            email = "user@tege.org",
            name = "Павел Дуров",
            username = "durov",
            bio = "Создатель TEGE Messenger и Telegram. Свобода и скорость общения.",
            phone = "+7 (999) 000-11-22",
            country = "Россия",
            registrationDate = "14.08.2013",
            isOnline = true
        ),
        UserAccount(
            id = 112202L,
            email = "work@tege.org",
            name = "Work Account",
            username = "tege_work",
            bio = "Рабочий аккаунт для проектов и задач.",
            phone = "+7 (999) 111-22-33",
            country = "Россия",
            registrationDate = "01.01.2024",
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

    val defaultChannels = listOf(
        Channel(
            id = 2L,
            name = "Новости TEGE",
            description = "Официальные обновления и анонсы мессенджера.",
            subscribersCount = 42800,
            color = "#3390EC",
            isSubscribed = true,
            channelLink = "@tege_news"
        ),
        Channel(
            id = 202L,
            name = "Kotlin & Android Daily",
            description = "Свежие статьи, паттерны и советы по разработке на Kotlin.",
            subscribersCount = 18950,
            color = "#7C4DFF",
            isSubscribed = false,
            channelLink = "@kotlin_daily"
        ),
        Channel(
            id = 203L,
            name = "Технологии будущего",
            description = "Искусственный интеллект, космос и передовые технологии.",
            subscribersCount = 85200,
            color = "#00B0FF",
            isSubscribed = false,
            channelLink = "@tech_future"
        )
    )

    val defaultStories = listOf(
        Story(
            id = 501L,
            authorId = 3344L,
            authorName = "Анна Смирнова",
            authorUsername = "anna_design",
            text = "Новый релиз TEGE готов! 🚀 Оценивайте анимации и интерфейс",
            backgroundColor = "#7C4DFF",
            createdAt = System.currentTimeMillis() - 3600000,
            viewsCount = 142
        ),
        Story(
            id = 502L,
            authorId = 2L,
            authorName = "Новости TEGE",
            authorUsername = "tege_news",
            text = "Все файлы теперь на Kotlin (.kt)! Наслаждайтесь максимальной производительностью ✨",
            backgroundColor = "#2AABEE",
            createdAt = System.currentTimeMillis() - 7200000,
            viewsCount = 820
        )
    )
}
