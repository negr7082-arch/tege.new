package org.tege.messenger.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import org.tege.messenger.model.ScreenRoute
import org.tege.messenger.model.UserAccount
import org.tege.messenger.ui.theme.TelegramBlue
import org.tege.messenger.viewmodel.TegeViewModel

@Composable
fun TelegramDrawer(
    viewModel: TegeViewModel,
    accounts: List<UserAccount>,
    currentAccount: UserAccount?,
    onCloseDrawer: () -> Unit,
    onOpenAddAccount: () -> Unit
) {
    var accountsExpanded by remember { mutableStateOf(false) }

    ModalDrawerSheet(
        modifier = Modifier.width(300.dp)
    ) {
        // Drawer Header with Account Info
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(TelegramBlue)
                .padding(16.dp)
        ) {
            Column {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(60.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.25f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = currentAccount?.name?.take(1)?.uppercase() ?: "T",
                            color = Color.White,
                            fontSize = 26.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }

                    IconButton(onClick = { viewModel.toggleDarkMode() }) {
                        Icon(
                            imageVector = Icons.Default.Brightness4,
                            contentDescription = "Night Mode",
                            tint = Color.White
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { accountsExpanded = !accountsExpanded },
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Column {
                        Text(
                            text = currentAccount?.name ?: "TEGE User",
                            color = Color.White,
                            fontWeight = FontWeight.Bold,
                            fontSize = 17.sp
                        )
                        Text(
                            text = currentAccount?.phone ?: "@${currentAccount?.username ?: "user"}",
                            color = Color.White.copy(alpha = 0.85f),
                            fontSize = 13.sp
                        )
                    }
                    Icon(
                        imageVector = if (accountsExpanded) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                        contentDescription = "Switch accounts",
                        tint = Color.White
                    )
                }
            }
        }

        // Multi-Account Switcher Section (if expanded)
        if (accountsExpanded) {
            Column(modifier = Modifier.background(MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.5f))) {
                accounts.forEach { acc ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                viewModel.switchAccount(acc.id)
                                accountsExpanded = false
                            }
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(CircleShape)
                                .background(TelegramBlue.copy(alpha = 0.8f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = acc.name.take(1).uppercase(),
                                color = Color.White,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(text = acc.name, fontWeight = FontWeight.Medium, fontSize = 14.sp)
                            Text(text = "@${acc.username}", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        if (acc.id == currentAccount?.id) {
                            Icon(Icons.Default.Check, contentDescription = "Active", tint = TelegramBlue, modifier = Modifier.size(20.dp))
                        }
                    }
                }

                if (accounts.size < 5) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable {
                                onOpenAddAccount()
                                accountsExpanded = false
                            }
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Add, contentDescription = "Add account", tint = TelegramBlue, modifier = Modifier.size(36.dp))
                        Spacer(modifier = Modifier.width(12.dp))
                        Text(text = "Добавить аккаунт", color = TelegramBlue, fontWeight = FontWeight.Medium)
                    }
                }
            }
            HorizontalDivider()
        }

        // Drawer Menu Items
        DrawerItem(icon = Icons.Default.Person, label = "Мой профиль") {
            viewModel.navigateTo(ScreenRoute.Profile)
            onCloseDrawer()
        }
        DrawerItem(icon = Icons.Default.Bookmark, label = "Избранное (Saved Messages)") {
            val savedChat = viewModel.chats.value.find { it.isSavedMessages }
            if (savedChat != null) {
                viewModel.navigateTo(ScreenRoute.ChatDetail(savedChat.id))
            }
            onCloseDrawer()
        }
        DrawerItem(icon = Icons.Default.Campaign, label = "Каналы") {
            viewModel.navigateTo(ScreenRoute.Channels)
            onCloseDrawer()
        }
        DrawerItem(icon = Icons.Default.GroupAdd, label = "Создать чат / группу") {
            viewModel.navigateTo(ScreenRoute.CreateChat)
            onCloseDrawer()
        }
        HorizontalDivider(modifier = Modifier.padding(vertical = 4.dp))
        DrawerItem(icon = Icons.Default.Settings, label = "Настройки") {
            viewModel.navigateTo(ScreenRoute.Settings)
            onCloseDrawer()
        }
    }
}

@Composable
private fun DrawerItem(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = label,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(16.dp))
        Text(
            text = label,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Normal
        )
    }
}
