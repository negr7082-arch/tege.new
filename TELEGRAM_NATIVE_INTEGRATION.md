# TEGE + native Telegram integration

## Target

Ship one Android APK with the TEGE Compose experience and Telegram's native Android client. The Telegram screen must not be a WebView and must not launch a second installed app.

## Current boundaries

- `android-native/` is the TEGE Compose application (`org.tege.messenger`).
- `third_party/Telegram/` is the upstream Telegram Android Gradle build. Its application is `:TMessagesProj_App`, backed by `:TMessagesProj` and native media modules.
- The current TEGE `ScreenRoute.Telegram` points at `TelegramWebScreen`; this is a temporary placeholder and does not satisfy the final requirement.
- The TEGE-chan easter egg lives in `TelegramDrawer.kt` and `TegeChan3DView.kt`.

## Integration approach

1. Keep Telegram's Gradle build as the host initially. It owns the native libraries, manifest merge rules, native build configuration and Telegram application initialization.
2. Convert TEGE's UI/domain sources into an Android library module (not a second application). Exclude `MainActivity` and application-only configuration from that library; preserve TEGE screens, models, viewmodels and Compose components.
3. Add the TEGE library to `:TMessagesProj_App` and resolve Kotlin/Compose versions against Telegram's current AGP/Kotlin toolchain. Avoid maintaining two competing application IDs or two launcher activities.
4. Add a TEGE entry point in Telegram's native navigation, preserving Telegram's `ApplicationLoaderImpl`, notification services, deep links, permissions, and native account lifecycle.
5. Replace the WebView route with the in-process native Telegram entry point; ensure back navigation returns to TEGE rather than exiting or creating another task.
6. Build the APK in CI and inspect the merged manifest, dependency graph, APK package/application ID, and APK contents. Test login, chat list, media, notifications, back navigation, and TEGE-chan on a real device before calling it complete.

## Guardrails

- Do not merge the two Gradle roots by merely adding `includeBuild` or including both app modules; that would not produce one integrated application.
- Do not commit Telegram API credentials, signing keys, or local secret files. Configure required credentials as GitHub Actions secrets or local untracked properties.
- Keep the integration PR unmerged until the unified APK builds and the native Telegram screen works.
