package org.tege.messenger.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.tege.messenger.model.ScreenRoute
import org.tege.messenger.model.TextSize
import org.tege.messenger.model.WallpaperId
import org.tege.messenger.ui.theme.TelegramBlue
import org.tege.messenger.viewmodel.TegeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: TegeViewModel,
    onBack: () -> Unit
) {
    val settings by viewModel.settings.collectAsState()
    val connectionState by viewModel.connectionState.collectAsState()
    val context = LocalContext.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Настройки", fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = MaterialTheme.colorScheme.onSurface)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surface)
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            item {
                Text(
                    text = "Настройки чатов",
                    color = TelegramBlue,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(16.dp, 16.dp, 16.dp, 8.dp)
                )

                // Dark mode toggle
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { viewModel.toggleDarkMode() }
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.Brightness4, contentDescription = null, tint = TelegramBlue)
                        Spacer(modifier = Modifier.width(16.dp))
                        Text("Ночной режим", fontSize = 16.sp)
                    }
                    Switch(
                        checked = settings.isDarkMode,
                        onCheckedChange = { viewModel.toggleDarkMode() }
                    )
                }

                HorizontalDivider()

                // Wallpaper selection
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Фон для чатов", fontSize = 15.sp, fontWeight = FontWeight.Medium)
                    Spacer(modifier = Modifier.height(10.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        listOf(
                            Pair(WallpaperId.PATTERN, "#EFEAE2"),
                            Pair(WallpaperId.DARK, "#0B0F19"),
                            Pair(WallpaperId.EMERALD, "#0D2818"),
                            Pair(WallpaperId.SUNSET, "#FCE7F3"),
                            Pair(WallpaperId.OCEAN, "#E0F2FE")
                        ).forEach { (id, colorHex) ->
                            val color = Color(android.graphics.Color.parseColor(colorHex))
                            Box(
                                modifier = Modifier
                                    .size(44.dp)
                                    .clip(CircleShape)
                                    .background(color)
                                    .clickable { viewModel.setWallpaper(id) },
                                contentAlignment = Alignment.Center
                            ) {
                                if (settings.wallpaper == id) {
                                    Icon(Icons.Default.Check, contentDescription = null, tint = TelegramBlue)
                                }
                            }
                        }
                    }
                }

                HorizontalDivider()

                // Text Size
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("Размер текста в сообщениях", fontSize = 15.sp, fontWeight = FontWeight.Medium)
                    Spacer(modifier = Modifier.height(8.dp))
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        TextSize.values().forEach { size ->
                            FilterChip(
                                selected = settings.textSize == size,
                                onClick = { viewModel.setTextSize(size) },
                                label = { Text(size.name.lowercase().capitalize()) }
                            )
                        }
                    }
                }

                HorizontalDivider()

                Text(
                    text = "Уведомления и приватность",
                    color = TelegramBlue,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(16.dp, 16.dp, 16.dp, 8.dp)
                )

                SettingsToggleRow(
                    icon = Icons.Default.Notifications,
                    title = "Уведомления",
                    subtitle = "Push-уведомления не подключены",
                    checked = settings.notificationsEnabled,
                    onCheckedChange = viewModel::setNotificationsEnabled
                )

                SettingsToggleRow(
                    icon = Icons.Default.VolumeUp,
                    title = "Звуки интерфейса",
                    subtitle = "Звуки действий в приложении",
                    checked = settings.soundEnabled,
                    onCheckedChange = viewModel::setSoundEnabled
                )

                SettingsToggleRow(
                    icon = Icons.Default.Animation,
                    title = "Анимации",
                    subtitle = "Анимации переходов и элементов",
                    checked = settings.animationsEnabled,
                    onCheckedChange = viewModel::setAnimationsEnabled
                )

                SettingsChoiceRow(
                    icon = Icons.Default.Visibility,
                    title = "Кто видит время последнего посещения",
                    value = settings.lastSeenPrivacy,
                    options = listOf("everyone" to "Все", "contacts" to "Контакты", "nobody" to "Никто"),
                    onSelected = viewModel::setLastSeenPrivacy
                )

                SettingsChoiceRow(
                    icon = Icons.Default.AccountCircle,
                    title = "Кто видит фото профиля",
                    value = settings.photoPrivacy,
                    options = listOf("everyone" to "Все", "contacts" to "Контакты", "nobody" to "Никто"),
                    onSelected = viewModel::setPhotoPrivacy
                )

                Text(
                    text = "Настройки приватности пока не применяются на сервере.",
                    fontSize = 12.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )

                HorizontalDivider()

                HorizontalDivider()

                Text(
                    text = "Подключение и данные",
                    color = TelegramBlue,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(16.dp, 16.dp, 16.dp, 8.dp)
                )

                SettingsClickableRow(
                    icon = Icons.Default.Security,
                    title = "Безопасность",
                    subtitle = "Защита сессии и выход из аккаунта",
                    onClick = { viewModel.navigateTo(ScreenRoute.Security) }
                )

                SettingsClickableRow(
                    icon = Icons.Default.Wifi,
                    title = "Соединение с сервером",
                    subtitle = connectionState,
                    onClick = { viewModel.reconnect() }
                )

                Text(
                    text = "Нажмите, чтобы переподключиться. Push-уведомления и синхронизация медиа не подключены.",
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                )

                HorizontalDivider()

                Text(
                    text = "О приложении",
                    color = TelegramBlue,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(16.dp, 16.dp, 16.dp, 8.dp)
                )

                Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)) {
                    Text(
                        text = "TEGE Messenger for Android",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Medium,
                        color = MaterialTheme.colorScheme.onSurface
                    )
                    Text(
                        text = "Версия 1.0.0",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "Аккаунт и сообщения хранятся на этом устройстве.",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }

}

@Composable
private fun SettingsToggleRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = TelegramBlue, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 16.sp)
            Text(subtitle, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun SettingsChoiceRow(
    icon: ImageVector,
    title: String,
    value: String,
    options: List<Pair<String, String>>,
    onSelected: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = options.firstOrNull { it.first == value }?.second ?: options.first().second
    Row(
        modifier = Modifier.fillMaxWidth().clickable { expanded = true }
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = TelegramBlue, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 15.sp)
            Text(selectedLabel, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Box {
            Icon(Icons.Default.ExpandMore, contentDescription = "Выбрать")
            DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                options.forEach { (optionValue, label) ->
                    DropdownMenuItem(
                        text = { Text(label) },
                        onClick = {
                            onSelected(optionValue)
                            expanded = false
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun SettingsClickableRow(
    icon: ImageVector,
    title: String,
    subtitle: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = TelegramBlue, modifier = Modifier.size(24.dp))
        Spacer(modifier = Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, fontSize = 16.sp)
            Text(subtitle, fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Icon(Icons.Default.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
