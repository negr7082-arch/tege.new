package org.tege.messenger.ui.screens

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
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
    var showEditDialog by remember { mutableStateOf(false) }
    var editName by remember { mutableStateOf("") }
    var editUsername by remember { mutableStateOf("") }
    var editBio by remember { mutableStateOf("") }
    var editPhone by remember { mutableStateOf("") }
    var pickingBanner by remember { mutableStateOf(false) }
    var mediaPickerError by remember { mutableStateOf<String?>(null) }
    var showStyleDialog by remember { mutableStateOf(false) }
    var draftColor by remember(account?.themeColor) { mutableStateOf(account?.themeColor ?: "#2AABEE") }
    var draftFont by remember(account?.fontFamily) { mutableStateOf(account?.fontFamily ?: "system") }

    val imagePicker = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.OpenDocument()
    ) { uri ->
        if (uri != null) {
            runCatching {
                context.contentResolver.takePersistableUriPermission(
                    uri,
                    android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
            if (pickingBanner) {
                viewModel.updateProfileMedia(bannerUri = uri.toString())
            } else {
                viewModel.updateProfileMedia(avatarUri = uri.toString())
            }
            mediaPickerError = null
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Профиль", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад", tint = MaterialTheme.colorScheme.onSurface)
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
                        Icon(Icons.Default.Logout, contentDescription = "Выйти", tint = MaterialTheme.colorScheme.onSurface)
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
            // TikTok-inspired profile cover: wide image with the avatar overlapping its lower edge.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp)
                    .padding(top = 8.dp)
                    .height(184.dp)
                    .clip(RoundedCornerShape(22.dp))
                    .background(
                        Brush.linearGradient(
                            listOf(runCatching { Color(android.graphics.Color.parseColor(account?.themeColor ?: "#2AABEE")) }.getOrDefault(Color(0xFF192A56)), runCatching { Color(android.graphics.Color.parseColor(account?.themeColor ?: "#2AABEE")) }.getOrDefault(Color(0xFF6C5CE7)).copy(alpha = 0.78f), Color(0xFF00B8A9))
                        )
                    )
            ) {
                account?.bannerUri?.let { banner ->
                    AsyncImage(
                        model = viewModel.resolveMediaUrl(banner),
                        contentDescription = "Баннер профиля",
                        contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxSize()
                    )
                    Box(
                        modifier = Modifier.fillMaxSize().background(
                            Brush.verticalGradient(
                                listOf(Color.Transparent, Color(0x66000000))
                            )
                        )
                    )
                }
                Text(
                    text = "TEGE",
                    color = Color.White.copy(alpha = 0.16f),
                    fontSize = 34.sp,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.align(Alignment.Center)
                )
                FilledTonalButton(
                    onClick = {
                        pickingBanner = true
                        imagePicker.launch(arrayOf("image/*"))
                    },
                    modifier = Modifier.align(Alignment.BottomEnd).padding(10.dp),
                    colors = ButtonDefaults.filledTonalButtonColors(
                        containerColor = Color.Black.copy(alpha = 0.55f),
                        contentColor = Color.White
                    )
                ) {
                    Icon(Icons.Default.Image, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(6.dp))
                    Text(if (account?.bannerUri == null) "Добавить баннер" else "Изменить баннер")
                }
            }

            Column(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Box(
                    modifier = Modifier.offset(y = (-34).dp),
                    contentAlignment = Alignment.BottomEnd
                ) {
                    Box(
                        modifier = Modifier
                            .size(104.dp)
                            .clip(CircleShape)
                            .background(MaterialTheme.colorScheme.surface)
                            .padding(4.dp)
                    ) {
                        if (!account?.avatarUri.isNullOrBlank()) {
                            AsyncImage(
                                model = viewModel.resolveMediaUrl(account?.avatarUri),
                                contentDescription = "Фото профиля",
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxSize().clip(CircleShape)
                            )
                        } else {
                            TegeAvatar(
                                avatarUri = null,
                                displayName = account?.name ?: "TEGE",
                                color = TelegramBlue,
                                modifier = Modifier.fillMaxSize()
                            )
                        }
                    }
                    FilledIconButton(
                        onClick = {
                            pickingBanner = false
                            imagePicker.launch(arrayOf("image/*"))
                        },
                        modifier = Modifier.size(34.dp),
                        shape = CircleShape
                    ) {
                        Icon(Icons.Default.CameraAlt, contentDescription = "Изменить фото профиля", modifier = Modifier.size(18.dp))
                    }
                }
                Text(
                    text = account?.name ?: "Пользователь",
                    color = runCatching { Color(android.graphics.Color.parseColor(account?.themeColor ?: "#2AABEE")) }.getOrDefault(MaterialTheme.colorScheme.onSurface),
                    fontFamily = when (account?.fontFamily) { "serif" -> FontFamily.Serif; "monospace" -> FontFamily.Monospace; "sans-serif-rounded" -> FontFamily.SansSerif; "cursive" -> FontFamily.Cursive; else -> FontFamily.Default },
                    fontSize = 22.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.offset(y = (-24).dp)
                )
                account?.username?.takeIf { it.isNotBlank() }?.let { username ->
                    Text(
                        text = if (username.startsWith("@")) username else "@$username",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontSize = 14.sp,
                        modifier = Modifier.offset(y = (-20).dp)
                    )
                }
                TextButton(
                    onClick = {
                        draftColor = account?.themeColor ?: "#2AABEE"
                        draftFont = account?.fontFamily ?: "system"
                        showStyleDialog = true
                    },
                    modifier = Modifier.offset(y = (-14).dp)
                ) {
                    Icon(Icons.Default.Palette, contentDescription = null, modifier = Modifier.size(17.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("Оформить профиль")
                }
            }

            mediaPickerError?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(horizontal = 16.dp)) }

            Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) {
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
                Text(
                    "Фото и баннер пока сохраняются на этом устройстве.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 12.dp, bottom = 24.dp)
                )
            }
        }
    }


    if (showStyleDialog) {
        AlertDialog(
            onDismissRequest = { showStyleDialog = false },
            title = { Text("Оформление профиля") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Цвет оформления", fontWeight = FontWeight.SemiBold)
                    OutlinedTextField(
                        value = draftColor,
                        onValueChange = { value ->
                            val normalized = if (value.startsWith("#")) value else "#$value"
                            if (normalized.length <= 7 && normalized.drop(1).all { it.isDigit() || it.lowercaseChar() in 'a'..'f' }) draftColor = normalized.uppercase()
                        },
                        label = { Text("HEX — любой цвет, например #FF4F81") },
                        singleLine = true,
                        isError = !Regex("^#[0-9A-Fa-f]{6}$").matches(draftColor)
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        listOf("#2AABEE", "#FF4F81", "#8B5CF6", "#22C55E", "#F59E0B", "#111827").forEach { colorHex ->
                            Box(
                                modifier = Modifier.size(30.dp).clip(CircleShape)
                                    .background(Color(android.graphics.Color.parseColor(colorHex)))
                                    .clickable { draftColor = colorHex }
                            )
                        }
                    }
                    Text("Шрифт профиля", fontWeight = FontWeight.SemiBold)
                    listOf(
                        "system" to "Стандартный",
                        "serif" to "Классический",
                        "monospace" to "Моноширинный",
                        "sans-serif-rounded" to "Округлый",
                        "cursive" to "Рукописный"
                    ).forEach { (key, label) ->
                        Row(
                            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp))
                                .clickable { draftFont = key }.padding(vertical = 5.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            RadioButton(selected = draftFont == key, onClick = { draftFont = key })
                            Text(
                                text = label,
                                fontFamily = when (key) {
                                    "serif" -> FontFamily.Serif
                                    "monospace" -> FontFamily.Monospace
                                    "sans-serif-rounded" -> FontFamily.SansSerif
                                    "cursive" -> FontFamily.Cursive
                                    else -> FontFamily.Default
                                },
                                modifier = Modifier.padding(start = 6.dp)
                            )
                        }
                    }
                    Text(
                        "Цвет и шрифт сохраняются в профиле на сервере и доступны другим пользователям с поддержкой этих настроек.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    if (Regex("^#[0-9A-Fa-f]{6}$").matches(draftColor)) {
                        viewModel.updateProfileStyle(draftColor, draftFont)
                        showStyleDialog = false
                    }
                }) { Text("Сохранить для всех") }
            },
            dismissButton = { TextButton(onClick = { showStyleDialog = false }) { Text("Отмена") } }
        )
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
        modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
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
