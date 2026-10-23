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
    val messageError by viewModel.messageError.collectAsState()
    val cloudEnabled by viewModel.cloudPasswordEnabled.collectAsState()
    val recoveryCodes by viewModel.cloudRecoveryCodes.collectAsState()
    val cloudBusy by viewModel.cloudPasswordBusy.collectAsState()
    var cloudPassword by remember { mutableStateOf("") }
    var currentCloudPassword by remember { mutableStateOf("") }
    var targetEmail by remember { mutableStateOf("") }
    var selectedRole by remember { mutableStateOf("volunteer") }
    var age16Plus by remember { mutableStateOf(false) }
    var identityReady by remember { mutableStateOf(false) }
    var conductOk by remember { mutableStateOf(false) }
    var accountAgeAcknowledged by remember { mutableStateOf(false) }
    val role = account?.volunteerRole
    val isVolunteer = role?.let { it in setOf("junior_volunteer", "volunteer", "chief_volunteer") } == true

    Scaffold(topBar = {
        TopAppBar(
            title = { Text(if (isVolunteer) "Security" else "Заявка волонтёра", fontWeight = FontWeight.SemiBold) },
            navigationIcon = {
                IconButton(onClick = onBack) { Icon(Icons.Default.ArrowBack, contentDescription = "Назад") }
            }
        )
    }) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                LaunchedEffect(account?.id) { if (account != null) viewModel.refreshCloudPasswordStatus() }
                Card {
                    Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("Облачный пароль Tege", style = MaterialTheme.typography.titleMedium)
                        Text(if (cloudEnabled) "Включён — проверяется сервером" else "Дополнительная защита входа")
                        if (recoveryCodes.isEmpty()) {
                            OutlinedTextField(value = cloudPassword, onValueChange = { cloudPassword = it },
                                label = { Text("Пароль (минимум 12 символов)") },
                                visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                                singleLine = true, modifier = Modifier.fillMaxWidth())
                            if (cloudEnabled) {
                                OutlinedTextField(value = currentCloudPassword, onValueChange = { currentCloudPassword = it },
                                    label = { Text("Текущий облачный пароль") },
                                    visualTransformation = androidx.compose.ui.text.input.PasswordVisualTransformation(),
                                    singleLine = true, modifier = Modifier.fillMaxWidth())
                                OutlinedButton(onClick = { viewModel.disableCloudPassword(currentCloudPassword) },
                                    enabled = currentCloudPassword.isNotBlank() && !cloudBusy, modifier = Modifier.fillMaxWidth()) {
                                    Text("Отключить")
                                }
                            }
                            Button(onClick = { viewModel.enableCloudPassword(cloudPassword, currentCloudPassword) },
                                enabled = cloudPassword.length >= 12 && !cloudBusy, modifier = Modifier.fillMaxWidth()) {
                                Text(if (cloudEnabled) "Заменить пароль и коды" else "Включить облачный пароль")
                            }
                        } else {
                            Text("Сохрани эти коды сейчас. Каждый используется только один раз.", color = MaterialTheme.colorScheme.error)
                            recoveryCodes.forEach { Text(it, style = MaterialTheme.typography.titleMedium) }
                            Button(onClick = { viewModel.clearCloudRecoveryCodesAfterSave(); cloudPassword = ""; currentCloudPassword = "" },
                                modifier = Modifier.fillMaxWidth()) { Text("Я сохранил коды") }
                        }
                        if (cloudBusy) LinearProgressIndicator(Modifier.fillMaxWidth())
                    }
                }
            }
            if (!isVolunteer) {
                item {
                    Text("Стать волонтёром", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
                    Text("Заявка отправляется на сервер. Роль нельзя назначить изменением данных приложения.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                item {
                    Card {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                            Text("Требования к заявке", style = MaterialTheme.typography.titleMedium)
                            Text("Аккаунту должно быть не меньше года. Сервер проверяет дату регистрации; отметки ниже — заявления для последующей ручной проверки.")
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(age16Plus, { age16Plus = it })
                                Text("Мне 16 лет или больше")
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(identityReady, { identityReady = it })
                                Text("Готов(а) подтвердить возраст при проверке")
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(conductOk, { conductOk = it })
                                Text("У меня нет известных активных наказаний")
                            }
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Checkbox(accountAgeAcknowledged, { accountAgeAcknowledged = it })
                                Text("Подтверждаю, что аккаунт использую сам(а)")
                            }
                            Button(
                                onClick = {
                                    if (!viewModel.applyForVolunteer(age16Plus, identityReady, conductOk, accountAgeAcknowledged)) {
                                        viewModel.setMessage("Не удалось отправить заявку. Проверь подключение к серверу.")
                                    }
                                },
                                enabled = age16Plus && identityReady && conductOk && accountAgeAcknowledged,
                                modifier = Modifier.fillMaxWidth()
                            ) { Text("Отправить заявку на сервер") }
                            Text("Не отправляй паспорт или его фото в чат. Если проверка личности понадобится, её должен проводить уполномоченный сотрудник безопасным способом.", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                    }
                }
                messageError?.let { item { Text(it, color = MaterialTheme.colorScheme.primary) } }
            } else {
                item {
                    Card {
                        Row(Modifier.fillMaxWidth().padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                            Icon(Icons.Default.Shield, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                            Spacer(Modifier.width(12.dp))
                            Column {
                                Text("Центр безопасности", style = MaterialTheme.typography.titleMedium)
                                Text("Роль: " + when (role) {
                                    "chief_volunteer" -> "Главный волонтёр"
                                    "volunteer" -> "Волонтёр"
                                    else -> "Младший волонтёр"
                                }, style = MaterialTheme.typography.bodySmall)
                            }
                        }
                    }
                }
                item {
                    var reportCategory by remember { mutableStateOf("spam") }
                    var reportUserId by remember { mutableStateOf("") }
                    var reportDetails by remember { mutableStateOf("") }
                    Card {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text("Подать жалобу", style = MaterialTheme.typography.titleMedium)
                            OutlinedTextField(value = reportUserId, onValueChange = { reportUserId = it }, label = { Text("ID пользователя") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                            Text("Категория")
                            listOf("spam" to "Спам", "harassment" to "Оскорбления и травля", "scam" to "Мошенничество", "impersonation" to "Выдаёт себя за другого", "other" to "Другое").forEach { (value, label) ->
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    RadioButton(selected = reportCategory == value, onClick = { reportCategory = value })
                                    Text(label)
                                }
                            }
                            OutlinedTextField(value = reportDetails, onValueChange = { reportDetails = it }, label = { Text("Описание (без паролей и личных данных)") }, modifier = Modifier.fillMaxWidth(), minLines = 2)
                            Button(onClick = { viewModel.submitSecurityReport(reportUserId, reportCategory, reportDetails) }, enabled = reportUserId.toLongOrNull() != null && reportDetails.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("Отправить жалобу") }
                        }
                    }
                }
                item { SecurityRow(Icons.Default.Flag, "Жалобы", "Форма подачи доступна; очередь назначенных жалоб требует подключения API") }
                item { SecurityRow(Icons.Default.Search, "Пользователи", "Поиск и сведения доступны согласно серверным правам") }
                item { SecurityRow(Icons.Default.Gavel, "История модерации", "История решений будет загружаться из серверного API") }
                item { SecurityRow(Icons.Default.Warning, "Подозрительные входы", "Предупреждения доступны после подключения защищённого журнала") }
                if (role == "chief_volunteer" && account?.email?.equals("negr7082@gmail.com", ignoreCase = true) == true) {
                    item {
                        Card {
                            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Text("Управление волонтёрами", style = MaterialTheme.typography.titleMedium)
                                Text("Назначение роли выполняется сервером. Обычный клиент не может сам выдать себе роль.", style = MaterialTheme.typography.bodySmall)
                                OutlinedTextField(
                                    value = targetEmail, onValueChange = { targetEmail = it },
                                    label = { Text("Email пользователя") }, singleLine = true, modifier = Modifier.fillMaxWidth()
                                )
                                listOf(
                                    "junior_volunteer" to "Младший волонтёр",
                                    "volunteer" to "Волонтёр",
                                    "chief_volunteer" to "Главный волонтёр",
                                    "" to "Снять роль"
                                ).forEach { (value, label) ->
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        RadioButton(selected = selectedRole == value, onClick = { selectedRole = value })
                                        Text(label)
                                    }
                                }
                                Button(
                                    onClick = {
                                        if (!viewModel.updateVolunteerRole(targetEmail, selectedRole.ifBlank { null })) {
                                            viewModel.setMessage("Не удалось отправить запрос на сервер.")
                                        }
                                    },
                                    enabled = targetEmail.contains("@"), modifier = Modifier.fillMaxWidth()
                                ) { Text("Применить роль") }
                            }
                        }
                    }
                }
                item {
                    Card {
                        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Закрытые данные", style = MaterialTheme.typography.titleMedium)
                            Text("IP-адреса и полный журнал входов не показываются всем волонтёрам. Доступ выдаётся отдельно сервером создателем.", style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
                messageError?.let { item { Text(it, color = MaterialTheme.colorScheme.primary) } }
            }
            item {
                OutlinedButton(onClick = { showLogoutDialog = true }, modifier = Modifier.fillMaxWidth(), enabled = account != null) {
                    Icon(Icons.Default.Logout, contentDescription = null)
                    Spacer(Modifier.width(8.dp))
                    Text("Выйти из аккаунта на этом устройстве")
                }
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
            dismissButton = { TextButton(onClick = { showLogoutDialog = false }) { Text("Отмена") } }
        )
    }
}

@Composable
private fun SecurityRow(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String, subtitle: String) {
    Card {
        ListItem(
            headlineContent = { Text(title) },
            supportingContent = { Text(subtitle) },
            leadingContent = { Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
            trailingContent = { Icon(Icons.Default.ChevronRight, contentDescription = null) }
        )
    }
}
