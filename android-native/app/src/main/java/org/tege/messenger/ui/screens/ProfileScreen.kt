package org.tege.messenger.ui.screens

import androidx.compose.foundation.background
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
            // Profile Header
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(MaterialTheme.colorScheme.surface)
                    .padding(vertical = 20.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(
                        modifier = Modifier
                            .size(80.dp)
                            .clip(CircleShape)
                            .background(TelegramBlue),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = account?.name?.take(1)?.uppercase() ?: "T",
                            color = Color.White,
                            fontSize = 32.sp,
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
                            color = MaterialTheme.colorScheme.onSurface,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )
                        if (isTegeVerifiedAccount(account?.email)) {
                            Spacer(modifier = Modifier.width(6.dp))
                            VerifiedAccountBadge(compact = false)
                        }
                    }
                    Text(
                        text = "Локальный профиль",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
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
                    title = account?.phone?.takeIf { it.isNotBlank() } ?: "Не указан",
                    subtitle = "Нажмите, чтобы изменить номер"
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
                    subtitle = "Дата регистрации"
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
