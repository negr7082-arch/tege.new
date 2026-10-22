package org.tege.messenger.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.tege.messenger.model.ContactUser
import org.tege.messenger.ui.components.TegeAvatar
import org.tege.messenger.ui.theme.TelegramBlue
import org.tege.messenger.viewmodel.TegeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContactsScreen(
    viewModel: TegeViewModel,
    onBack: () -> Unit
) {
    val contacts by viewModel.contacts.collectAsState()
    var query by remember { mutableStateOf("") }
    val visibleContacts = contacts
        .filter { it.name.contains(query, ignoreCase = true) || it.username.contains(query.removePrefix("@"), ignoreCase = true) }
        .sortedBy { it.name.lowercase() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Контакты", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                },
                actions = {
                    IconButton(onClick = { query = if (query.isEmpty()) " " else "" }) {
                        Icon(Icons.Default.Search, contentDescription = "Поиск контактов")
                    }
                }
            )
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                singleLine = true,
                placeholder = { Text("Поиск по имени или имени пользователя") }
            )
            if (visibleContacts.isEmpty()) {
                Box(Modifier.fillMaxSize().padding(28.dp), contentAlignment = Alignment.Center) {
                    Text(
                        if (contacts.isEmpty()) "Контакты появятся после загрузки пользователей с сервера TEGE."
                        else "Ничего не найдено",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            } else {
                LazyColumn {
                    item {
                        Text(
                            "${visibleContacts.size} контактов",
                            color = TelegramBlue,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.padding(start = 72.dp, top = 8.dp, bottom = 8.dp)
                        )
                    }
                    items(visibleContacts, key = { it.id }) { contact ->
                        ContactRow(contact = contact, onClick = {
                            val chatId = viewModel.openDirectChat(contact)
                            if (chatId >= 0L) viewModel.navigateTo(org.tege.messenger.model.ScreenRoute.ChatDetail(chatId))
                        })
                    }
                }
            }
        }
    }
}

@Composable
private fun ContactRow(contact: ContactUser, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box {
            TegeAvatar(
                avatarUri = contact.avatarUri,
                displayName = contact.name,
                color = runCatching { Color(android.graphics.Color.parseColor(contact.color)) }.getOrDefault(TelegramBlue),
                modifier = Modifier.size(52.dp)
            )
            if (contact.online) {
                Box(
                    Modifier.align(Alignment.BottomEnd).size(13.dp).clip(CircleShape)
                        .background(Color(0xFF4CAF50))
                        .padding(2.dp).background(MaterialTheme.colorScheme.surface, CircleShape)
                        .padding(2.dp).background(Color(0xFF4CAF50), CircleShape)
                )
            }
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(contact.name, fontWeight = FontWeight.Medium, fontSize = 16.sp, maxLines = 1)
            Text(
                if (contact.online) "в сети" else contact.username.takeIf { it.isNotBlank() }?.let { "@${it.removePrefix("@")}" } ?: "не в сети",
                color = if (contact.online) Color(0xFF35A853) else MaterialTheme.colorScheme.onSurfaceVariant,
                fontSize = 13.sp,
                maxLines = 1
            )
        }
    }
}
