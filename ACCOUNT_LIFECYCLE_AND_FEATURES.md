# TEGE account lifecycle and feature backlog

This document is a specification, not a claim that these behaviors are already wired into the production server.

## Automatic account deletion after inactivity

Offer the user a selectable inactivity period in **Settings → Privacy & Security → Delete my account if away**:

- 1 month
- 3 months
- 6 months
- 8 months
- 12 months
- 16 months
- 24 months
- Never (default for existing accounts until the user chooses)

### Required behavior

1. Show the current selection and the last activity date, plus a clear explanation of what will be deleted.
2. Count inactivity from the last authenticated activity recorded by the server, not the phone's local clock or whether a WebSocket happens to be connected.
3. Successful login and authenticated user activity update a server-side `lastActiveAt` timestamp.
4. A scheduled server-side cleanup checks due accounts. Before deleting, it must re-check the current preference and timestamp.
5. Delete account credentials, tokens/sessions, push subscriptions, inbox/offline queue, block lists, group memberships and account-owned groups/channels. Remove or anonymize account references in any retained content according to an explicit retention policy.
6. Revoke active WebSocket sessions and broadcast a user removal event so other clients remove the account from directories.
7. Provide an explicit **Delete account now** flow requiring password re-authentication and a final confirmation. Make the consequences clear and don't make a destructive action one tap.
8. Add server tests for every inactivity choice, activity resetting the timer, revoked tokens, related-data cleanup, and cleanup after a server restart.
9. Keep the default **Never** until a user explicitly chooses a period; do not silently opt users into account deletion.

### Suggested API contract

- `POST /api/account/inactivity` — authenticated; accepts `months: 1 | 3 | 6 | 8 | 12 | 16 | 24 | null`, where `null` means never.
- `POST /api/account/inactivity/status` — authenticated; returns selected period, `lastActiveAt`, and estimated deletion date.
- `POST /api/account/delete` — authenticated and re-authenticated; deletes the account immediately.
- Internal scheduled cleanup — runs periodically on the server and is idempotent.

The existing server uses a JSON-backed database (optionally stored in PostgreSQL) and already has account tokens, sessions, inboxes, push subscriptions, blocks, groups, and channels. The implementation must update all of these consistently and be covered by end-to-end tests before the UI advertises automatic deletion as active.

## Other high-value features to implement next

Prioritize features that can be connected to real server actions rather than decorative controls:

1. **Privacy controls:** who can see online/last seen, profile photo, phone number, calls, and who can add the user to groups; exceptions and block list.
2. **Session manager:** device name, last active, revoke one session, revoke all other sessions.
3. **Message controls:** edit/delete for everyone with server-side authorization, reply/forward, reactions, pin, report, and search.
4. **Chat folders and archive:** custom folders, pinned chats, unread-only filter, mute schedules, and archive.
5. **Reliable media:** real uploads, previews, progress, retry/cancel, cache cleanup, and download/share.
6. **Safety:** report/block flow, spam rate limits, suspicious login alerts, and account recovery.
7. **Backup and export:** export account data and request account deletion without hiding either option.
8. **Accessibility:** dynamic text size, screen-reader labels, RTL layouts, and keyboard support.

## Implemented on the feature branch (not yet build/test verified)

- Added server routes to read/save the inactivity period and estimate the deletion date. Supported choices are 1, 3, 6, 8, 12, 16, 24 months and Never. Existing accounts default to Never.
- Added server-side `lastActiveAt` updates on login, WebSocket connection and message send, plus an hourly cleanup that re-checks due accounts.
- Added immediate account deletion requiring the current password; it revokes sessions and removes account-owned push subscriptions, inbox, blocks, memberships, groups and channels, then broadcasts a directory removal event.
- Added a Settings → Privacy & Security selector and a Security punishment-history panel.
- Added server-side rolling-window spam enforcement: 100 message attempts in 19 minutes triggers a 3-day mute; 200 attempts in that window escalates to permanent mute. A repeat 100-message violation after a previous system spam punishment also escalates to permanent mute. The client cannot bypass the server's send check.
- Added a private deployment allowlist mechanism for volunteer role labels. Configure `TEGE_VOLUNTEER_EMAILS` in hosting environment settings; do not commit email addresses to the repository. The role label itself grants no moderation powers.
- Added end-to-end test cases for inactivity preference endpoints and Security history.

**Important:** These changes have been committed to the feature branch but have not been built or run through the test suite in this conversation. Account deletion and spam enforcement must be tested before deploying. The Security history currently appears as a Security panel in Settings, not yet as a separate Telegram-style conversation thread. Volunteer allowlist values must be configured privately in the deployment environment.
