package org.tege.messenger.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SampleDataTest {
    @Test
    fun savedMessagesUsesReservedNegativeId() {
        val chats = SampleData.getInitialChats()

        assertEquals(1, chats.size)
        assertTrue(chats.single().isSavedMessages)
        assertEquals(SampleData.SAVED_MESSAGES_CHAT_ID, chats.single().id)
        assertTrue(chats.single().id < 0L)
        assertEquals(chats.size, chats.map { it.id }.distinct().size)
    }
}
