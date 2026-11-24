# Backend and API

The API is a standalone Express process. Start at [server/index.ts](../../server/index.ts) to trace an endpoint, then follow its service and persistence calls.

## Where to work

| Location | Responsibility |
| --- | --- |
| [server/index.ts](../../server/index.ts) | HTTP routes, request identity checks, image bodies, probes and startup |
| [server/services/](../../server/services/) | Application operations; room behavior is split into `rooms/` services |
| [server/core/types/](../../server/core/types/) | Shared API/domain contracts |
| [server/core/utils/](../../server/core/utils/) | Validation, permissions, calculations and browser-safe domain helpers |
| [server/core/database/schema.ts](../../server/core/database/schema.ts) | Repeatable schema setup and compatibility migrations |
| [server/core/database/tables/](../../server/core/database/tables/) | Table-specific queries; some room subfeatures also keep SQL in their services |
| [server/core/articles/](../../server/core/articles/) | Document schema, conversion, sanitization and translation rules |
| [server/realtime/](../../server/realtime/) | Authenticated room sockets, event contracts and publication |
| [server/observability/](../../server/observability/) | Correlation, error reporting and secret scrubbing |
| [server/tests/](../../server/tests/) | Domain, service and opt-in integration tests |

Add behavior to the owning service rather than growing the room dispatcher. Keep contract changes aligned with frontend services, realtime payloads and tests.

## Identity and permissions

[API-key middleware](../../server/middlewares/api-key.ts) gates requests from untrusted origins. It accepts `X-API-Key`, Bearer credentials or a legacy query parameter; prefer the header to avoid putting keys in URLs. Trusted frontend origins bypass this external-client gate. Origin trust alone is not user authentication: protected handlers must verify the requester and supplied actor/target IDs.

Use the existing same-user authentication helpers and service authorization checks. Account role rules live in [roles.service.ts](../../server/services/roles.service.ts); room roles and overrides live in [room-permissions.ts](../../server/core/utils/room-permissions.ts). Do not substitute client visibility or application admin status for room authorization. Check reads as well as writes, including private images and socket subscriptions.

## Persistence and events

- Validate inputs and current membership before mutation. Use parameterized queries and existing HTTP error classes.
- Preserve the feature's lock ordering. Room mutations serialize through the room lock; category changes acquire the category tree lock before document locks.
- Perform balances, message changes, revisions and recap updates in one transaction when they describe one operation. Publish socket events only after commit.
- Require current revisions for editable snapshots. Reject stale edits; never silently overwrite newer data or private state.
- Make schema changes repeatable and preserve existing data. Test legacy backfill, repeated setup, rollback on failure and concurrent writes when relevant.
- Keep server-only modules out of the browser. The legacy `netlify/*` frontend alias points at `server/*`; only shared types and deliberately browser-safe helpers belong in client imports.

Realtime protocol types live in [room-realtime.protocol.ts](../../server/realtime/room-realtime.protocol.ts). Clients refetch on invalidation events; Bag instead uses authorized scoped snapshots. Preserve reconnect recovery, membership revocation and per-user filtering. Presence is advisory, not a write lock.

## Public API documentation

The [OpenAPI template](../openapi.template.yaml) covers external read endpoints: `GET /rooms`, `GET /rooms/{roomId}/members` and `GET /rooms/{roomId}/dice-rolls`, relative to the `/api` server URL. It deliberately excludes internal account/editor endpoints and the `POST /api/rooms` action dispatcher. The room list and roster are scoped to the API-key owner. The current dice-history handler checks room existence without an owner-membership check; do not assume all three reads enforce identical access rules. Update its schemas when these public responses change; preserve `__API_BASE_URL__` for Compose rendering.

Use [feature guides](../README.md#feature-guides) for behavior and compatibility rules, [testing](testing.md) for validation, and [deployment](deployment.md) for migrations and observability.
