# Telegram + TEGE integration plan

## Current verified state

- `android-native/` is the existing Kotlin/Jetpack Compose TEGE client.
- `third_party/Telegram/` contains the upstream Telegram for Android Gradle project; it is not currently included by `android-native/settings.gradle.kts`.
- The two projects have separate Gradle configurations and Android plugin versions. Adding the Telegram project as a Gradle subproject without resolving its build configuration would risk breaking the existing TEGE APK build.
- TEGE's backend and Telegram's MTProto service are different systems. Telegram credentials, sessions, messages, and encryption keys must never be sent to the TEGE backend.

## Target architecture

1. Keep TEGE login, token, contacts, and conversations backed by the TEGE server.
2. Keep Telegram login and session state in Telegram's own client/session implementation, using Telegram's official API and MTProto implementation.
3. Present a clear account/service switcher in the Android app, while maintaining separate storage and logout actions for each service.
4. Treat web integration as a separate workstream: the Android Telegram source cannot simply be reused in the existing Vite web client. Use only an officially supported Telegram web/client approach or a separately implemented Telegram API client where permitted.
5. Preserve upstream Telegram copyright and GPL-2.0 notices for any copied or derivative code. Do not use Telegram branding in a way that implies official affiliation.

## Current integration milestone: Telegram Web inside the TEGE Android app

- The native app now has a separate `Telegram` drawer entry that opens the official Telegram Web K client at `https://web.telegram.org/k/` inside an Android WebView.
- This is a practical first step to use TEGE and Telegram from one installed Android app without merging incompatible Gradle projects or routing Telegram secrets through the TEGE backend.
- WebView cookies/storage are handled by Android's WebView profile, separately from TEGE account state. This does not automatically import Telegram sessions from the native Telegram app.
- This is a web-client integration, not a native MTProto integration. Availability of Telegram Web inside a WebView and all login flows must be verified on a real device; if Telegram blocks or limits embedded WebView use, the safe fallback is opening the official web client in the system browser.
- The upstream Android Telegram source remains vendored but is not compiled into the TEGE app yet.

## Remaining integration sequence

- Phase A: preserve the existing TEGE build and establish CI validation on this integration branch.
- Phase B: verify the embedded Telegram Web screen compiles and behaves on Android; test sign-in, navigation, cookies, and back handling.
- Phase C: decide whether to continue with Telegram Web or invest in a full native MTProto integration. The upstream project has separate Gradle configuration, native libraries, manifests, and application lifecycle, so do not merge it blindly.
- Phase D: keep TEGE and Telegram account/session state independent and test separate sign-out behavior.
- Phase E: verify no Telegram credentials or message payloads are sent to the TEGE backend.
- Phase F: handle web and server architecture explicitly; TEGE server should not proxy Telegram login passwords or store Telegram sessions.

## API credentials

- The vendored upstream `BuildVars.java` currently contains upstream Telegram API values. Do not treat those values as credentials for TEGE or as permission to ship a fork. Configure the fork with its own `api_id` and `api_hash` before testing a real Telegram sign-in or distributing a build.
- `api_id` and `api_hash` are Telegram application credentials. Never commit your own values to source files, build logs, or the repository.
- If build-time configuration is needed, store credentials as repository Actions secrets and pass them only to the relevant build step. A secret being configured does not by itself complete Telegram login integration.
- The client must still implement Telegram's authentication/session flow; merely adding the credentials does not connect Telegram to TEGE.

## Completion criteria

Do not describe the integration as complete until a CI build compiles the actual integration, the Android app launches both service paths, Telegram sign-in reaches Telegram's servers, TEGE sign-in still reaches only the TEGE backend, and independent session/logout tests pass. A successful TEGE-only APK build is a baseline check, not proof of Telegram integration.
