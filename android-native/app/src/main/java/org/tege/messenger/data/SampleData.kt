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
        return listOf(
            Chat(
                id = 1L,
                type = ChatType.DIRECT,
                name = "Избранное",
                username = "saved",
                description = "Ваше личное облачное хранилище",
                lastMessage = "Добро пожаловать в TEGE Messenger!",
                time = "12:00",
                unread = 0,
                online = true,
                color = "#2AABEE",
                isSavedMessages = true,
                isPinned = true,
                messages = listOf(
                    Message(
                        id = 101L,
                        text = "Добро пожаловать в TEGE Messenger! Здесь можно хранить заметки, ссылки и файлы.",
                        time = "12:00",
                        isMine = true,
                        views = 1
                    )
                )
            ),
            Chat(
                id = 2L,
                type = ChatType.CHANNEL,
                name = "Новости TEGE",
                username = "tege_news",
                description = "Официальные обновления, новые функции и анонсы.",
                lastMessage = "Вышло масштабное обновление TEGE Messenger на Kotlin!",
                time = "11:45",
                unread = 1,
                online = true,
                color = "#3390EC",
                subscribersCount = 42800,
                isPinned = true,
                messages = listOf(
                    Message(
                        id = 201L,
                        text = "🎉 Вышло масштабное обновление TEGE Messenger на Kotlin!\n\n• Полная поддержка Kotlin и Jetpack Compose\n• Истории (Stories) и Огоньки (Chat Streaks 🔥)\n• Опросы, реакции и кружочки\n• Поддержка до 5 мульти-аккаунтов!",
                        time = "11:45",
                        isMine = false,
                        views = 14200,
                        reactions = mapOf("🔥" to 1250, "❤️" to 890, "👍" to 2100)
                    )
                )
            ),
            Chat(
                id = 3L,
                type = ChatType.DIRECT,
                name = "Анна Смирнова",
                username = "anna_design",
                description = "UI/UX Дизайнер в TEGE",
                lastMessage = "Отправила новые макеты тёмной темы!",
                time = "10:30",
                unread = 2,
                online = true,
                color = "#E040FB",
                streak = ChatStreak(
                    chatId = 3L,
                    userId = 3344L,
                    chatDaysCount = 12,
                    status = StreakStatus.ACTIVE,
                    streakCount = 7
                ),
                messages = listOf(
                    Message(
                        id = 301L,
                        text = "Привет! Как тебе новый дизайн профиля?",
                        time = "10:25",
                        isMine = false
                    ),
                    Message(
                        id = 302L,
                        text = "Отправила новые макеты тёмной темы!",
                        time = "10:30",
                        isMine = false,
                        reactions = mapOf("👍" to 1)
                    )
                )
            ),
            Chat(
                id = 4L,
                type = ChatType.GROUP,
                name = "Разработчики TEGE Kotlin",
                username = "tege_devs",
                description = "Чат разработчиков Android & Kotlin",
                lastMessage = "Алексей: Сборка успешно скомпилирована!",
                time = "09:15",
                unread = 0,
                online = true,
                color = "#4CAF50",
                membersCount = 128,
                messages = listOf(
                    Message(
                        id = 401L,
                        text = "Коллеги, все файлы успешно переведены на чистый Kotlin (.kt) и Jetpack Compose!",
                        time = "09:10",
                        isMine = false,
                        senderName = "Алексей"
                    ),
                    Message(
                        id = 402L,
                        text = "Отличная работа! Теперь приложение максимально быстрое и плавное.",
                        time = "09:15",
                        isMine = true
                    )
                )
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
