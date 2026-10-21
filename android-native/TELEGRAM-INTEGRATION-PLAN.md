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

## Safe implementation sequence

- Phase A: preserve the existing TEGE build and establish CI validation on this integration branch.
- Phase B: map the upstream Telegram app's Gradle modules, manifest/application entry points, API ID configuration, and session storage; identify collisions with TEGE before changing build files.
- Phase C: choose an integration boundary. Prefer a separately built Telegram client/module boundary over wholesale source copying. Do not merge application manifests or Gradle plugin versions blindly.
- Phase D: implement a visible service/account switcher only after both client entry points can compile and launch independently.
- Phase E: add tests for independent sign-in/sign-out and verify no Telegram credentials or message payloads are sent to the TEGE backend.
- Phase F: handle web and server architecture explicitly; TEGE server should not proxy Telegram login passwords or store Telegram sessions.

## API credentials

- `api_id` and `api_hash` are Telegram application credentials. Never commit them to source files, build logs, or the repository.
- If build-time configuration is needed, store credentials as repository Actions secrets and pass them only to the relevant build step. A secret being configured does not by itself complete Telegram login integration.
- The client must still implement Telegram's authentication/session flow; merely adding the credentials does not connect Telegram to TEGE.

## Completion criteria

Do not describe the integration as complete until a CI build compiles the actual integration, the Android app launches both service paths, Telegram sign-in reaches Telegram's servers, TEGE sign-in still reaches only the TEGE backend, and independent session/logout tests pass. A successful TEGE-only APK build is a baseline check, not proof of Telegram integration.
