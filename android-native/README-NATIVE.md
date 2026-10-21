# Нативный Android-клиент Tege

Здесь находится отдельное нативное приложение на **Kotlin + Jetpack Compose**. Оно не заменяет веб-клиент в корне репозитория и не использует Capacitor.

## Структура

- `app/src/main/java/org/tege/messenger/MainActivity.kt` — точка входа и навигация.
- `ui/screens/` — экраны авторизации, списка чатов, диалога, каналов, профиля и настроек.
- `viewmodel/TegeViewModel.kt` — состояние интерфейса и действия пользователя.
- `model/Models.kt` и `data/SampleData.kt` — модели и демонстрационные данные.
- `service/` — вспомогательные сервисы приложения.

## Сборка APK через GitHub Actions

Workflow **Build Native Android APK (Kotlin + Compose)** собирает именно этот нативный проект:

1. Откройте вкладку **Actions** в GitHub.
2. Выберите **Build Native Android APK (Kotlin + Compose)**.
3. Нажмите **Run workflow** (или откройте результат запуска после push/PR с изменениями в `android-native/`).
4. Скачайте артефакт **Tege-Native-Debug-APK** — в нём будет `app-debug.apk`.

Workflow использует JDK 17, Android SDK 34 и Gradle 8.2.1. Gradle Wrapper пока не добавлен, поэтому CI запускает установленный Gradle напрямую.

## Локальная сборка

Нужны JDK 17, Android SDK с платформой 34 и Gradle 8.2.1. Из корня репозитория выполните:

```bash
cd android-native
gradle --no-daemon assembleDebug
```

APK появится в `app/build/outputs/apk/debug/app-debug.apk`.

## Текущие ограничения

- `SampleData.kt` содержит демонстрационные данные; наличие экранов само по себе не означает, что серверная авторизация и синхронизация сообщений уже подключены.
- Этот workflow проверяет компиляцию и сборку debug APK, но не заменяет ручное тестирование на устройстве.
- Веб/PWA и Capacitor APK собираются отдельными workflow и остаются независимыми от этого нативного клиента.
