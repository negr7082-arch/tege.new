# Tege Messenger (React + PWA)

Tege is a modern, responsive messenger web application and Progressive Web App (PWA) rewritten in React, TypeScript, Vite, and Tailwind CSS.

## Features
- **Conversations & Chat List**: Filterable chat list with search, contact status, message previews, unread badges, and color-coded avatars.
- **Chat Detail View**: Live conversation view with sent/received message bubbles, image attachments, voice/video call indicators, and quick options.
- **Interactive Messaging**: Real-time message composer with photo uploads, emoji stickers, and responsive simulated contact replies.
- **Profile Management**: Customizable user avatar, name, username, bio, phone number, and preferences.
- **Channels Directory**: Public feed discovery with one-click subscribe/unsubscribe.
- **PWA / Installable on Phone**: Progressive Web App with offline caching (`sw.js`), web manifest, and guided installation for Android (Chrome, Samsung Internet, Yandex) and iOS (Safari "Add to Home Screen").
- **Dark Mode**: Built-in dark and light themes with system preference detection and local storage persistence.

## Сервер (доставка сообщений между людьми)
Раньше всё хранилось в localStorage, поэтому сообщения ходили только между вкладками одного браузера.
Теперь есть настоящий сервер (`server/`, Node 20+, без зависимостей): аккаунты, каталог пользователей,
WebSocket-доставка, очередь для тех, кто офлайн, блокировки, группы и каналы.

```bash
npm install
npm run build:web
npm run server          # http://localhost:3001 — отдаёт и сайт, и API (/api, /ws)
# разработка: в двух терминалах `npm run server` и `npm run dev` (vite проксирует на :3001)
npm run test:server     # e2e-тест сервера
```
Данные лежат в `server/data/db.json` (положи на постоянный диск). Для APK или отдельного хоста
задай `VITE_SERVER_URL=https://твой-сервер` при сборке (см. `.env.example`).
Для работы по интернету нужен HTTPS (тогда WebSocket автоматически станет wss://).

## Tech Stack
- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide React
- Service Worker & Web App Manifest for mobile installation

## Сборка APK
1. Залейте проект в GitHub (ветка main).
2. Вкладка Actions → "Build Android APK (Tege Messenger)" → Run workflow.
3. Скачайте артефакт `Tege-Messenger-Debug-APK` (внутри app-debug.apk).

Папка `android/` генерируется Capacitor'ом автоматически. Старый нативный прототип лежит в `android-native/`.

## Видеозвонки, видеочаты и трансляции
Реальный WebRTC (PeerJS). Любой участник группы/канала нажимает «Войти в эфир» и подключается с любого устройства.
Эфир запускают владелец/админы; слушатели трансляции в каналах заходят с выключенным микрофоном.
Личные звонки (🎤/📹): собеседники нажимают одну и ту же кнопку в чате друг с другом.

## Постоянная база (чтобы аккаунты не пропадали на Render)
1. Создай бесплатную базу PostgreSQL на https://neon.tech (или Supabase) и скопируй строку подключения (Connection string).
2. В Render → сервис → Environment добавь переменную `DATABASE_URL` с этой строкой.
3. Сохрани и дождись перезапуска — в логах будет `Storage: PostgreSQL`.

## Безопасность ролей и подтверждённого профиля

Роли волонтёров и значок подтверждения назначаются только сервером по числовым ID аккаунтов. Клиентские поля, localStorage и адрес электронной почты сами по себе не дают привилегий. Не добавляй email в список ролей: регистрация пока не подтверждает владение почтовым ящиком.

В настройках окружения **серверного сервиса** задаются списки ID через запятую:

- `TEGE_VOLUNTEER_USER_IDS` — волонтёры;
- `TEGE_SENIOR_VOLUNTEER_USER_IDS` — старшие волонтёры;
- `TEGE_HEAD_VOLUNTEER_USER_IDS` — главные волонтёры;
- `TEGE_VERIFIED_USER_IDS` — аккаунты с подтверждённым значком.

Например, значение `TEGE_HEAD_VOLUNTEER_USER_IDS=1122101,1122102` даёт роль только этим серверным ID. Узнай ID из доверенной серверной базы, проверь владельца аккаунта вручную и перезапусти сервис после изменения переменных. Не публикуй секреты и не принимай ID из запросов клиента. Значок подтверждения тоже берётся из серверного списка, а не из email или состояния интерфейса.

Пока в приложении не реализовано подтверждение email, **не назначай привилегии по email**. Перед включением ролей для конкретных людей нужно сверить их существующие ID в серверной базе; не создавай привилегированные аккаунты заранее по непроверенному адресу.

## Server-side account security and incident response

Configure these on the **server** (never in frontend `VITE_*` variables):

- `TEGE_SECURITY_ADMIN_USER_IDS`: comma-separated numeric account IDs allowed to use the Security admin endpoints.
- `TEGE_VOLUNTEER_USER_IDS`, `TEGE_SENIOR_VOLUNTEER_USER_IDS`, `TEGE_HEAD_VOLUNTEER_USER_IDS`: staff roles.
- `TEGE_VERIFIED_USER_IDS`: verified badge allowlist.

Security admin API (requires an authenticated account ID in `TEGE_SECURITY_ADMIN_USER_IDS`):
- `POST /api/security/admin/overview` with `{ "token": "..." }`: review account suspension status, recent security events and active session metadata.
- `POST /api/security/admin/action` with `{ "token": "...", "action": "freeze_account", "targetUserId": 123, "reason": "..." }`: permanently suspend an account and revoke all its sessions.
- Other manual actions: `unfreeze_account`, `block_email`/`unblock_email`, `block_ip`/`unblock_ip`, `block_device`/`unblock_device`. Account, email, IP and device blocks are server-side and persist with the database. Unblocking an email does not automatically unfreeze its existing account; explicitly review and unfreeze it if appropriate.
- Ten failed password attempts for the same email/IP pair in 15 minutes cause a temporary 15-minute IP lockout. This is intentionally temporary to limit brute-force abuse without permanently locking out shared networks.

Successful logins from a previously unseen IP or app-install ID create security review events. The app-install ID is a random persistent client identifier, **not a hardware-backed identity**: users can clear or copy it, and VPNs can change IPs. User-Agent and IP signals are evidence for review, not proof that an account was sold or compromised. Do not automatically permanently ban users based only on IP, VPN use, or device heuristics; mobile carriers, schools, workplaces and VPNs share IPs. Permanent freezes and durable IP/email/device blocks require an authorized Security administrator to review evidence.

No application can guarantee that an attacker is blocked forever across VPNs, new devices, reinstallations, proxies and alternate networks. Stronger assurance requires verified email, a second factor/passkeys, rate limiting at the edge, reliable persistent server storage, and careful operational review. The current optional cloud password is not a substitute for a verified out-of-band factor.


### Automatic suspicious-login freeze

The server records recent successful-login IPs and install/device signals. A login is automatically frozen for Security review when a password-authenticated login combines a previously unseen IP with a previously unseen device ID, or when the account appears from 3 or more distinct IPs within 24 hours. The account's sessions are revoked and the reason is recorded as **«ПП/взломан или продан — автоматическая блокировка по признакам риска; требуется проверка»**. An IP change alone is logged for review, not treated as proof of compromise, because mobile networks and VPNs can change addresses legitimately. A security administrator must review and unfreeze the account. Device IDs are client-generated and can be reset or copied, so they are risk signals rather than hardware identity.


### 24-hour account freeze for suspicious logins

A login combining a previously unseen IP and device signal, or 3+ distinct IPs in 24 hours, immediately freezes the account for 24 hours and revokes its sessions. A security alert is recorded and sent to configured volunteers, senior volunteers and volunteer leads. After 24 hours, the temporary freeze expires; the same signal is not allowed to immediately re-freeze the account during the following 24 hours. A single IP or carrier change is not sufficient proof of compromise. Device and carrier metadata are risk signals, not definitive proof of a physical person's identity.


### Native Android security and FAQ

The native Kotlin/Jetpack Compose app includes a **FAQ и правила** screen from the navigation drawer covering account ownership, account recovery, privacy, anti-harassment, group/channel rules, reports, moderation and appeals. Android authentication can submit a device-key fingerprint and a signed nonce proof generated by an Android Keystore EC key, plus limited model/manufacturer/SDK metadata when the caller provides an Android context. The server verifies the signature and rejects reused nonces. The key is non-exportable by design where supported, but hardware-backed storage varies by device. These are risk signals only; no IMEI or serial number is collected. Carrier/operator identity is not inferred from client-supplied claims; reliable ASN/carrier enrichment requires a configured server-side IP intelligence provider.
