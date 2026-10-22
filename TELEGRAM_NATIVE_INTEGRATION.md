# TEGE + native Telegram integration

## Target

Ship one Android APK with the TEGE Compose experience and Telegram's native Android client. The Telegram screen must not be a WebView and must not launch a second installed app.

## Current boundaries

- `android-native/` is the TEGE Compose application (`org.tege.messenger`).
- `third_party/Telegram/` is the upstream Telegram Android Gradle build. Its application is `:TMessagesProj_App`, backed by `:TMessagesProj` and native media modules.
- The current TEGE `ScreenRoute.Telegram` points at `TelegramWebScreen`; this is a temporary placeholder and does not satisfy the final requirement.
- The TEGE-chan easter egg lives in `TelegramDrawer.kt` and `TegeChan3DView.kt`.

## Verified integration risks

| Area | TEGE app | Telegram Android tree | Consequence |
|---|---|---|---|
| Android build | AGP 8.2.2, Gradle 8.2.1, compile SDK 34 | AGP 8.13.2, Gradle 8.13, compile SDK 36 | Use Telegram's root as the initial host; don't combine the roots blindly. |
| Kotlin / UI | Kotlin 1.9.22, Compose compiler 1.5.8 | Kotlin 2.1.0 toolchain | Resolve Compose compiler/plugin compatibility before moving Compose sources into a module. |
| Application entry | `org.tege.messenger.MainActivity` | Telegram's own app plugin, manifests and application initialization | One app manifest and one launcher flow must be retained; Telegram's startup lifecycle cannot be bypassed. |
| Native dependencies | No Telegram native libraries wired into this build | `:TMessagesProj` plus media/VoIP/native modules and submodules | A successful TEGE-only build does not validate Telegram integration. |
| Package identity | `org.tege.messenger` | `APP_PACKAGE` defaults to `org.telegram.messenger` | Pick the final application ID intentionally and inspect merged manifests and deep links. |
| Existing Telegram route | `TelegramWebScreen` in WebView | Native Telegram activities/fragments and account lifecycle | Replace the WebView route only after an in-process native entry point exists. |

## Integration approach

1. **Preserve a green baseline.** Keep the current TEGE APK build as a separate CI check while experimenting on a feature branch.
2. **Make Telegram the host.** Keep Telegram's Gradle build as the host initially. It owns the native libraries, manifest merge rules, native build configuration and Telegram application initialization.
3. **Extract TEGE into a library.** Convert TEGE UI/domain sources into an Android library module (not a second application). Exclude `MainActivity` and application-only configuration; preserve screens, models, viewmodels and Compose components.
4. **Resolve toolchains deliberately.** Add the TEGE library to `:TMessagesProj_App` and reconcile Kotlin/Compose versions with Telegram's current AGP/Kotlin toolchain. Avoid maintaining two competing application IDs or launcher activities.
5. **Add an in-process TEGE entry point.** Integrate TEGE navigation into Telegram's native app while preserving `ApplicationLoaderImpl`, notification services, deep links, permissions and Telegram's native account lifecycle.
6. **Replace the placeholder.** Replace the WebView route with the native Telegram entry point and make back navigation return to the correct TEGE screen without starting another task.
7. **Verify the actual artifact.** Build in CI; inspect the merged manifest, dependency graph, package/application ID, APK contents and native ABIs. Test login, chat list, messages, media, notifications, back navigation and TEGE-chan on a real device.

## Acceptance checklist

- [ ] One installable APK; no second Telegram app required.
- [ ] Telegram chat list and conversations are rendered by the native Telegram client, not WebView.
- [ ] Telegram login, media, notifications, deep links and back navigation work.
- [ ] TEGE screens and the hidden TEGE-chan Easter egg remain accessible.
- [ ] CI builds the integrated APK and uploads the artifact from the exact tested commit.
- [ ] A real-device smoke test is recorded before describing the integration as complete.

## Guardrails

- Do not merge the two Gradle roots by merely adding `includeBuild` or including both application modules; that does not create one integrated application.
- Do not commit Telegram API credentials, signing keys, or local secret files. Configure required credentials as GitHub Actions secrets or local untracked properties.
- Keep the integration PR unmerged until the unified APK builds and the native Telegram screen works.
- Keep upstream Telegram license and notices intact; verify the applicable license and redistribution requirements before publishing an APK.
