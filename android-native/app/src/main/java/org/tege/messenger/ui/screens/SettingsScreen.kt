package org.tege.messenger.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import org.tege.messenger.model.TextSize
import org.tege.messenger.model.WallpaperId
import org.tege.messenger.ui.components.BlacklistDialog
import org.tege.messenger.ui.theme.TelegramBlue
import org.tege.messenger.viewmodel.TegeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(
    viewModel: TegeViewModel,
    onBack: () -> Unit
) {
    val settings by viewModel.settings.collectAsState()
    var showBlacklistDialog by remember { mutableStateOf(false) }

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
                    text = "Конфиденциальность",
                    color = TelegramBlue,
                    fontWeight = FontWeight.Bold,
                    fontSize = 14.sp,
                    modifier = Modifier.padding(16.dp, 16.dp, 16.dp, 8.dp)
                )

                SettingsClickableRow(
                    icon = Icons.Default.Block,
                    title = "Чёрный список",
                    subtitle = "${settings.blockedUsers.size} пользователей",
                    onClick = { showBlacklistDialog = true }
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
                        text = "Профиль, настройки и история чатов хранятся локально. Серверная авторизация и доставка сообщений другим пользователям пока не подключены.",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }
    }

    if (showBlacklistDialog) {
        BlacklistDialog(
            blockedUsers = settings.blockedUsers,
            onUnblock = { viewModel.unblockUser(it) },
            onDismiss = { showBlacklistDialog = false }
        )
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
