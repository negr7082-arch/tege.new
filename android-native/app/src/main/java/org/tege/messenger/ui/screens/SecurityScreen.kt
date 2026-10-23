package org.tege.messenger.ui.screens

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import org.tege.messenger.viewmodel.TegeViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SecurityScreen(viewModel: TegeViewModel, onBack: () -> Unit, onLoggedOut: () -> Unit) {
    var showLogoutDialog by remember { mutableStateOf(false) }
    val account by viewModel.currentAccount.collectAsState()
    var targetEmail by remember { mutableStateOf("") }
    var selectedRole by remember { mutableStateOf("volunteer") }
    var roleMessage by remember { mutableStateOf<String?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Безопасность", fontWeight = FontWeight.SemiBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Назад")
                    }
                }
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                Card {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Shield, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(12.dp))
                        Column {
                            Text("Защита приложения", style = MaterialTheme.typography.titleMedium)
                            Text("Токен Android-сессии хранится с использованием Android Keystore.",
                                style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
            item {
                ListItem(
                    headlineContent = { Text("Аккаунт") },
                    supportingContent = { Text(account?.email ?: "Нет активного аккаунта") },
                    leadingContent = { Icon(Icons.Default.AccountCircle, contentDescription = null) }
                )
            }
            item {
                ListItem(
                    headlineContent = { Text("Активная сессия") },
                    supportingContent = { Text("На этом устройстве") },
                    leadingContent = { Icon(Icons.Default.PhoneAndroid, contentDescription = null) }
                )
            }
            if (account?.email?.equals("negr7082@gmail.com", ignoreCase = true) == true) {
                item {
                    Card {
                        Column(
                            modifier = Modifier.fillMaxWidth().padding(16.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text("Управление волонтёрами", style = MaterialTheme.typography.titleMedium)
                            Text(
                                "Назначение подтверждается сервером. Для доступа владельца на сервере должна быть задана переменная TEGE_OWNER_EMAIL.",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            OutlinedTextField(
                                value = targetEmail,
                                onValueChange = { targetEmail = it },
                                label = { Text("Email пользователя") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Text("Роль", style = MaterialTheme.typography.labelLarge)
                            listOf(
                                "junior_volunteer" to "Младший волонтёр",
                                "volunteer" to "Волонтёр",
                                "chief_volunteer" to "Главный волонтёр",
                                "" to "Снять роль"
                            ).forEach { (role, label) ->
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    RadioButton(
                                        selected = selectedRole == role,
                                        onClick = { selectedRole = role }
                                    )
                                    Text(label)
                                }
                            }
                            Button(
                                onClick = {
                                    val sent = viewModel.updateVolunteerRole(targetEmail, selectedRole.ifBlank { null })
                                    roleMessage = if (sent) "Запрос отправлен серверу; дождитесь результата." else "Не удалось отправить запрос: проверьте соединение и email."
                                },
                                enabled = targetEmail.contains("@"),
                                modifier = Modifier.fillMaxWidth()
                            ) { Text("Применить роль") }
                            roleMessage?.let { Text(it, style = MaterialTheme.typography.bodySmall) }
                        }
                    }
                }
            }
            item {
                OutlinedButton(
                    onClick = { showLogoutDialog = true },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = account != null
                ) {
                    Icon(Icons.Default.Logout, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Выйти из аккаунта на этом устройстве")
                }
            }
            item {
                Text(
                    "Важно: выход завершает локальную сессию. Управление всеми устройствами, подтверждение почты и двухфакторная проверка должны поддерживаться сервером отдельно; этот экран не заявляет, что они уже включены.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }

    if (showLogoutDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutDialog = false },
            title = { Text("Выйти из аккаунта?") },
            text = { Text("На этом устройстве потребуется войти снова.") },
            confirmButton = {
                TextButton(onClick = {
                    showLogoutDialog = false
                    viewModel.logout()
                    onLoggedOut()
                }) { Text("Выйти") }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutDialog = false }) { Text("Отмена") }
            }
        )
    }
}
