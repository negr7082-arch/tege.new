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
    FaqEntry("Можно ли продавать, покупать или передавать аккаунт?", "Нет. Запрещены продажа, покупка, обмен, аренда и передача аккаунта другим людям. Не передавайте пароль, коды входа и доступ к своим сессиям. Аккаунт должен оставаться под контролем его владельца."),
    FaqEntry("Как защитить свой аккаунт?", "Придумайте длинный уникальный пароль, который не используете на других сайтах. Включите дополнительный пароль, если такая возможность доступна. Не сообщайте никому коды подтверждения и завершайте незнакомые сеансы в настройках аккаунта."),
    FaqEntry("Как не попасться мошенникам?", "Не переходите по подозрительным ссылкам и не скачивайте файлы от незнакомых людей. Никому не сообщайте пароль, коды входа или резервные данные — даже если собеседник представляется поддержкой, волонтёром или администратором. Проверяйте имя пользователя и не верьте обещаниям подарков, денег или бесплатной проверки аккаунта."),
    FaqEntry("Что делать, если я сообщил код или пароль мошеннику?", "Как можно скорее смените пароль, завершите все незнакомые сеансы и включите дополнительную защиту. Если вы потеряли доступ, обратитесь в официальный канал поддержки. Не платите за «возврат» аккаунта и не передавайте новые коды посторонним."),
    FaqEntry("Почему аккаунт могут заморозить на 24 часа?", "Если одновременно обнаружены несколько серьёзных признаков риска, вход может быть остановлен, а аккаунт временно заморожен на проверку сроком до 24 часов. Информация о подозрительном случае передаётся волонтёрам и старшим ответственным для проверки. Смена IP сама по себе не доказывает нарушение: VPN, мобильная сеть и поездки могут менять адрес."),
    FaqEntry("Кто рассматривает подозрительные случаи?", "Сообщения о риске передаются волонтёрам, старшим волонтёрам и руководителям волонтёров, назначенным для модерации. Они проверяют доступные сведения и решают, нужны ли дальнейшие меры. Никто из команды не должен просить у вас пароль или код входа."),
    FaqEntry("Как безопасно общаться?", "Будьте вежливы, уважайте личные границы и прекращайте общение, если вас об этом попросили. Запрещены угрозы, травля, преследование, шантаж, спам, мошенничество и выдача себя за другого человека."),
    FaqEntry("Что нельзя публиковать в чатах, группах и каналах?", "Не публикуйте чужие личные данные без согласия, вредоносные ссылки, мошеннические предложения, угрозы и незаконный контент. Не рассылайте рекламу массово и соблюдайте правила конкретного сообщества."),
    FaqEntry("Как пожаловаться на пользователя?", "Если доступна функция жалобы, укажите конкретное сообщение или пользователя и кратко опишите проблему. При необходимости сохраните доказательства, но не публикуйте личные данные публично. Не используйте жалобы для мести."),
    FaqEntry("Что делать, если аккаунт заблокирован или заморожен по ошибке?", "Обратитесь в официальный канал поддержки, укажите имя пользователя и примерное время проблемы и спокойно опишите ситуацию. Не отправляйте пароль, коды подтверждения, токены или полные платёжные данные."),
    FaqEntry("Какие наказания возможны за нарушение правил?", "В зависимости от ситуации могут применяться предупреждение, ограничение функций, временная заморозка или блокировка аккаунта. При подозрении на взлом доступ могут временно остановить, чтобы защитить владельца и дать команде время проверить случай.")
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FaqScreen(onBack: () -> Unit) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Помощь и правила") },
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
                "Безопасность аккаунта и общение",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            Text(
                "Короткие ответы о защите аккаунта, мошенниках и правилах общения.",
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
                "Берегите свои данные и обращайтесь за помощью только через официальные каналы.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(bottom = 20.dp)
            )
        }
    }
}
