# Private volunteer role configuration

The server can assign the public role `volunteer` based on an allowlist in the deployment environment. Email addresses are never included in public directory profiles or broadcast events; the allowlist must not be committed to Git.

## Configure deployment

In the hosting provider's private environment settings, set:

`TEGE_VOLUNTEER_EMAILS`

to a comma-separated list of the volunteers' account email addresses, then restart/redeploy the server. Keep the values only in the hosting environment, not in this repository, screenshots, public profiles, or logs.

The role is attached to the account after login/profile serialization. This currently labels accounts as volunteers; it does not grant moderation powers by itself. Any future moderator actions must have separate server-side authorization and audit logs.

## Privacy

Never add volunteer email addresses to frontend source, public documentation, seeded user data, or the public directory API. The server's `publicUser` intentionally excludes email. Only the authenticated account response contains the user's own email.
