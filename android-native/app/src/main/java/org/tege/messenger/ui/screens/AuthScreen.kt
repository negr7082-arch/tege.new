package org.tege.messenger.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import org.tege.messenger.service.BackendClient
import org.tege.messenger.ui.theme.TelegramBlue
import org.tege.messenger.viewmodel.TegeViewModel

private val AuthInk = Color(0xFF17212B)
private val AuthMuted = Color(0xFF707A86)
private val AuthLine = Color(0xFF8A929B)
private val AuthBackground = Color(0xFFFFFFFF)

@Composable
fun AuthScreen(
    viewModel: TegeViewModel,
    onSuccess: () -> Unit
) {
    var isRegister by remember { mutableStateOf(false) }
    var serverUrl by remember { mutableStateOf(BackendClient.DEFAULT_BASE_URL) }
    var showServer by remember { mutableStateOf(false) }
    var displayName by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = TelegramBlue,
            onPrimary = Color.White,
            background = AuthBackground,
            surface = AuthBackground,
            onSurface = AuthInk,
            onSurfaceVariant = AuthMuted,
            outline = AuthLine
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(AuthBackground)
                .imePadding()
                .padding(horizontal = 28.dp),
            contentAlignment = Alignment.Center
        ) {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(vertical = 28.dp)
            ) {
                Spacer(Modifier.height(8.dp))
                Box(
                    modifier = Modifier
                        .size(76.dp)
                        .clip(CircleShape)
                        .background(TelegramBlue),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Send,
                        contentDescription = "TEGE",
                        tint = Color.White,
                        modifier = Modifier.size(36.dp)
                    )
                }

                Spacer(Modifier.height(34.dp))
                Text(
                    text = if (isRegister) "Создать аккаунт TEGE" else "Войти в TEGE",
                    fontSize = 27.sp,
                    lineHeight = 33.sp,
                    fontWeight = FontWeight.Bold,
                    color = AuthInk
                )
                Spacer(Modifier.height(18.dp))
                Text(
                    text = if (isRegister)
                        "Создайте аккаунт, чтобы общаться с друзьями."
                    else
                        "Общайтесь с друзьями и близкими в TEGE.",
                    fontSize = 16.sp,
                    lineHeight = 25.sp,
                    color = AuthMuted
                )
                Spacer(Modifier.height(34.dp))

                if (showServer) {
                    AuthField(
                        value = serverUrl,
                        onValueChange = { serverUrl = it; error = null },
                        label = "Адрес сервера",
                        keyboardType = KeyboardType.Uri
                    )
                    Spacer(Modifier.height(16.dp))
                }

                AuthField(
                    value = email,
                    onValueChange = { email = it; error = null },
                    label = "Электронная почта",
                    keyboardType = KeyboardType.Email
                )
                Spacer(Modifier.height(18.dp))
                AuthField(
                    value = password,
                    onValueChange = { password = it; error = null },
                    label = "Пароль",
                    keyboardType = KeyboardType.Password,
                    password = true
                )

                if (isRegister) {
                    Spacer(Modifier.height(18.dp))
                    AuthField(
                        value = displayName,
                        onValueChange = { displayName = it; error = null },
                        label = "Имя"
                    )
                    Spacer(Modifier.height(18.dp))
                    AuthField(
                        value = username,
                        onValueChange = { username = it.filterNot(Char::isWhitespace).removePrefix("@"); error = null },
                        label = "Имя пользователя (необязательно)",
                        placeholder = "tege_user"
                    )
                }

                error?.let {
                    Spacer(Modifier.height(14.dp))
                    Text(
                        text = it,
                        color = Color(0xFFD64545),
                        fontSize = 14.sp,
                        lineHeight = 20.sp
                    )
                }

                Spacer(Modifier.height(28.dp))
                Button(
                    onClick = {
                        if (loading) return@Button
                        loading = true
                        error = null
                        scope.launch {
                            try {
                                val result = viewModel.authenticate(
                                    serverUrl = serverUrl,
                                    email = email,
                                    password = password,
                                    displayName = displayName,
                                    username = username,
                                    register = isRegister
                                )
                                if (result == null) onSuccess() else error = result
                            } catch (_: Exception) {
                                error = "Не удалось подключиться. Проверь сервер и интернет."
                            } finally {
                                loading = false
                            }
                        }
                    },
                    enabled = !loading && email.isNotBlank() && password.isNotBlank() &&
                        (!isRegister || displayName.isNotBlank()),
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = TelegramBlue,
                        disabledContainerColor = Color(0xFFE1E4E8),
                        disabledContentColor = Color(0xFF8A929B)
                    ),
                    elevation = ButtonDefaults.buttonElevation(defaultElevation = 0.dp)
                ) {
                    if (loading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(21.dp),
                            strokeWidth = 2.dp,
                            color = Color.White
                        )
                        Spacer(Modifier.width(10.dp))
                        Text(if (isRegister) "Создаём аккаунт…" else "Входим…", fontSize = 16.sp)
                    } else {
                        Text(
                            if (isRegister) "Зарегистрироваться" else "Войти",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Spacer(Modifier.height(20.dp))
                TextButton(
                    onClick = {
                        isRegister = !isRegister
                        error = null
                    },
                    enabled = !loading,
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp)
                ) {
                    Text(
                        if (isRegister) "Уже есть аккаунт? Войти" else "Нет аккаунта? Зарегистрироваться",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.Medium
                    )
                }

                Spacer(Modifier.height(12.dp))
                TextButton(
                    onClick = { showServer = !showServer },
                    enabled = !loading,
                    contentPadding = PaddingValues(horizontal = 8.dp, vertical = 4.dp)
                ) {
                    Text(
                        if (showServer) "Скрыть настройки сервера" else "Настройки сервера",
                        fontSize = 13.sp,
                        color = AuthMuted
                    )
                }

                Spacer(Modifier.height(10.dp))
                Text(
                    text = "Продолжая, вы входите в свой аккаунт TEGE. Избранное и настройки темы хранятся на этом устройстве.",
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                    color = AuthMuted
                )
            }
        }
    }
}

@Composable
private fun AuthField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    placeholder: String? = null,
    password: Boolean = false
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it, color = AuthMuted) } },
        singleLine = !password,
        visualTransformation = if (password) PasswordVisualTransformation() else androidx.compose.ui.text.input.VisualTransformation.None,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = TelegramBlue,
            unfocusedBorderColor = AuthLine,
            focusedLabelColor = TelegramBlue,
            unfocusedLabelColor = AuthMuted,
            cursorColor = TelegramBlue,
            focusedTextColor = AuthInk,
            unfocusedTextColor = AuthInk
        )
    )
}
