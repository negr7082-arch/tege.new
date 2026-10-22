# TEGE Android: Telegram combo integration

## Goal

Ship one TEGE-branded Android application that keeps existing TEGE features and adds a real Telegram client experience. Do not replace real networking with mock conversations or simulated replies.

## Repository baseline

- The primary TEGE app is React + TypeScript + Vite and uses Capacitor for Android packaging.
- `android-native/` is a separate Kotlin/Jetpack Compose prototype; its `SampleData.kt` indicates that at least some displayed data is local/demo data.
- `telegram-android/` contains the official Telegram Android source tree and its `.gitmodules` lists native dependencies. The presence of files in Git does not prove all Git submodules are initialized or that the project builds in this environment.
- `Telegram X` and `Monogram` are separate native clients with their own architectures and protocol implementations. Combining all three complete applications as if they were reusable libraries would duplicate application shells and networking stacks, increase APK size, and create conflicting ownership of login, notifications, media, and calls.

## Integration decision

Use the existing Telegram Android source as the first real Telegram client base, subject to a clean build and API-credential setup. Keep TEGE's own account, community, companion, and server functionality as a distinct feature area inside the same branded app. Evaluate Telegram X and Monogram for targeted UX ideas or independently reusable components only after reviewing their exact licenses and dependency requirements; do not copy entire applications blindly.

The initial implementation must not claim that Telegram X or Monogram features are integrated until specific code has been ported and tested.

## Work sequence

1. **Source and build audit**: verify submodule status, Gradle/SDK/NDK requirements, API credential configuration, package IDs, Firebase placeholders, signing configuration, and licensing notices.
2. **Build a baseline APK**: build the Telegram source independently before changing app identity or wiring in TEGE. Record exact build failures instead of guessing.
3. **Choose the Android shell**: make the Telegram native project the host for native Telegram features; expose TEGE as an in-app module/WebView route or port TEGE screens selectively. Do not nest two competing Android application entry points.
4. **Define navigation and boundaries**: one TEGE home/navigation layer with explicit Telegram and TEGE feature destinations; separate account/session storage and permissions until a safe shared model is designed.
5. **Implement incrementally**: authentication and chat list first, then chat/media, groups/channels, notifications, calls, and TEGE feature entry points. Use real Telegram APIs and real TEGE backend endpoints respectively.
6. **Verify**: compile affected modules, run available tests, check deep links/back navigation, lifecycle, offline behavior, notifications, media permissions, and device builds.
7. **Publish responsibly**: use TEGE's own API credentials, application ID, Firebase configuration, signing key, attribution, and license notices. Never commit secrets or dummy release credentials.

## Acceptance criteria

- Existing TEGE functionality is not silently removed.
- Telegram login and message delivery use Telegram's real network stack, not sample data.
- The app builds from a documented clean checkout with required submodules and local secrets supplied externally.
- No credentials, signing keys, or Firebase service secrets are committed.
- Any borrowed code has its source and applicable license preserved.
- Each feature is described as implemented only after code and tests support that claim.

## Current status

This document records the integration approach only. It is not evidence that a merged APK has been produced or that Telegram X/Monogram features have already been ported.