package org.tege.messenger.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
    var selectedChatFilter by remember { mutableStateOf("Все") }

    // Search chat names, usernames, previews, and the full local message history.
    val filteredChats = chats.sortedByDescending { it.isPinned }.filter { chat ->
        val matchesSearch = searchQuery.isBlank() ||
            chat.name.contains(searchQuery, ignoreCase = true) ||
            chat.lastMessage.contains(searchQuery, ignoreCase = true) ||
            (chat.username?.contains(searchQuery, ignoreCase = true) == true) ||
            chat.messages.any { it.text.contains(searchQuery, ignoreCase = true) }
        val matchesFilter = when (selectedChatFilter) {
            "Непрочитанные" -> chat.unread > 0
            "Закреплённые" -> chat.isPinned
            else -> true
        }
        matchesSearch && matchesFilter
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    if (isSearchActive) {
                        TextField(
                            value = searchQuery,
                            onValueChange = { viewModel.setSearchQuery(it) },
                            placeholder = { Text("Поиск чатов и сообщений...") },
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
                            text = "TEGE",
                            fontWeight = FontWeight.Bold,
                            fontSize = 25.sp,
                            color = MaterialTheme.colorScheme.onSurface
                        )
                    }
                },
                navigationIcon = {
                    if (isSearchActive) {
                        IconButton(onClick = {
                            isSearchActive = false
                            viewModel.setSearchQuery("")
                        }) {
                            Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = MaterialTheme.colorScheme.onSurface)
                        }
                    } else {
                        IconButton(onClick = onOpenDrawer) {
                            Icon(Icons.Default.Menu, contentDescription = "Menu", tint = MaterialTheme.colorScheme.onSurface)
                        }
                    }
                },
                actions = {
                    if (!isSearchActive) {
                        IconButton(onClick = { isSearchActive = true }) {
                            Icon(Icons.Default.Search, contentDescription = "Search", tint = MaterialTheme.colorScheme.onSurface)
                        }
                    } else if (searchQuery.isNotEmpty()) {
                        IconButton(onClick = { viewModel.setSearchQuery("") }) {
                            Icon(Icons.Default.Close, contentDescription = "Clear", tint = MaterialTheme.colorScheme.onSurface)
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surface,
                    navigationIconContentColor = MaterialTheme.colorScheme.onSurface,
                    titleContentColor = MaterialTheme.colorScheme.onSurface,
                    actionIconContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        },
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                tonalElevation = 0.dp
            ) {
                NavigationBarItem(
                    selected = true,
                    onClick = {},
                    icon = { Icon(Icons.Default.ChatBubble, contentDescription = null) },
                    label = { Text("Чаты", maxLines = 1) }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = { viewModel.navigateTo(ScreenRoute.Channels) },
                    icon = { Icon(Icons.Default.Campaign, contentDescription = null) },
                    label = { Text("Каналы", maxLines = 1) }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = { viewModel.navigateTo(ScreenRoute.Settings) },
                    icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                    label = { Text("Настройки", maxLines = 1) }
                )
                NavigationBarItem(
                    selected = false,
                    onClick = { viewModel.navigateTo(ScreenRoute.Profile) },
                    icon = { Icon(Icons.Default.Person, contentDescription = null) },
                    label = { Text("Профиль", maxLines = 1) }
                )
            }
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = { viewModel.navigateTo(ScreenRoute.CreateChat) },
                containerColor = TelegramBlue,
                contentColor = Color.White
            ) {
                Icon(Icons.Default.Edit, contentDescription = "New Chat")
            }
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Stories Row at the top
            item {
                StoriesBar(
                    stories = stories,
                    onAddStory = onOpenCreateStory,
                    onViewStory = onViewStory
                )
                LazyRow(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(listOf("Все", "Непрочитанные", "Закреплённые")) { filter ->
                        FilterChip(
                            selected = selectedChatFilter == filter,
                            onClick = { selectedChatFilter = filter },
                            label = { Text(filter) },
                            leadingIcon = if (selectedChatFilter == filter) {
                                { Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(16.dp)) }
                            } else null
                        )
                    }
                }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant.copy(alpha = 0.4f))
            }

            // Chats list
            items(filteredChats, key = { it.id }) { chat ->
                ChatRowItem(
                    chat = chat,
                    searchQuery = searchQuery,
                    onClick = { viewModel.navigateTo(ScreenRoute.ChatDetail(chat.id)) },
                    onTogglePin = { viewModel.toggleChatPin(chat.id) }
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
            .padding(vertical = 10.dp),
        contentPadding = PaddingValues(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // "My Story" item
        item {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .width(64.dp)
                    .clickable(onClick = onAddStory)
            ) {
                Box(contentAlignment = Alignment.BottomEnd) {
                    Box(
                        modifier = Modifier
                            .size(56.dp)
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
                        .border(2.5.dp, TelegramBlue, CircleShape)
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

@Composable
fun ChatRowItem(
    chat: Chat,
    searchQuery: String = "",
    onClick: () -> Unit,
    onTogglePin: () -> Unit = {}
) {
    val matchingMessage = if (searchQuery.isBlank()) null else
        chat.messages.lastOrNull { it.text.contains(searchQuery, ignoreCase = true) }
    val previewText = matchingMessage?.text ?: chat.lastMessage

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 9.dp),
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
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
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

        Spacer(modifier = Modifier.width(14.dp))

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
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = chat.time,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (chat.isPinned) {
                        IconButton(onClick = onTogglePin, modifier = Modifier.size(28.dp)) {
                            Icon(
                                imageVector = Icons.Default.PushPin,
                                contentDescription = "Открепить чат",
                                tint = TelegramBlue,
                                modifier = Modifier.size(15.dp)
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = previewText,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
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
}
