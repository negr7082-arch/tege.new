package org.tege.messenger.ui.screens

import androidx.compose.foundation.background
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
import org.tege.messenger.ui.components.VerifiedAccountBadge
import org.tege.messenger.ui.components.isTegeVerifiedAccount
import org.tege.messenger.ui.theme.TelegramBlue
import org.tege.messenger.viewmodel.TegeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    viewModel: TegeViewModel,
    onBack: () -> Unit
) {
    val account by viewModel.currentAccount.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Профиль", fontWeight = FontWeight.Bold, color = Color.White) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { viewModel.logout() }) {
                        Icon(Icons.Default.Logout, contentDescription = "Logout", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = TelegramBlue)
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Profile Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(TelegramBlue)
                    .padding(bottom = 24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(90.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.25f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = account?.name?.take(1)?.uppercase() ?: "T",
                            color = Color.White,
                            fontSize = 36.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    Spacer(modifier = Modifier.height(12.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = account?.name ?: "Пользователь",
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                        if (isTegeVerifiedAccount(account?.email)) {
                            Spacer(modifier = Modifier.width(6.dp))
                            VerifiedAccountBadge(compact = false)
                        }
                    }
                    Text(
                        text = if (account?.isOnline == true) "в сети" else "был(а) недавно",
                        color = Color.White.copy(alpha = 0.8f),
                        fontSize = 13.sp
                    )
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
                    title = account?.phone?.ifEmpty { "+7 (999) 000-11-22" } ?: "+7 (999) 000-11-22",
                    subtitle = "Нажмите, чтобы изменить номер"
                )

                ProfileInfoRow(
                    icon = Icons.Default.AlternateEmail,
                    title = "@${account?.username ?: "user"}",
                    subtitle = "Имя пользователя"
                )

                ProfileInfoRow(
                    icon = Icons.Default.Info,
                    title = account?.bio?.ifEmpty { "О себе не указано" } ?: "О себе не указано",
                    subtitle = "О себе"
                )

                ProfileInfoRow(
                    icon = Icons.Default.CalendarToday,
                    title = account?.registrationDate?.ifEmpty { "14.08.2013" } ?: "14.08.2013",
                    subtitle = "Дата регистрации"
                )
            }
        }
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
