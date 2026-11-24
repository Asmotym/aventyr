# Authentication, profiles and account settings

## Where to work

| Responsibility | Source |
| --- | --- |
| Discord OAuth, credential refresh, logout | [features/auth/](../../src/features/auth/) and [server/core/discord/](../../server/core/discord/) |
| Route guards | [app/router.ts](../../src/app/router.ts) |
| Settings page and General/Rooms/API panels | [features/settings/](../../src/features/settings/) |
| Public profile/avatar and About me requests | [features/profiles/](../../src/features/profiles/), [user-profiles.service.ts](../../server/services/user-profiles.service.ts) |
| API key settings transport and persistence | [api-keys.service.ts](../../src/features/settings/services/api-keys.service.ts), [server API-key service](../../server/services/api-keys.service.ts) |
| Authentication-aware HTTP transport | [shared/services/api.service.ts](../../src/shared/services/api.service.ts) |
| Persistent browser state and legacy key migration | [app-storage.service.ts](../../src/shared/services/app-storage.service.ts) |

## Authentication

Keep OAuth state validation, callback cleanup, expiry and refresh behavior in the auth service. Deduplicate concurrent refreshes and ignore obsolete account responses. Logout must clear persisted credentials and current-user state. Shared transport gets auth callbacks from the feature rather than importing it.

Browser route guards improve navigation; the API must separately verify identity and permissions. Same-user profile/preferences/key writes must never accept another actor simply because a client supplied their ID. See [backend authentication](../guides/backend.md#identity-and-permissions).

## Profiles and settings

The profiles feature owns public profile rendering and About me persistence. Profile reads can take a room context for room-specific information. Preserve request keys that include both user and room; discard late responses when switching profiles.

General settings compose profile and preference controls. Room settings here are account preferences; room administration belongs in `features/rooms/components/settings/`. [Preferences](preferences.md) owns language/theme synchronization.

Profile avatars receive Bag inspection through the [shared injection interface](../../src/shared/composables/useBagInspection.ts); room composition provides the implementation. Keep profiles independent of the room store. Inspection must remain read-only and react to membership/rights changes; see [Bags](rooms/bags.md).

## Personal API keys

Settings → API supports reading, generating/regenerating, showing/hiding, copying and revoking the account key. Preserve confirmation for destructive regeneration/revocation and keep the current state usable when a request fails. Do not log key values or include them in URLs in new integrations.

[API-key cryptography](../../server/core/utils/api-key.ts) uses `API_KEY_ENCRYPTION_SECRET` (legacy fallback: `API_KEY_SECRET`). Configure a stable secret in the server environment and ensure the deployment passes it through. Changing it without a migration can make stored encrypted keys unreadable; verify compatibility against a restored database before changing encryption or fallback behavior.

The Settings URLs point to the public [OpenAPI read API](../openapi.template.yaml), not the internal application action interface. Keep displayed base/docs URLs configurable.

## Verification

Run `npm run test:frontend` for auth/storage regressions and `npx playwright test tests/browser/auth tests/browser/settings` for session guards, logout, profile save/retry and API key workflows. Run `npm run build`; add server coverage for identity, persistence or encryption changes. Browser OAuth is mocked, so validate real Discord login/refresh in a configured environment when changing that integration.
