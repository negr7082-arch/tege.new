package org.tege.messenger.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.HelpOutline
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

private data class FaqEntry(val question: String, val answer: String)

private val faqEntries = listOf(
    FaqEntry("Можно ли продавать, покупать или передавать аккаунт?", "Нет. Аккаунт предназначен для одного владельца. Продажа, покупка, аренда, передача пароля или токена запрещены. При подтверждении нарушения аккаунт может быть заморожен, а сессии отозваны."),
    FaqEntry("Что делать, если аккаунт взломали?", "Смените пароль, завершите другие сессии и обратитесь в поддержку через официальный канал. Не отправляйте пароль, коды подтверждения или резервные ключи другим людям."),
    FaqEntry("Почему вход может попасть на проверку на 24 часа?", "Новый IP, необычная частота смены адресов, новый оператор или незнакомое устройство могут запустить проверку. Это не доказательство нарушения само по себе. Система сопоставляет несколько сигналов и при необходимости просит подтвердить вход."),
    FaqEntry("Что система знает о моём телефоне?", "Приложение может передавать случайный идентификатор установки, версию Android, модель устройства и результат поддерживаемых проверок целостности. Оно не должно собирать IMEI или серийный номер. Геолокация и контакты не нужны для обычной проверки входа."),
    FaqEntry("Можно ли заблокировать устройство?", "При подтверждённом злоупотреблении администратор может заблокировать зарегистрированный идентификатор/ключ устройства на сервере. Это не гарантирует идентификацию физического телефона после сброса, переустановки или смены ключей. IP-блокировка отдельно может затронуть других людей в общей сети."),
    FaqEntry("Почему VPN или смена оператора не означает взлом?", "VPN, мобильная сеть, поездка и корпоративная сеть могут менять IP, страну или ASN. Поэтому один IP или оператор не является достаточным основанием для постоянного бана."),
    FaqEntry("Какие правила общения действуют?", "Запрещены угрозы, травля, преследование, публикация чужих личных данных без согласия, спам, мошенничество, выдача себя за другого человека и распространение вредоносных ссылок. Уважайте границы собеседника и прекращайте общение, если вас попросили."),
    FaqEntry("Что запрещено в группах и каналах?", "Не размещайте незаконный контент, мошеннические предложения, массовую рекламу без разрешения, угрозы, доксинг и контент, нарушающий права других людей. Администраторы могут удалять публикации и ограничивать участников по правилам сообщества."),
    FaqEntry("Как пожаловаться на сообщение или пользователя?", "Используйте встроенную функцию жалобы, если она доступна, и укажите конкретную причину. Не отправляйте жалобы ради мести. Модераторы рассматривают контекст и могут запросить дополнительные сведения."),
    FaqEntry("Какие меры может принять TEGE?", "В зависимости от серьёзности и повторяемости нарушения: предупреждение, ограничение отдельных функций, временная блокировка, заморозка для проверки или постоянная блокировка. При риске компрометации сессии могут быть отозваны немедленно."),
    FaqEntry("Как обжаловать блокировку?", "Обратитесь в официальный канал поддержки, укажите имя пользователя, примерное время блокировки и кратко объясните ситуацию. Не публикуйте пароли, токены, коды входа или полные платёжные данные.")
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FaqScreen(onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("FAQ и правила TEGE") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Назад")
                    }
                },
                actions = {
                    Icon(Icons.Default.HelpOutline, contentDescription = null, modifier = Modifier.padding(end = 16.dp))
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                "Безопасность, аккаунты и общение",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            Text(
                "Правила помогают защищать пользователей. Автоматические сигналы риска требуют оценки и не всегда означают нарушение.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            faqEntries.forEach { entry ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerLow)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(entry.question, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(entry.answer, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            Text(
                "Эти правила — базовая политика приложения. Если локальное законодательство требует дополнительных ограничений, применяются соответствующие требования.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 20.dp)
            )
        }
    }
}
