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
