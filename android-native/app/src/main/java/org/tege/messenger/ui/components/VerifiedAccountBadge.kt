package org.tege.messenger.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

fun isTegeVerifiedAccount(email: String?): Boolean =
    email.equals("negr7082@gmail.com", ignoreCase = true)

/**
 * UI badge for the designated Tege account. This is a client-side visual label,
 * not proof of email ownership or server-issued verification.
 */
@Composable
fun VerifiedAccountBadge(
    modifier: Modifier = Modifier,
    compact: Boolean = false
) {
    var showDetails by remember { mutableStateOf(false) }

    Row(
        modifier = modifier
            .clip(CircleShape)
            .clickable { showDetails = true },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.Center
    ) {
        androidx.compose.foundation.layout.Box(
            modifier = Modifier
                .size(if (compact) 17.dp else 20.dp)
                .clip(CircleShape)
                .background(Color(0xFF3390EC)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = "✓",
                color = Color.White,
                fontSize = if (compact) 11.sp else 13.sp,
                fontWeight = FontWeight.ExtraBold,
                lineHeight = if (compact) 11.sp else 13.sp
            )
        }
    }

    if (showDetails) {
        AlertDialog(
            onDismissRequest = { showDetails = false },
            title = {
                Text("Подтверждённый аккаунт")
            },
            text = {
                Text(
                    "Этот аккаунт отмечен галочкой в Tege. " +
                        "Сейчас это визуальная отметка приложения, а не серверная проверка личности или владения почтой."
                )
            },
            confirmButton = {
                TextButton(onClick = { showDetails = false }) {
                    Text("Понятно")
                }
            }
        )
    }
}
