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

## Native Android attachment UX slice (implemented on this branch)

- Added `TelegramAttachmentSheet.kt`: a Compose attachment sheet for image, video, audio, and arbitrary files, using Android's Storage Access Framework rather than requesting broad storage access.
- Wired the paperclip action in `ChatDetailScreen.kt` to the picker and added an attachment message card that opens the selected content with its detected MIME type and read-URI grant.
- Added `TegeViewModel.sendAttachment(...)` so picked files appear in the current chat's in-memory message list with a filename and formatted size.
- Video-note messages remain rendered as circular bubbles; they are deliberately not handed off to the system's rectangular video player.

**Current limitation:** this is the native UI/data-flow slice, not Telegram server upload/sync. Attachment messages currently live in the in-memory Compose prototype; real upload, remote delivery, durable cache, and Telegram-compatible circular video-note playback still need implementation and device/build testing. No APK build has been verified in this environment.


## Expanded feature backlog from Telegram / Telegram X / Monogram

The following are planned targets, not claims of completed implementation. Port only features that fit the host architecture and preserve the source licenses.

### Messaging and media
- Photo/video gallery preview before sending, multi-select, captions, send-as-file vs send-as-media.
- In-app image viewer, video player, zoom, swipe between media, download/share/save.
- Proper round video-note capture/playback, voice-message recording with waveform, playback speed, seek, and background playback.
- Upload/download progress, cancel/retry, file size/type display, thumbnails, caching, and large-file handling.
- Reply, forward, edit, delete, pin, copy, select multiple messages, message links, reactions, and read/delivery states.
- Drafts, typing indicators, unread divider, jump-to-latest, message search, and chat history pagination.

### Chat list and navigation
- Archive, folders/filters, pinned chats, mute/unmute, unread counts, mark-as-read, chat search.
- Contact/profile sheets, usernames, shared media/files/links tabs, block/report, privacy controls.
- Group member management, invite links, admin permissions, topics, polls/quizzes, channel posting and comments.
- Story viewer/editor and account switching only where the server/data model supports the behavior.

### Calling, notifications, and reliability
- Push notifications with correct account/chat routing, notification actions, per-chat settings, and mute schedules.
- Real call signaling and WebRTC lifecycle, permissions, Bluetooth/audio route, reconnect, and call UI states.
- Offline queue, retry/backoff, duplicate prevention, sync after reconnect, lifecycle restoration, and persistent local storage.

### Visual and accessibility parity
- Telegram-like attachment bottom sheet, media bubbles, voice/video note controls, context menus, swipe-to-reply, haptics, and dark theme.
- Dynamic type, TalkBack labels, keyboard behavior, RTL support, and reduced-motion handling.

### Required implementation gates
1. Implement UI plus a real model/API action together; don't add decorative controls that do nothing.
2. For network features, define request/response and error states, then test against the actual TEGE backend or Telegram client stack.
3. Keep local file URIs local-only; never pretend a selected attachment has been uploaded or delivered until the server confirms it.
4. Run a clean Android build and add tests for the affected behavior before calling a feature complete.
