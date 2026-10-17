package org.tege.messenger.service

import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import org.tege.messenger.model.Message

object RealtimeNetworkService {
    private val _incomingMessages = MutableSharedFlow<Pair<Long, Message>>(extraBufferCapacity = 64)
    val incomingMessages = _incomingMessages.asSharedFlow()

    suspend fun broadcastMessage(chatId: Long, message: Message) {
        _incomingMessages.emit(Pair(chatId, message))
    }
}
