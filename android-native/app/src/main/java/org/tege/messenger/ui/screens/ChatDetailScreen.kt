package org.tege.messenger.ui.screens

import android.Manifest
import android.content.pm.PackageManager
import android.media.MediaRecorder
import android.media.MediaPlayer
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.compose.ui.platform.LocalContext
import java.io.File
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.tege.messenger.model.Chat
import org.tege.messenger.model.ChatType
import org.tege.messenger.model.Message
import org.tege.messenger.model.MessageReplyInfo
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
                                color = MaterialTheme.colorScheme.onSurface
                            )
                            Text(
                                text = if (chat.type == ChatType.CHANNEL) "${chat.subscribersCount} подписчиков" else if (chat.online) "в сети" else "был(а) недавно",
                                fontSize = 12.sp,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = MaterialTheme.colorScheme.onSurface)
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
                                tint = if (chat.activeVideoChat?.isActive == true) Color(0xFF4CAF50) else MaterialTheme.colorScheme.onSurface
                            )
                        }
                    }

                    IconButton(onClick = { showPollDialog = true }) {
                        Icon(Icons.Default.Poll, contentDescription = "Create Poll", tint = MaterialTheme.colorScheme.onSurface)
                    }
                    IconButton(onClick = { showMenu = !showMenu }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "More", tint = MaterialTheme.colorScheme.onSurface)
                    }
                    DropdownMenu(
                        expanded = showMenu,
                        onDismissRequest = { showMenu = false }
                    ) {
                        DropdownMenuItem(
                            text = { Text(if (chat.isMuted) "Включить уведомления" else "Отключить уведомления") },
                            onClick = {
                                viewModel.toggleChatMute(chat.id)
                                showMenu = false
                            },
                            leadingIcon = {
                                Icon(
                                    if (chat.isMuted) Icons.Default.NotificationsActive else Icons.Default.NotificationsOff,
                                    contentDescription = null
                                )
                            }
                        )
                        DropdownMenuItem(
                            text = { Text(if (chat.isPinned) "Открепить чат" else "Закрепить чат") },
                            onClick = {
                                viewModel.toggleChatPin(chat.id)
                                showMenu = false
                            },
                            leadingIcon = { Icon(Icons.Default.PushPin, contentDescription = null) }
                        )
                        DropdownMenuItem(
                            text = { Text("Очистить историю") },
                            onClick = {
                                showMenu = false
                                showClearHistoryDialog = true
                            }
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
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
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
                    IconButton(onClick = { showPollDialog = true }) {
                        Icon(Icons.Default.Poll, contentDescription = "Poll", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }

                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { inputText = it },
                        placeholder = {
                            Text(
                                if (editingMessageId != null) "Редактирование сообщения..."
                                else if (replyTo != null) "Ответ ${replyTo?.senderName}: ${replyTo?.text?.take(24)}"
                                else "Сообщение..."
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
                            unfocusedIndicatorColor = Color.Transparent
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
                                if (editingId != null) {
                                    viewModel.editMessage(chat.id, editingId, inputText)
                                } else {
                                    viewModel.sendMessage(chat.id, inputText, replyTo)
                                }
                                inputText = ""
                                replyTo = null
                                editingMessageId = null
                            }
                        ) {
                            Icon(
                                imageVector = Icons.Default.Send,
                                contentDescription = "Send",
                                tint = TelegramBlue
                            )
                        }
                    } else {
                        IconButton(onClick = { viewModel.sendVideoNote(chat.id) }) {
                            Icon(Icons.Default.Videocam, contentDescription = "Отправить видеосообщение", tint = TelegramBlue)
                        }
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
            text = { Text("Сообщение будет удалено из локальной истории этого чата.") },
            confirmButton = {
                TextButton(onClick = {
                    deletingMessageId?.let { viewModel.deleteMessage(chat.id, it) }
                    if (editingMessageId == deletingMessageId) {
                        editingMessageId = null
                        inputText = ""
                    }
                    deletingMessageId = null
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
    onVotePoll: (Int) -> Unit,
    onReaction: (String) -> Unit,
    onReply: () -> Unit = {},
    onPin: () -> Unit = {},
    onEdit: () -> Unit = {},
    onDelete: () -> Unit = {}
) {
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

        // Reply and pin controls plus local reactions.
        Row(
            modifier = Modifier.padding(top = 2.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onReply, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Default.Reply, contentDescription = "Ответить", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
            }
            IconButton(onClick = onPin, modifier = Modifier.size(28.dp)) {
                Icon(Icons.Default.PushPin, contentDescription = if (message.isPinned) "Открепить сообщение" else "Закрепить сообщение", tint = if (message.isPinned) TelegramBlue else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
            }
            if (message.isMine && message.poll == null && message.audioUri == null && message.videoNoteUri == null) {
                IconButton(onClick = onEdit, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.Edit, contentDescription = "Редактировать сообщение", tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(16.dp))
                }
            }
            if (message.isMine) {
                IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                    Icon(Icons.Default.DeleteOutline, contentDescription = "Удалить сообщение", tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(16.dp))
                }
            }
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
