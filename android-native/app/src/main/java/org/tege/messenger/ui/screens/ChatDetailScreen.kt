package org.tege.messenger.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import android.content.Intent
import androidx.compose.ui.platform.LocalContext
import org.tege.messenger.ui.components.TelegramAttachmentSheet
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.tege.messenger.model.Chat
import org.tege.messenger.model.ChatType
import org.tege.messenger.model.Message
import org.tege.messenger.model.Poll
import org.tege.messenger.ui.components.CreatePollDialog
import org.tege.messenger.ui.theme.TelegramBlue
import org.tege.messenger.viewmodel.TegeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatDetailScreen(
    chatId: Long,
    viewModel: TegeViewModel,
    onBack: () -> Unit
) {
    val chats by viewModel.chats.collectAsState()
    val chat = chats.find { it.id == chatId } ?: return

    var inputText by remember { mutableStateOf("") }
    var showPollDialog by remember { mutableStateOf(false) }
    var showMenu by remember { mutableStateOf(false) }
    var isVideoNoteMode by remember { mutableStateOf(true) }
    var showAttachmentSheet by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(CircleShape)
                                .background(Color(android.graphics.Color.parseColor(chat.color))),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = chat.name.take(1).uppercase(),
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = chat.name,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = Color.White
                            )
                            Text(
                                text = if (chat.type == ChatType.CHANNEL) "${chat.subscribersCount} подписчиков" else if (chat.online) "в сети" else "был(а) недавно",
                                fontSize = 12.sp,
                                color = Color.White.copy(alpha = 0.8f)
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }
                },
                actions = {
                    // Video Call / Live Broadcast button for Groups & Channels
                    if (chat.type == ChatType.GROUP || chat.type == ChatType.CHANNEL) {
                        IconButton(
                            onClick = { viewModel.toggleGroupVideoChat(chat.id) }
                        ) {
                            Icon(
                                imageVector = if (chat.activeVideoChat?.isActive == true) Icons.Default.Radio else Icons.Default.Videocam,
                                contentDescription = "Video Call",
                                tint = if (chat.activeVideoChat?.isActive == true) Color(0xFF4CAF50) else Color.White
                            )
                        }
                    }

                    IconButton(onClick = { showPollDialog = true }) {
                        Icon(Icons.Default.Poll, contentDescription = "Create Poll", tint = Color.White)
                    }
                    IconButton(onClick = { showMenu = !showMenu }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "More", tint = Color.White)
                    }
                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Очистить историю") },
                            onClick = { showMenu = false }
                        )
                        DropdownMenuItem(
                            text = { Text("Заблокировать") },
                            onClick = {
                                viewModel.blockUser(chat.id, chat.name, chat.username ?: "user")
                                showMenu = false
                            }
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = TelegramBlue)
            )
        },
        bottomBar = {
            Surface(
                tonalElevation = 3.dp,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { showAttachmentSheet = true }) {
                        Icon(Icons.Default.AttachFile, contentDescription = "Прикрепить файл", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }

                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        placeholder = { Text("Сообщение...") },
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 4.dp),
                        shape = RoundedCornerShape(24.dp),
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.4f),
                            focusedIndicatorColor = Color.Transparent,
                            unfocusedIndicatorColor = Color.Transparent
                        )
                    )

                    if (inputText.isNotBlank()) {
                        IconButton(
                            onClick = {
                                viewModel.sendMessage(chat.id, inputText)
                                inputText = ""
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Send,
                                contentDescription = "Send",
                                tint = TelegramBlue
                            )
                        }
                    } else {
                        // Telegram Video Note (Кружочек) / Mic quick toggle button
                        IconButton(
                            onClick = {
                                if (isVideoNoteMode) {
                                    viewModel.sendVideoNote(chat.id)
                                } else {
                                    viewModel.sendMessage(chat.id, "🎤 Голосовое сообщение (0:15)")
                                }
                            }
                        ) {
                            Icon(
                                imageVector = if (isVideoNoteMode) Icons.Default.Videocam else Icons.Default.Mic,
                                contentDescription = "Video Note / Mic",
                                tint = TelegramBlue
                            )
                        }
                    }
                }
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Telegram Active Video Chat Banner for Groups & Channels
            if (chat.activeVideoChat?.isActive == true) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF229ED9))
                        .clickable { viewModel.toggleGroupVideoChat(chat.id) }
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF4CAF50))
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = if (chat.type == ChatType.CHANNEL) "Прямая трансляция активна" else "Видеочат активен",
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 13.sp
                            )
                            Text(
                                text = "Организатор: ${chat.activeVideoChat.startedByName} • Подключиться",
                                color = Color.White.copy(alpha = 0.85f),
                                fontSize = 11.sp
                            )
                        }
                    }
                    Button(
                        onClick = { viewModel.toggleGroupVideoChat(chat.id) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = TelegramBlue),
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                        shape = RoundedCornerShape(16.dp)
                    ) {
                        Text("Войти", fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(chat.messages, key = { it.id }) { message ->
                    MessageBubble(
                        message = message,
                        isChannel = chat.type == ChatType.CHANNEL,
                        onVotePoll = { optId -> viewModel.votePoll(chat.id, message.id, optId) },
                        onReaction = { emoji -> viewModel.toggleReaction(chat.id, message.id, emoji) }
                    )
                }
            }
        }
    }

    if (showAttachmentSheet) {
        TelegramAttachmentSheet(
            onDismiss = { showAttachmentSheet = false },
            onPicked = { media ->
                viewModel.sendAttachment(chat.id, media.uri.toString(), media.displayName, media.sizeBytes)
            }
        )
    }

    if (showPollDialog) {
        CreatePollDialog(
            onDismiss = { showPollDialog = false },
            onCreate = { question, options ->
                viewModel.sendPoll(chat.id, question, options)
            }
        )
    }
}

@Composable
fun MessageBubble(
    message: Message,
    isChannel: Boolean = false,
    onVotePoll: (Int) -> Unit,
    onReaction: (String) -> Unit
) {
    val context = LocalContext.current

    // Telegram-style video note stays a circular message, never a rectangular video attachment.
    if (message.videoNoteUri != null) {
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = if (message.isMine) Alignment.End else Alignment.Start
        ) {
            Box(
                modifier = Modifier
                    .size(200.dp)
                    .border(2.5.dp, TelegramBlue, CircleShape)
                    .clip(CircleShape)
                    .background(Color.Black)
                    .clickable {
                        val uri = android.net.Uri.parse(message.videoNoteUri)
                        val intent = Intent(Intent.ACTION_VIEW).apply {
                            setDataAndType(uri, "video/*")
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        runCatching { context.startActivity(intent) }
                    },
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Default.PlayCircle,
                    contentDescription = "Video Note",
                    tint = Color.White.copy(alpha = 0.85f),
                    modifier = Modifier.size(56.dp)
                )
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomEnd)
                        .padding(12.dp)
                        .clip(RoundedCornerShape(8.dp))
                        .background(Color.Black.copy(alpha = 0.6f))
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = message.time,
                        color = Color.White,
                        fontSize = 10.sp
                    )
                }
            }
        }
        return
    }

    // 2. Telegram Bubble Styling:
    // - In channels: clean neutral card
    // - Direct chats: soft telegram colors
    val bubbleColor = if (isChannel) {
        MaterialTheme.colorScheme.surface
    } else if (message.isMine) {
        Color(0xFFEFFEDD)
    } else {
        MaterialTheme.colorScheme.surface
    }

    val textColor = if (message.isMine && !isChannel) {
        Color(0xFF1E293B)
    } else {
        MaterialTheme.colorScheme.onSurface
    }

    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (isChannel) Alignment.Start else if (message.isMine) Alignment.End else Alignment.Start
    ) {
        Card(
            shape = RoundedCornerShape(
                topStart = 16.dp,
                topEnd = 16.dp,
                bottomStart = if (message.isMine && !isChannel) 16.dp else 4.dp,
                bottomEnd = if (message.isMine && !isChannel) 4.dp else 16.dp
            ),
            colors = CardDefaults.cardColors(containerColor = bubbleColor),
            modifier = Modifier.widthIn(max = 300.dp)
        ) {
            Column(modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
                if (isChannel && message.senderName != null) {
                    Text(
                        text = message.senderName,
                        fontWeight = FontWeight.Bold,
                        fontSize = 13.sp,
                        color = TelegramBlue
                    )
                    Spacer(modifier = Modifier.height(2.dp))
                }

                if (message.attachmentUri != null) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f))
                            .clickable {
                                val uri = android.net.Uri.parse(message.attachmentUri)
                                val mime = context.contentResolver.getType(uri) ?: when {
                                    message.fileName?.endsWith(".pdf", ignoreCase = true) == true -> "application/pdf"
                                    message.fileName?.endsWith(".jpg", ignoreCase = true) == true ||
                                        message.fileName?.endsWith(".jpeg", ignoreCase = true) == true -> "image/jpeg"
                                    message.fileName?.endsWith(".png", ignoreCase = true) == true -> "image/png"
                                    message.fileName?.endsWith(".mp4", ignoreCase = true) == true -> "video/mp4"
                                    message.fileName?.endsWith(".mp3", ignoreCase = true) == true -> "audio/mpeg"
                                    else -> "*/*"
                                }
                                val intent = Intent(Intent.ACTION_VIEW).apply {
                                    setDataAndType(uri, mime)
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                }
                                runCatching { context.startActivity(intent) }
                            }
                            .padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Icon(
                            imageVector = when {
                                message.fileName?.endsWith(".jpg", true) == true ||
                                    message.fileName?.endsWith(".png", true) == true -> Icons.Default.Image
                                message.fileName?.endsWith(".mp3", true) == true ||
                                    message.fileName?.endsWith(".wav", true) == true -> Icons.Default.AudioFile
                                else -> Icons.Default.AttachFile
                            },
                            contentDescription = "Файл",
                            tint = TelegramBlue
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(message.fileName ?: "Файл", fontWeight = FontWeight.SemiBold, color = textColor)
                            Text(
                                message.fileSize ?: "Нажмите, чтобы открыть",
                                fontSize = 11.sp,
                                color = textColor.copy(alpha = 0.7f)
                            )
                        }
                    }
                } else if (message.poll != null) {
                    PollWidget(
                        poll = message.poll,
                        isMine = message.isMine,
                        onVote = onVotePoll
                    )
                } else {
                    Text(
                        text = message.text,
                        color = textColor,
                        fontSize = 15.sp
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                Row(
                    modifier = Modifier.align(Alignment.End),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = message.time,
                        fontSize = 11.sp,
                        color = textColor.copy(alpha = 0.7f)
                    )
                    if (message.isMine && !isChannel) {
                        Spacer(modifier = Modifier.width(4.dp))
                        Icon(
                            imageVector = Icons.Default.DoneAll,
                            contentDescription = "Delivered",
                            tint = TelegramBlue,
                            modifier = Modifier.size(14.dp)
                        )
                    }
                }
            }
        }

        // Reactions row
        Row(
            modifier = Modifier.padding(top = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            listOf("❤️", "🔥", "👍").forEach { emoji ->
                val count = message.reactions[emoji] ?: 0
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(12.dp))
                        .background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f))
                        .clickable { onReaction(emoji) }
                        .padding(horizontal = 6.dp, vertical = 2.dp)
                ) {
                    Text(
                        text = if (count > 0) "$emoji $count" else emoji,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}

@Composable
fun PollWidget(
    poll: Poll,
    isMine: Boolean,
    onVote: (Int) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = poll.question,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            fontSize = 16.sp
        )
        Text(
            text = "Анонимный опрос • Всего голосов: ${poll.totalVotes}",
            fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(modifier = Modifier.height(8.dp))

        poll.options.forEach { opt ->
            val percentage = if (poll.totalVotes > 0) (opt.votes * 100 / poll.totalVotes) else 0
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onVote(opt.id) }
                    .padding(vertical = 4.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(text = opt.text, color = MaterialTheme.colorScheme.onSurface, fontSize = 14.sp)
                    Text(text = "$percentage%", color = TelegramBlue, fontSize = 13.sp)
                }
                Spacer(modifier = Modifier.height(3.dp))
                LinearProgressIndicator(
                    progress = { percentage / 100f },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(6.dp)
                        .clip(RoundedCornerShape(3.dp)),
                    color = TelegramBlue,
                    trackColor = MaterialTheme.colorScheme.surfaceVariant
                )
            }
        }
    }
}
