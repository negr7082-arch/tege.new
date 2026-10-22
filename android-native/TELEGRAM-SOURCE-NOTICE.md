# Telegram for Android — source and license notice

Upstream project: https://github.com/DrKLO/Telegram  
Upstream license: GNU General Public License, version 2 (GPL-2.0)  
Upstream license text: https://github.com/DrKLO/Telegram/blob/master/LICENSE

## Integration policy

TEGE may adapt and integrate compatible Android UI components and features from the upstream Telegram for Android project. Any copied or derivative source must retain its applicable copyright and license notices, and the corresponding GPL-2.0 license text must be provided with distributed builds/source.

The upstream Telegram Android app is a large Java/C++ application built around Telegram's own protocol and service architecture. TEGE currently uses Kotlin/Jetpack Compose and its own backend. Therefore, upstream files must not be copied wholesale into the Compose app without checking their build dependencies, protocol assumptions, and compatibility. UI patterns and self-contained components can be ported first; protocol-dependent features (for example, Telegram account/session, MTProto messaging, Telegram calls, and Telegram push delivery) are not automatically compatible with TEGE's backend.

## Important distinction

TEGE's own backend and account system remain the source of truth for TEGE users and conversations. A Telegram-inspired or adapted UI does not mean the app connects to Telegram's network or supports Telegram accounts.

No claim is made here that the full upstream Telegram application has already been integrated. Add specific upstream file attribution and preserve original headers whenever upstream code is actually ported.
