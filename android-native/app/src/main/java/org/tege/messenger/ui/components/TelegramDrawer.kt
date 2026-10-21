package org.tege.messenger.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
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
    currentAccount: UserAccount?,
    onCloseDrawer: () -> Unit
) {
    ModalDrawerSheet(modifier = Modifier.width(300.dp)) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(TelegramBlue)
                .padding(18.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                TegeAvatar(
                    avatarUri = currentAccount?.avatarUri,
                    displayName = currentAccount?.name ?: "TEGE",
                    color = Color.White.copy(alpha = 0.22f),
                    modifier = Modifier.size(58.dp)
                )
                IconButton(onClick = { viewModel.toggleDarkMode() }) {
                    Icon(Icons.Default.Brightness4, contentDescription = "Ночной режим", tint = Color.White)
                }
            }
            Spacer(modifier = Modifier.height(14.dp))
            Text(
                text = currentAccount?.name ?: "TEGE",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
            Text(
                text = currentAccount?.username?.takeIf { it.isNotBlank() }?.let {
                    if (it.startsWith("@")) it else "@$it"
                } ?: currentAccount?.email.orEmpty(),
                color = Color.White.copy(alpha = 0.82f),
                fontSize = 13.sp
            )
        }

        DrawerItem(icon = Icons.Default.Person, label = "Мой профиль") {
            viewModel.navigateTo(ScreenRoute.Profile)
            onCloseDrawer()
        }
        DrawerItem(icon = Icons.Default.Bookmark, label = "Избранное") {
            val savedChat = viewModel.chats.value.find { it.isSavedMessages }
            if (savedChat != null) viewModel.navigateTo(ScreenRoute.ChatDetail(savedChat.id))
            onCloseDrawer()
        }
        DrawerItem(icon = Icons.Default.Campaign, label = "Каналы") {
            viewModel.navigateTo(ScreenRoute.Channels)
            onCloseDrawer()
        }
        DrawerItem(icon = Icons.Default.Contacts, label = "Контакты") {
            viewModel.navigateTo(ScreenRoute.Contacts)
            onCloseDrawer()
        }
        DrawerItem(icon = Icons.Default.PersonAdd, label = "Новое сообщение") {
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
        Text(label, style = MaterialTheme.typography.bodyLarge)
    }
}
