package org.tege.messenger.ui.screens

import android.graphics.BitmapFactory
import android.net.Uri
import android.widget.VideoView
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.tege.messenger.ui.components.TegeAvatar
import org.tege.messenger.ui.theme.TelegramBlue
import org.tege.messenger.viewmodel.TegeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    viewModel: TegeViewModel,
    onBack: () -> Unit
) {
    val account by viewModel.currentAccount.collectAsState()
    val context = LocalContext.current
    var bannerUri by remember { mutableStateOf<String?>(null) }
    var bannerIsVideo by remember { mutableStateOf(false) }
    val bannerPicker = rememberLauncherForActivityResult(PickVisualMedia()) { uri: Uri? ->
        if (uri != null) {
            runCatching { context.contentResolver.takePersistableUriPermission(uri, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION) }
            bannerUri = uri.toString()
            bannerIsVideo = context.contentResolver.getType(uri)?.startsWith("video/") == true
            context.getSharedPreferences("tege_profile_customization", android.content.Context.MODE_PRIVATE)
                .edit().putString("profile_banner_uri", bannerUri).putBoolean("profile_banner_video", bannerIsVideo).apply()
        }
    }
    LaunchedEffect(Unit) {
        val prefs = context.getSharedPreferences("tege_profile_customization", android.content.Context.MODE_PRIVATE)
        bannerUri = prefs.getString("profile_banner_uri", null)
        bannerIsVideo = prefs.getBoolean("profile_banner_video", false)
    }
    var showEditDialog by remember { mutableStateOf(false) }
    var editName by remember { mutableStateOf("") }
    var editUsername by remember { mutableStateOf("") }
    var editBio by remember { mutableStateOf("") }
    var editPhone by remember { mutableStateOf("") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Профиль", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = MaterialTheme.colorScheme.onSurface)
                    }
                },
                actions = {
                    IconButton(onClick = {
                        editName = account?.name.orEmpty()
                        editUsername = account?.username.orEmpty()
                        editBio = account?.bio.orEmpty()
                        editPhone = account?.phone.orEmpty()
                        showEditDialog = true
                    }) {
                        Icon(Icons.Default.Edit, contentDescription = "Редактировать профиль", tint = MaterialTheme.colorScheme.onSurface)
                    }
                    IconButton(onClick = { viewModel.logout() }) {
                        Icon(Icons.Default.Logout, contentDescription = "Logout", tint = MaterialTheme.colorScheme.onSurface)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .verticalScroll(rememberScrollState())
        ) {
            // Profile banner: local persistent customization; server sync requires media upload support.
            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Text("Баннер профиля", style = MaterialTheme.typography.titleMedium)
                if (bannerUri != null) {
                    if (bannerIsVideo) {
                        AndroidView(
                            factory = { ctx -> VideoView(ctx).apply {
                                setVideoURI(Uri.parse(bannerUri))
                                setOnPreparedListener { player -> player.isLooping = true; start() }
                            } },
                            update = { view ->
                                if (view.tag != bannerUri) {
                                    view.tag = bannerUri
                                    view.setVideoURI(Uri.parse(bannerUri))
                                    view.setOnPreparedListener { player -> player.isLooping = true; view.start() }
                                }
                            },
                            modifier = Modifier.fillMaxWidth().height(180.dp).clip(MaterialTheme.shapes.large)
                        )
                    } else {
                        val bitmap = remember(bannerUri) {
                            runCatching {
                                context.contentResolver.openInputStream(Uri.parse(bannerUri))?.use {
                                    BitmapFactory.decodeStream(it)?.asImageBitmap()
                                }
                            }.getOrNull()
                        }
                        if (bitmap != null) {
                            Image(bitmap = bitmap, contentDescription = "Баннер профиля",
                                modifier = Modifier.fillMaxWidth().height(180.dp).clip(MaterialTheme.shapes.large))
                        } else {
                            Text("Не удалось загрузить баннер. Выберите файл заново.", color = MaterialTheme.colorScheme.error)
                        }
                    }
                } else {
                    Box(
                        modifier = Modifier.fillMaxWidth().height(110.dp).clip(MaterialTheme.shapes.large)
                            .background(MaterialTheme.colorScheme.surfaceVariant),
                        contentAlignment = Alignment.Center
                    ) { Text("Фото или короткое видео для баннера") }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = {
                        bannerPicker.launch(PickVisualMediaRequest(PickVisualMedia.ImageAndVideo))
                    }) {
                        Icon(Icons.Default.Collections, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Выбрать фото или видео")
                    }
                    if (bannerUri != null) {
                        TextButton(onClick = {
                            bannerUri = null
                            bannerIsVideo = false
                            context.getSharedPreferences("tege_profile_customization", android.content.Context.MODE_PRIVATE)
                                .edit().remove("profile_banner_uri").remove("profile_banner_video").apply()
                        }) { Text("Удалить") }
                    }
                }
                Text(
                    "Пока баннер сохранён на этом устройстве; публикация для других пользователей потребует серверной загрузки.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            // Profile Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(vertical = 20.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    TegeAvatar(
                        avatarUri = account?.avatarUri,
                        displayName = account?.name ?: "TEGE",
                        color = TelegramBlue,
                        modifier = Modifier.size(80.dp)
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    Text(
                        text = account?.name ?: "Пользователь",
                        color = MaterialTheme.colorScheme.onSurface,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold
                    )
                    account?.username?.takeIf { it.isNotBlank() }?.let { username ->
                        Text(
                            text = if (username.startsWith("@")) username else "@$username",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 14.sp
                        )
                    }
                }
            }

            // Info rows
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Учётная запись",
                    color = TelegramBlue,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp
                )
                Spacer(modifier = Modifier.height(12.dp))

                ProfileInfoRow(
                    icon = Icons.Default.Phone,
                    title = account?.phone?.takeIf { it.isNotBlank() } ?: "Не указан",
                    subtitle = "Номер телефона"
                )

                ProfileInfoRow(
                    icon = Icons.Default.AlternateEmail,
                    title = account?.username?.takeIf { it.isNotBlank() }?.let { "@$it" } ?: "Не указан",
                    subtitle = "Имя пользователя"
                )

                ProfileInfoRow(
                    icon = Icons.Default.Info,
                    title = account?.bio?.takeIf { it.isNotBlank() } ?: "Не указано",
                    subtitle = "О себе"
                )

                ProfileInfoRow(
                    icon = Icons.Default.CalendarToday,
                    title = account?.registrationDate?.takeIf { it.isNotBlank() } ?: "Не указана",
                    subtitle = "Профиль создан"
                )
            }
        }
    }

    if (showEditDialog) {
        AlertDialog(
            onDismissRequest = { showEditDialog = false },
            title = { Text("Редактировать профиль") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(value = editName, onValueChange = { editName = it }, label = { Text("Имя") }, singleLine = true)
                    OutlinedTextField(value = editUsername, onValueChange = { editUsername = it }, label = { Text("Имя пользователя") }, singleLine = true)
                    OutlinedTextField(value = editPhone, onValueChange = { editPhone = it }, label = { Text("Телефон") }, singleLine = true)
                    OutlinedTextField(value = editBio, onValueChange = { editBio = it }, label = { Text("О себе") }, minLines = 2)
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.updateProfile(editName, editUsername, editBio, editPhone)
                    showEditDialog = false
                }) { Text("Сохранить") }
            },
            dismissButton = {
                TextButton(onClick = { showEditDialog = false }) { Text("Отмена") }
            }
        )
    }
}

@Composable
fun ProfileInfoRow(
    icon: ImageVector,
    title: String,
    subtitle: String
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = TelegramBlue,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(16.dp))
        Column {
            Text(text = title, fontSize = 16.sp, fontWeight = FontWeight.Normal)
            Text(text = subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
