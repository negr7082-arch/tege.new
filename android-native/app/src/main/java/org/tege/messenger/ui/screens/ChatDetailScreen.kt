package org.tege.messenger.ui.screens

import android.Manifest
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.media.MediaPlayer
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.ui.platform.LocalContext
import java.io.File
import androidx.compose.foundation.Canvas
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
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.tege.messenger.model.Chat
import org.tege.messenger.model.ChatType
import org.tege.messenger.model.Message
import org.tege.messenger.model.MessageReplyInfo
import org.tege.messenger.model.Poll
import org.tege.messenger.model.TextSize
import org.tege.messenger.model.WallpaperId
import org.tege.messenger.ui.components.CreatePollDialog
import org.tege.messenger.ui.components.TegeAvatar
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
    val settings by viewModel.settings.collectAsState()
    val currentAccount by viewModel.currentAccount.collectAsState()
    val messageError by viewModel.messageError.collectAsState()
    val currentUserId = currentAccount?.id ?: 0L
    val chat = chats.find { it.id == chatId } ?: return
    // These tools work locally only; do not present them as shared features in real chats.
    val allowLocalTools = chat.isSavedMessages || chat.userId == null
    val chatBackground = when (settings.wallpaper) {
        WallpaperId.PATTERN -> MaterialTheme.colorScheme.background
        WallpaperId.DARK -> Color(0xFF101820)
        WallpaperId.EMERALD -> Color(0xFF0D2818)
        WallpaperId.SUNSET -> Color(0xFFFCE7F3)
        WallpaperId.OCEAN -> Color(0xFFE0F2FE)
        WallpaperId.MINIMAL -> MaterialTheme.colorScheme.surface
    }
    val isDarkChatWallpaper = settings.wallpaper == WallpaperId.DARK ||
        settings.wallpaper == WallpaperId.EMERALD

    var inputText by remember { mutableStateOf("") }
    var replyTo by remember { mutableStateOf<MessageReplyInfo?>(null) }
    var showPollDialog by remember { mutableStateOf(false) }
    var showMenu by remember { mutableStateOf(false) }
    var showClearHistoryDialog by remember { mutableStateOf(false) }
    var editingMessageId by remember { mutableStateOf<Long?>(null) }
    var deletingMessageId by remember { mutableStateOf<Long?>(null) }
    var isRecording by remember { mutableStateOf(false) }
    var recorder by remember { mutableStateOf<MediaRecorder?>(null) }
    var recordingFile by remember { mutableStateOf<File?>(null) }
    var recordingStartedAt by remember { mutableLongStateOf(0L) }
    val context = LocalContext.current

    LaunchedEffect(messageError) {
        messageError?.let {
            Toast.makeText(context, it, Toast.LENGTH_LONG).show()
            viewModel.clearMessageError()
        }
    }

    LaunchedEffect(chatId) {
        viewModel.markChatRead(chatId)
    }

    val startRecording: () -> Unit = {
        try {
            val file = File(context.cacheDir, "tege-voice-${System.currentTimeMillis()}.m4a")
            val mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) MediaRecorder(context) else MediaRecorder()
            mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC)
            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            mediaRecorder.setAudioSamplingRate(44100)
            mediaRecorder.setAudioEncodingBitRate(96000)
            mediaRecorder.setOutputFile(file.absolutePath)
            mediaRecorder.prepare()
            mediaRecorder.start()
            recorder = mediaRecorder
            recordingFile = file
            recordingStartedAt = System.currentTimeMillis()
            isRecording = true
        } catch (_: Exception) {
            recorder?.release()
            recorder = null
            isRecording = false
        }
    }
    val stopRecording: () -> Unit = {
        val elapsedSeconds = ((System.currentTimeMillis() - recordingStartedAt) / 1000L).toInt().coerceAtLeast(1)
        try {
            recorder?.stop()
            recordingFile?.takeIf { it.exists() && it.length() > 0L }?.let {
                viewModel.sendVoiceMessage(chat.id, it.absolutePath, elapsedSeconds)
            }
        } catch (_: Exception) {
            // MediaRecorder can fail if the recording is too short; don't add an invalid message.
        } finally {
            recorder?.release()
            recorder = null
            recordingFile = null
            isRecording = false
        }
    }
    val audioPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> if (granted) startRecording() }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        TegeAvatar(
                            avatarUri = chat.avatarUri,
                            displayName = chat.name,
                            color = Color(android.graphics.Color.parseColor(chat.color)),
                            modifier = Modifier.size(40.dp),
                            savedMessages = chat.isSavedMessages
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = chat.name,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                                color = Color.White
                            )
                            val subtitle = when {
                                chat.isSavedMessages -> "Избранное"
                                chat.type == ChatType.CHANNEL -> if (chat.subscribersCount > 0) "${chat.subscribersCount} подписчиков" else "канал"
                                chat.type == ChatType.GROUP -> if (chat.membersCount > 0) "${chat.membersCount} участников" else "группа"
                                chat.online -> "в сети"
                                !chat.username.isNullOrBlank() -> chat.username.let {
                                    if (it.startsWith("@")) it else "@$it"
                                }
                                else -> "профиль"
                            }
                            if (subtitle.isNotBlank()) {
                                Text(
                                    text = subtitle,
                                    fontSize = 12.sp,
                                    color = Color.White.copy(alpha = 0.82f)
                                )
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }
                },
                actions = {
                    if (allowLocalTools) {
                        IconButton(onClick = { showPollDialog = true }) {
                            Icon(Icons.Default.Poll, contentDescription = "Create Poll", tint = Color.White)
                        }
                    }
                    IconButton(onClick = { showMenu = !showMenu }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "More", tint = Color.White)
                    }
                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text(if (chat.isPinned) "Открепить чат" else "Закрепить чат") },
                            onClick = {
                                viewModel.toggleChatPin(chat.id)
                                showMenu = false
                            },
                            leadingIcon = { Icon(Icons.Default.PushPin, contentDescription = null) }
                        )
                        DropdownMenuItem(
                            text = { Text("Отметить непрочитанным") },
                            onClick = {
                                viewModel.markChatUnread(chat.id)
                                showMenu = false
                                onBack()
                            },
                            leadingIcon = { Icon(Icons.Default.Markunread, contentDescription = null) }
                        )
                        DropdownMenuItem(
                            text = { Text("Скопировать историю чата") },
                            onClick = {
                                val transcript = buildString {
                                    appendLine(chat.name)
                                    appendLine("—".repeat(chat.name.length.coerceAtLeast(8)))
                                    chat.messages.forEach { message ->
                                        val body = when {
                                            message.poll != null -> "Опрос: ${message.poll.question}"
                                            message.audioUri != null -> "Голосовое сообщение ${message.voiceDuration.orEmpty()}".trim()
                                            message.videoNoteUri != null -> "Видеосообщение"
                                            message.attachmentUri != null -> message.fileName ?: "Вложение"
                                            message.text.isNotBlank() -> message.text
                                            else -> "Сообщение"
                                        }
                                        appendLine("[${message.time}] ${if (message.isMine) "Вы" else message.senderName ?: chat.name}: $body")
                                    }
                                }
                                if (chat.messages.isEmpty()) {
                                    Toast.makeText(context, "История чата пуста", Toast.LENGTH_SHORT).show()
                                } else {
                                    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                    clipboard.setPrimaryClip(ClipData.newPlainText("История чата: ${chat.name}", transcript))
                                    Toast.makeText(context, "История скопирована", Toast.LENGTH_SHORT).show()
                                }
                                showMenu = false
                            },
                            leadingIcon = { Icon(Icons.Default.ContentCopy, contentDescription = null) }
                        )
                        DropdownMenuItem(
                            text = { Text("Очистить локальную историю") },
                            onClick = {
                                showMenu = false
                                showClearHistoryDialog = true
                            }
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = TelegramBlue)
            )
        },
        bottomBar = {
            Surface(
                tonalElevation = 2.dp,
                color = MaterialTheme.colorScheme.surface,
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    if (allowLocalTools) {
                        IconButton(onClick = { showPollDialog = true }) {
                            Icon(Icons.Default.Poll, contentDescription = "Poll", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }

                    TextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        placeholder = {
                            Text(
                                if (editingMessageId != null) "Редактирование..."
                                else if (replyTo != null) "Ответ ${replyTo?.senderName}: ${replyTo?.text?.take(24)}"
                                else "Сообщение"
                            )
                        },
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 4.dp),
                        shape = RoundedCornerShape(24.dp),
                        colors = TextFieldDefaults.colors(
                            focusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f),
                            unfocusedContainerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f),
                            focusedIndicatorColor = Color.Transparent,
                            unfocusedIndicatorColor = Color.Transparent,
                            focusedLeadingIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                            unfocusedLeadingIconColor = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    )

                    if (editingMessageId != null) {
                        IconButton(onClick = {
                            inputText = ""
                            editingMessageId = null
                        }) {
                            Icon(Icons.Default.Close, contentDescription = "Отменить редактирование", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                    if (inputText.isNotBlank()) {
                        IconButton(
                            onClick = {
                                val editingId = editingMessageId
                                val completed = if (editingId != null) {
                                    viewModel.editMessage(chat.id, editingId, inputText)
                                } else {
                                    viewModel.sendMessage(chat.id, inputText, replyTo)
                                }
                                if (completed) {
                                    inputText = ""
                                    replyTo = null
                                    editingMessageId = null
                                }
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Send,
                                contentDescription = "Send",
                                tint = TelegramBlue
                            )
                        }
                    } else if (allowLocalTools) {
                        IconButton(
                            onClick = {
                                if (isRecording) {
                                    stopRecording()
                                } else if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                                    startRecording()
                                } else {
                                    audioPermissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                }
                            }
                        ) {
                            Icon(
                                imageVector = if (isRecording) Icons.Default.Stop else Icons.Default.Mic,
                                contentDescription = if (isRecording) "Остановить запись и отправить" else "Записать голосовое сообщение",
                                tint = if (isRecording) MaterialTheme.colorScheme.error else TelegramBlue
                            )
                        }
                    }
                }
            }
        }
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .background(chatBackground)
        ) {
            if (settings.wallpaper == WallpaperId.PATTERN) {
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val patternColor = if (settings.isDarkMode) {
                        Color.White.copy(alpha = 0.045f)
                    } else {
                        Color(0xFF7893A2).copy(alpha = 0.12f)
                    }
                    val stepX = 104.dp.toPx()
                    val stepY = 86.dp.toPx()
                    var row = 0
                    while (row * stepY < size.height + stepY) {
                        var column = 0
                        while (column * stepX < size.width + stepX) {
                            val x = column * stepX + if (row % 2 == 0) 18.dp.toPx() else 52.dp.toPx()
                            val y = row * stepY + 18.dp.toPx()
                            drawCircle(
                                color = patternColor,
                                radius = 11.dp.toPx(),
                                center = Offset(x, y),
                                style = Stroke(width = 1.dp.toPx())
                            )
                            drawLine(
                                color = patternColor,
                                start = Offset(x - 8.dp.toPx(), y + 16.dp.toPx()),
                                end = Offset(x + 10.dp.toPx(), y + 23.dp.toPx()),
                                strokeWidth = 1.dp.toPx()
                            )
                            column++
                        }
                        row++
                    }
                }
            }

            LazyColumn(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 12.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                if (chat.messages.isEmpty()) {
                    item {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 28.dp, vertical = 56.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = if (chat.isSavedMessages) Icons.Default.Bookmark else Icons.Default.ChatBubbleOutline,
                                contentDescription = null,
                                tint = if (isDarkChatWallpaper) Color.White.copy(alpha = 0.8f) else MaterialTheme.colorScheme.onSurfaceVariant,
                                modifier = Modifier.size(38.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = if (chat.isSavedMessages) "Избранное" else "Пока нет сообщений",
                                fontSize = 17.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = if (isDarkChatWallpaper) Color.White else MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }
                } else {
                    items(chat.messages, key = { it.id }) { message ->
                    MessageBubble(
                        message = message,
                        isChannel = chat.type == ChatType.CHANNEL,
                        currentUserId = currentUserId,
                        textSize = settings.textSize,
                        allowLocalTools = allowLocalTools,
                        onVotePoll = { optId -> viewModel.votePoll(chat.id, message.id, optId) },
                        onReaction = { emoji -> viewModel.toggleReaction(chat.id, message.id, emoji) },
                        onReply = {
                            replyTo = MessageReplyInfo(
                                id = message.id,
                                senderName = message.senderName ?: if (message.isMine) "Вы" else chat.name,
                                text = message.text
                            )
                        },
                        onPin = { viewModel.pinMessage(chat.id, message.id) },
                        onEdit = {
                            if (message.isMine && message.poll == null && message.audioUri == null && message.videoNoteUri == null) {
                                editingMessageId = message.id
                                inputText = message.text
                                replyTo = null
                            }
                        },
                        onDelete = { deletingMessageId = message.id }
                    )
                    }
                }
            }
        }
    }

    if (showClearHistoryDialog) {
        AlertDialog(
            onDismissRequest = { showClearHistoryDialog = false },
            title = { Text("Очистить историю?") },
            text = { Text("Все сообщения в этом чате будут удалены с этого устройства. Это действие нельзя отменить.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        viewModel.clearChatHistory(chat.id)
                        showClearHistoryDialog = false
                    }
                ) {
                    Text("Очистить", color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { showClearHistoryDialog = false }) {
                    Text("Отмена")
                }
            }
        )
    }

    if (deletingMessageId != null) {
        AlertDialog(
            onDismissRequest = { deletingMessageId = null },
            title = { Text("Удалить сообщение?") },
            text = { Text("Удалить это сообщение?") },
            confirmButton = {
                TextButton(onClick = {
                    val removed = deletingMessageId?.let { viewModel.deleteMessage(chat.id, it) } ?: false
                    if (removed) {
                        if (editingMessageId == deletingMessageId) {
                            editingMessageId = null
                            inputText = ""
                        }
                        deletingMessageId = null
                    }
                }) { Text("Удалить", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { deletingMessageId = null }) { Text("Отмена") } }
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
    currentUserId: Long = 112201L,
    textSize: TextSize = TextSize.MEDIUM,
    allowLocalTools: Boolean = true,
    onVotePoll: (Int) -> Unit,
    onReaction: (String) -> Unit,
    onReply: () -> Unit = {},
    onPin: () -> Unit = {},
    onEdit: () -> Unit = {},
    onDelete: () -> Unit = {}
) {
    var showMessageActions by remember(message.id) { mutableStateOf(false) }

    // 1. Telegram Circular Video Note (Кружочек)
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
                    .background(Color.Black),
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

                if (message.isPinned) {
                    Text("📌 Закреплено", fontSize = 11.sp, color = TelegramBlue, fontWeight = FontWeight.SemiBold)
                }
                if (message.replyTo != null) {
                    Text("↪ ${message.replyTo.senderName}: ${message.replyTo.text}", fontSize = 12.sp, color = textColor.copy(alpha = 0.75f), maxLines = 2)
                }

                if (message.audioUri != null) {
                    var isVoicePlaying by remember(message.id) { mutableStateOf(false) }
                    var voicePlayer by remember(message.id) { mutableStateOf<MediaPlayer?>(null) }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(
                            onClick = {
                                if (isVoicePlaying) {
                                    voicePlayer?.release()
                                    voicePlayer = null
                                    isVoicePlaying = false
                                } else {
                                    try {
                                        val player = MediaPlayer()
                                        player.setDataSource(message.audioUri)
                                        player.setOnCompletionListener {
                                            isVoicePlaying = false
                                            voicePlayer = null
                                            it.release()
                                        }
                                        player.prepare()
                                        player.start()
                                        voicePlayer = player
                                        isVoicePlaying = true
                                    } catch (_: Exception) {
                                        voicePlayer?.release()
                                        voicePlayer = null
                                        isVoicePlaying = false
                                    }
                                }
                            }
                        ) {
                            Icon(
                                imageVector = if (isVoicePlaying) Icons.Default.Stop else Icons.Default.PlayArrow,
                                contentDescription = if (isVoicePlaying) "Остановить голосовое" else "Воспроизвести голосовое",
                                tint = TelegramBlue
                            )
                        }
                        Column {
                            Text("Голосовое сообщение", color = textColor, fontSize = 14.sp)
                            Text(message.voiceDuration ?: "", color = textColor.copy(alpha = 0.7f), fontSize = 11.sp)
                        }
                    }
                } else if (message.poll != null) {
                    PollWidget(
                        poll = message.poll,
                        isMine = message.isMine,
                        textSize = textSize,
                        onVote = onVotePoll
                    )
                } else {
                    Text(
                        text = message.text,
                        color = textColor,
                        fontSize = when (textSize) {
                            TextSize.SMALL -> 13.sp
                            TextSize.MEDIUM -> 15.sp
                            TextSize.LARGE -> 17.sp
                            TextSize.XLARGE -> 19.sp
                        }
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
                }
            }
        }

        // Keep the conversation clean like Telegram: show only existing reactions,
        // and move message actions into a compact overflow menu.
        val existingReactions = message.reactions.filterValues { it > 0 }
        if (allowLocalTools && (existingReactions.isNotEmpty() || !isChannel)) {
            Row(
                modifier = Modifier.padding(top = 1.dp),
                horizontalArrangement = Arrangement.spacedBy(4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                existingReactions.forEach { (emoji, count) ->
                    val isSelectedByMe = message.userReactions[currentUserId] == emoji
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(
                                if (isSelectedByMe) TelegramBlue.copy(alpha = 0.18f)
                                else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.6f)
                            )
                            .then(
                                if (isSelectedByMe) Modifier.border(
                                    width = 1.dp,
                                    color = TelegramBlue.copy(alpha = 0.75f),
                                    shape = RoundedCornerShape(12.dp)
                                ) else Modifier
                            )
                            .clickable { onReaction(emoji) }
                            .padding(horizontal = 7.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "$emoji $count",
                            fontSize = 12.sp,
                            fontWeight = if (isSelectedByMe) FontWeight.SemiBold else FontWeight.Normal,
                            color = if (isSelectedByMe) TelegramBlue else MaterialTheme.colorScheme.onSurface
                        )
                    }
                }
                Spacer(modifier = Modifier.weight(1f))
                Box {
                    IconButton(
                        onClick = { showMessageActions = true },
                        modifier = Modifier.size(28.dp)
                    ) {
                        Icon(
                            Icons.Default.MoreHoriz,
                            contentDescription = "Действия с сообщением",
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.size(17.dp)
                        )
                    }
                    DropdownMenu(
                        expanded = showMessageActions,
                        onDismissRequest = { showMessageActions = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text("Ответить") },
                            leadingIcon = { Icon(Icons.Default.Reply, contentDescription = null) },
                            onClick = { showMessageActions = false; onReply() }
                        )
                        if (allowLocalTools) {
                            DropdownMenuItem(
                                text = { Text(if (message.isPinned) "Открепить" else "Закрепить") },
                                leadingIcon = { Icon(Icons.Default.PushPin, contentDescription = null) },
                                onClick = { showMessageActions = false; onPin() }
                            )
                        }
                        if (message.isMine && message.poll == null && message.audioUri == null && message.videoNoteUri == null) {
                            DropdownMenuItem(
                                text = { Text("Редактировать") },
                                leadingIcon = { Icon(Icons.Default.Edit, contentDescription = null) },
                                onClick = { showMessageActions = false; onEdit() }
                            )
                        }
                        if (message.isMine) {
                            DropdownMenuItem(
                                text = { Text("Удалить") },
                                leadingIcon = { Icon(Icons.Default.DeleteOutline, contentDescription = null) },
                                onClick = { showMessageActions = false; onDelete() }
                            )
                        }
                        if (allowLocalTools) {
                            listOf("❤️", "🔥", "👍", "😂", "😮", "😢").forEach { emoji ->
                                val isSelectedByMe = message.userReactions[currentUserId] == emoji
                                DropdownMenuItem(
                                    text = {
                                        Text(if (isSelectedByMe) "Убрать реакцию $emoji" else "Поставить реакцию $emoji")
                                    },
                                    onClick = { showMessageActions = false; onReaction(emoji) }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PollWidget(
    poll: Poll,
    isMine: Boolean,
    textSize: TextSize = TextSize.MEDIUM,
    onVote: (Int) -> Unit
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            text = poll.question,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface,
            fontSize = when (textSize) {
                TextSize.SMALL -> 14.sp
                TextSize.MEDIUM -> 16.sp
                TextSize.LARGE -> 18.sp
                TextSize.XLARGE -> 20.sp
            }
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
                    Text(
                        text = opt.text,
                        color = MaterialTheme.colorScheme.onSurface,
                        fontSize = when (textSize) {
                            TextSize.SMALL -> 12.sp
                            TextSize.MEDIUM -> 14.sp
                            TextSize.LARGE -> 16.sp
                            TextSize.XLARGE -> 18.sp
                        }
                    )
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
