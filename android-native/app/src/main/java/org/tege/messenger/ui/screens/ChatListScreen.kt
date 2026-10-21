package org.tege.messenger.ui.screens

import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.tege.messenger.model.Chat
import org.tege.messenger.model.ChatType
import org.tege.messenger.model.ScreenRoute
import org.tege.messenger.model.Story
import org.tege.messenger.ui.theme.TelegramBlue
import org.tege.messenger.viewmodel.TegeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen(
    viewModel: TegeViewModel,
    onOpenDrawer: () -> Unit,
    onOpenCreateStory: () -> Unit,
    onViewStory: (Story) -> Unit
) {
    val chats by viewModel.chats.collectAsState()
    val stories by viewModel.stories.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    var isSearchActive by remember { mutableStateOf(false) }
    var showArchived by remember { mutableStateOf(false) }
    var selectedFolder by remember { mutableIntStateOf(0) }
    val folderLabels = listOf("Все", "Личные", "Группы", "Каналы")
    // Telegram-style search across chat names, usernames, previews and local messages.
    // Show Saved Messages and conversations backed by a real server user.
    // Older device-only drafts are left in storage, but are not presented as real chats.
    val filteredChats = chats
        .filter { it.isSavedMessages || it.userId != null }
        .sortedWith(compareByDescending<Chat> { it.isPinned }.thenByDescending { it.time })
        .filter { chat ->
            searchQuery.isBlank() ||
                chat.name.contains(searchQuery, ignoreCase = true) ||
                chat.lastMessage.contains(searchQuery, ignoreCase = true) ||
                (chat.username?.contains(searchQuery, ignoreCase = true) == true) ||
                chat.messages.any { it.text.contains(searchQuery, ignoreCase = true) }
        }
    val visibleChats = filteredChats.filter { chat ->
        if (showArchived) {
            chat.isArchived
        } else {
            !chat.isArchived && when (selectedFolder) {
                1 -> chat.type == ChatType.DIRECT
                2 -> chat.type == ChatType.GROUP
                3 -> chat.type == ChatType.CHANNEL
                else -> true
            }
        }
    }
    val archivedCount = filteredChats.count { it.isArchived }

    Scaffold(
        topBar = {
            Column {
            TopAppBar(
                title = {
                    if (isSearchActive) {
                        TextField(
                            value = searchQuery,
                            onValueChange = { viewModel.setSearchQuery(it) },
                            placeholder = { Text("Поиск") },
                            singleLine = true,
                            colors = TextFieldDefaults.colors(
                                focusedContainerColor = Color.Transparent,
                                unfocusedContainerColor = Color.Transparent,
                                focusedIndicatorColor = Color.Transparent,
                                unfocusedIndicatorColor = Color.Transparent
                            ),
                            modifier = Modifier.fillMaxWidth()
                        )
                    } else {
                        Text(
                            text = if (showArchived) "Архив" else "TEGE",
                            fontWeight = FontWeight.SemiBold,
                            fontSize = 20.sp,
                            color = Color.White
                        )
                    }
                },
                navigationIcon = {
                    if (isSearchActive) {
                        IconButton(onClick = {
                            isSearchActive = false
                            viewModel.setSearchQuery("")
                        }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                        }
                    } else if (showArchived) {
                        IconButton(onClick = { showArchived = false }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Назад", tint = Color.White)
                        }
                    } else {
                        IconButton(onClick = onOpenDrawer) {
                            Icon(Icons.Default.Menu, contentDescription = "Menu", tint = Color.White)
                        }
                    }
                },
                actions = {
                    if (!isSearchActive) {
                        IconButton(onClick = { isSearchActive = true }) {
                            Icon(Icons.Default.Search, contentDescription = "Search", tint = Color.White)
                        }
                    } else if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { viewModel.setSearchQuery("") }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear", tint = Color.White)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = TelegramBlue,
                    navigationIconContentColor = Color.White,
                    titleContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
            if (!isSearchActive && !showArchived) {
                TabRow(
                    selectedTabIndex = selectedFolder,
                    containerColor = Color(0xFF287FC7),
                    contentColor = Color.White
                ) {
                    folderLabels.forEachIndexed { index, label ->
                        Tab(
                            selected = selectedFolder == index,
                            onClick = { selectedFolder = index },
                            text = {
                                Text(
                                    text = label,
                                    fontWeight = if (selectedFolder == index) FontWeight.SemiBold else FontWeight.Normal,
                                    maxLines = 1
                                )
                            },
                            selectedContentColor = Color.White,
                            unselectedContentColor = Color.White.copy(alpha = 0.78f)
                        )
                    }
                }
            }
            }
        },
        floatingActionButton = {
            if (!isSearchActive) {
                FloatingActionButton(
                    onClick = { viewModel.navigateTo(ScreenRoute.CreateChat) },
                    containerColor = TelegramBlue,
                    contentColor = Color.White,
                    shape = CircleShape
                ) {
                    Icon(Icons.Default.Edit, contentDescription = "Новое сообщение")
                }
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Telegram-style archive entry is shown above the conversation list.
            if (!showArchived && !isSearchActive && searchQuery.isBlank() && selectedFolder == 0 && archivedCount > 0) {
                item(key = "archive-row") {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showArchived = true }
                            .padding(horizontal = 20.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier.size(44.dp).clip(CircleShape).background(TelegramBlue.copy(alpha = 0.12f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Archive, contentDescription = null, tint = TelegramBlue)
                        }
                        Spacer(modifier = Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text("Архив", fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
                            Text("$archivedCount чатов", color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                        }
                        Icon(Icons.Default.ChevronRight, contentDescription = "Открыть архив", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    HorizontalDivider(
                        modifier = Modifier.padding(start = 76.dp),
                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.2f)
                    )
                }
            }

            // Stories are shown only when the user has actual stories to display.
            if (stories.isNotEmpty() && !showArchived) {
                item {
                    StoriesBar(
                        stories = stories,
                        onAddStory = onOpenCreateStory,
                        onViewStory = onViewStory
                    )
                    HorizontalDivider(
                        color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.35f)
                    )
                }
            }

            if (visibleChats.isEmpty()) {
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 32.dp, vertical = 48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        if (searchQuery.isNotBlank() || selectedFolder != 0 || showArchived) {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = null,
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(32.dp)
                            )
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                text = when {
                                    searchQuery.isNotBlank() -> "Ничего не найдено"
                                    showArchived -> "Архив пуст"
                                    else -> "В этой папке пока нет чатов"
                                },
                                fontSize = 16.sp,
                                color = MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                }
            }

            // Chats list
            items(visibleChats, key = { it.id }) { chat ->
                ChatRowItem(
                    chat = chat,
                    searchQuery = searchQuery,
                    onClick = { viewModel.navigateTo(ScreenRoute.ChatDetail(chat.id)) },
                    onTogglePin = { viewModel.toggleChatPin(chat.id) },
                    onToggleMute = { viewModel.toggleChatMute(chat.id) },
                    onToggleArchive = { viewModel.toggleChatArchived(chat.id) },
                    onToggleUnread = {
                        if (chat.unread > 0) viewModel.markChatRead(chat.id)
                        else viewModel.markChatUnread(chat.id)
                    }
                )
                HorizontalDivider(
                    modifier = Modifier.padding(start = 76.dp),
                    color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.2f)
                )
            }
        }
    }
}

@Composable
fun StoriesBar(
    stories: List<Story>,
    onAddStory: () -> Unit,
    onViewStory: (Story) -> Unit
) {
    LazyRow(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // "My Story" item
        item {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .width(60.dp)
                    .clickable(onClick = onAddStory)
            ) {
                Box(contentAlignment = Alignment.BottomEnd) {
                    Box(
                        modifier = Modifier
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(TelegramBlue.copy(alpha = 0.15f))
                            .border(1.5.dp, TelegramBlue, CircleShape),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.CameraAlt, contentDescription = "Add Story", tint = TelegramBlue)
                    }
                    Box(
                        modifier = Modifier
                            .size(20.dp)
                            .clip(CircleShape)
                            .background(TelegramBlue),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "Add", tint = Color.White, modifier = Modifier.size(14.dp))
                    }
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Моя история",
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        // Active Stories
        items(stories) { story ->
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .width(64.dp)
                    .clickable { onViewStory(story) }
            ) {
                Box(
                    modifier = Modifier
                        .size(56.dp)
                        .border(1.5.dp, TelegramBlue, CircleShape)
                        .padding(3.dp)
                        .clip(CircleShape)
                        .background(Color(android.graphics.Color.parseColor(story.backgroundColor))),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = story.authorName.take(1).uppercase(),
                        color = Color.White,
                        fontWeight = FontWeight.Bold,
                        fontSize = 18.sp
                    )
                }
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = story.authorName,
                    fontSize = 11.sp,
                    color = MaterialTheme.colorScheme.onSurface,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ChatRowItem(
    chat: Chat,
    searchQuery: String = "",
    onClick: () -> Unit,
    onTogglePin: () -> Unit = {},
    onToggleMute: () -> Unit = {},
    onToggleArchive: () -> Unit = {},
    onToggleUnread: () -> Unit = {}
) {
    var showActions by remember(chat.id) { mutableStateOf(false) }
    val matchingMessage = if (searchQuery.isBlank()) null else
        chat.messages.lastOrNull { it.text.contains(searchQuery, ignoreCase = true) }
    val previewText = matchingMessage?.text ?: chat.lastMessage.ifBlank {
        if (chat.isSavedMessages) "Сохранённые сообщения" else "Нет сообщений"
    }
    val lastMessage = chat.messages.lastOrNull()
    val timeColor = MaterialTheme.colorScheme.onSurfaceVariant

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .combinedClickable(
                onClick = onClick,
                onLongClick = { showActions = true }
            )
            .padding(horizontal = 16.dp, vertical = 7.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Avatar
        Box(contentAlignment = Alignment.BottomEnd) {
            Box(
                modifier = Modifier
                    .size(54.dp)
                    .clip(CircleShape)
                    .background(Color(android.graphics.Color.parseColor(chat.color))),
                contentAlignment = Alignment.Center
            ) {
                if (chat.isSavedMessages) {
                    Icon(Icons.Default.Bookmark, contentDescription = "Saved Messages", tint = Color.White)
                } else {
                    Text(
                        text = chat.name.take(1).uppercase(),
                        color = Color.White,
                        fontSize = 21.sp,
                        fontWeight = FontWeight.Medium
                    )
                }
            }
            if (chat.online && !chat.isSavedMessages) {
                Box(
                    modifier = Modifier
                        .size(14.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF4CAF50))
                        .border(2.dp, MaterialTheme.colorScheme.surface, CircleShape)
                )
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        // Name and Last Message
        Column(modifier = Modifier.weight(1f)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = chat.name,
                    modifier = Modifier.weight(1f),
                    fontWeight = FontWeight.Medium,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (chat.isMuted) {
                        Icon(
                            imageVector = Icons.Default.NotificationsOff,
                            contentDescription = "Уведомления отключены",
                            tint = timeColor,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(modifier = Modifier.width(4.dp))
                    }
                    Text(
                        text = chat.time,
                        fontSize = 12.sp,
                        color = timeColor
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    modifier = Modifier.weight(1f),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (lastMessage?.isMine == true && matchingMessage == null) {
                        Icon(
                            imageVector = Icons.Default.DoneAll,
                            contentDescription = "Отправлено",
                            tint = TelegramBlue,
                            modifier = Modifier.size(16.dp)
                        )
                        Spacer(modifier = Modifier.width(3.dp))
                    }
                    Text(
                        text = previewText,
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f, fill = false)
                    )
                    if (chat.isPinned) {
                        Spacer(modifier = Modifier.width(5.dp))
                        Icon(
                            imageVector = Icons.Default.PushPin,
                            contentDescription = "Закреплённый чат",
                            tint = timeColor,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
                if (chat.unread > 0) {
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(10.dp))
                            .background(TelegramBlue)
                            .padding(horizontal = 7.dp, vertical = 2.dp)
                    ) {
                        Text(
                            text = chat.unread.toString(),
                            color = Color.White,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }
    }
    DropdownMenu(
        expanded = showActions,
        onDismissRequest = { showActions = false }
    ) {
        DropdownMenuItem(
            text = { Text(if (chat.isPinned) "Открепить чат" else "Закрепить чат") },
            leadingIcon = { Icon(Icons.Default.PushPin, contentDescription = null) },
            onClick = {
                showActions = false
                onTogglePin()
            }
        )
        DropdownMenuItem(
            text = { Text(if (chat.isMuted) "Включить уведомления" else "Отключить уведомления") },
            leadingIcon = {
                Icon(
                    if (chat.isMuted) Icons.Default.NotificationsActive else Icons.Default.NotificationsOff,
                    contentDescription = null
                )
            },
            onClick = {
                showActions = false
                onToggleMute()
            }
        )
        DropdownMenuItem(
            text = { Text(if (chat.unread > 0) "Отметить прочитанным" else "Отметить непрочитанным") },
            leadingIcon = {
                Icon(if (chat.unread > 0) Icons.Default.MarkChatRead else Icons.Default.MarkChatUnread, contentDescription = null)
            },
            onClick = {
                showActions = false
                onToggleUnread()
            }
        )
        DropdownMenuItem(
            text = { Text(if (chat.isArchived) "Вернуть из архива" else "В архив") },
            leadingIcon = { Icon(if (chat.isArchived) Icons.Default.Unarchive else Icons.Default.Archive, contentDescription = null) },
            onClick = {
                showActions = false
                onToggleArchive()
            }
        )
        DropdownMenuItem(
            text = { Text("Открыть чат") },
            leadingIcon = { Icon(Icons.Default.ChatBubbleOutline, contentDescription = null) },
            onClick = {
                showActions = false
                onClick()
            }
        )
    }
}
